package httpapi

import (
	"context"
	"database/sql"
	"eemath/internal/ai"
	"eemath/internal/questiontext"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

func (s *Server) generate(w http.ResponseWriter, r *http.Request) {
	qid, err := s.ownedConversation(r)
	if err != nil {
		fail(w, r, 404, "NOT_FOUND", "ไม่พบบทสนทนา")
		return
	}
	if s.AI == nil {
		fail(w, r, 503, "AI_UNAVAILABLE", "ยังไม่ได้ตั้งค่า AI บนเซิร์ฟเวอร์")
		return
	}
	var input struct {
		Message      string  `json:"message"`
		RequestID    string  `json:"clientRequestId"`
		QuestionText *string `json:"questionText"`
	}
	if !decode(w, r, &input) {
		return
	}
	input.Message = strings.TrimSpace(input.Message)
	if len([]rune(input.Message)) == 0 || len([]rune(input.Message)) > 4000 || len(input.RequestID) < 8 || len(input.RequestID) > 100 {
		fail(w, r, 400, "INVALID_MESSAGE", "ข้อความต้องมี 1–4,000 ตัวอักษรและ request ID ที่ถูกต้อง")
		return
	}
	if input.QuestionText != nil && (strings.TrimSpace(*input.QuestionText) == "" || len([]rune(*input.QuestionText)) > 6000) {
		fail(w, r, 400, "INVALID_QUESTION_TEXT", "ข้อความโจทย์ต้องมี 1–6,000 ตัวอักษร")
		return
	}
	cid := r.PathValue("id")
	s.mu.Lock()
	if s.active[cid] {
		s.mu.Unlock()
		fail(w, r, 409, "GENERATION_BUSY", "AI กำลังตอบบทสนทนานี้")
		return
	}
	s.active[cid] = true
	s.mu.Unlock()
	defer func() { s.mu.Lock(); delete(s.active, cid); s.mu.Unlock() }()
	var previousStatus, mid string
	err = s.DB.QueryRowContext(r.Context(), `SELECT status,message_id FROM generation_requests WHERE conversation_id=? AND client_request_id=?`, cid, input.RequestID).Scan(&previousStatus, &mid)
	if err == nil {
		if previousStatus == "completed" {
			var content string
			if e := s.DB.QueryRowContext(r.Context(), `SELECT content FROM messages WHERE id=?`, mid).Scan(&content); e != nil {
				internal(w, r, e)
				return
			}
			w.Header().Set("Content-Type", "text/event-stream")
			sendEvent(w, "start", map[string]string{"messageId": mid})
			sendEvent(w, "delta", map[string]string{"text": content})
			sendEvent(w, "done", map[string]string{"messageId": mid, "status": "completed"})
			return
		}
		fail(w, r, 409, "REQUEST_ALREADY_USED", "คำขอนี้ถูกส่งแล้ว กรุณาลองใหม่ด้วยคำขอใหม่")
		return
	}
	if !errors.Is(err, sql.ErrNoRows) {
		internal(w, r, err)
		return
	}
	owner, _ := s.owner(r)
	var hourly int
	err = s.DB.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM generation_requests g JOIN conversations c ON c.id=g.conversation_id WHERE c.session_id=? AND g.created_at>?`, owner, time.Now().Add(-time.Hour).Unix()).Scan(&hourly)
	if err != nil {
		internal(w, r, err)
		return
	}
	if hourly >= 30 {
		w.Header().Set("Retry-After", "3600")
		fail(w, r, 429, "AI_QUOTA_EXCEEDED", "ใช้ AI ครบ 30 ครั้งต่อชั่วโมงแล้ว")
		return
	}
	select {
	case s.slots <- struct{}{}:
		defer func() { <-s.slots }()
	default:
		w.Header().Set("Retry-After", "10")
		fail(w, r, 429, "AI_BUSY", "AI มีผู้ใช้งานพร้อมกัน กรุณาลองอีกครั้ง")
		return
	}
	var topic, rawQuestion string
	if err = s.DB.QueryRowContext(r.Context(), `SELECT t.name,q.search_text_raw FROM topics t JOIN questions q ON q.topic_id=t.id WHERE q.id=?`, qid).Scan(&topic, &rawQuestion); err != nil {
		internal(w, r, err)
		return
	}
	text := questiontext.FromLegacy(qid, rawQuestion).Text
	if input.QuestionText != nil {
		text = strings.TrimSpace(*input.QuestionText)
	}
	// Keep complete user/assistant exchanges only, newest first until budget is full.
	rows, err := s.DB.QueryContext(r.Context(), `SELECT role,content FROM messages WHERE conversation_id=? AND status='completed' ORDER BY created_at DESC,id DESC LIMIT 4`, cid)
	if err != nil {
		internal(w, r, err)
		return
	}
	recent := []ai.Message{}
	for rows.Next() {
		var m ai.Message
		rows.Scan(&m.Role, &m.Content)
		recent = append(recent, m)
	}
	rows.Close()
	history := []ai.Message{}
	budget := 0
	for i := 0; i+1 < len(recent); i += 2 {
		if recent[i].Role != "assistant" || recent[i+1].Role != "user" {
			break
		}
		cost := len([]rune(recent[i].Content)) + len([]rune(recent[i+1].Content))
		if budget+cost > 4000 {
			break
		}
		budget += cost
		history = append([]ai.Message{recent[i+1], recent[i]}, history...)
	}
	mid = randomID()
	uid := randomID()
	now := time.Now().UnixNano()
	tx, err := s.DB.BeginTx(r.Context(), nil)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer tx.Rollback()
	_, err = tx.Exec(`INSERT INTO messages VALUES(?,?,?,?,?,?)`, uid, cid, "user", input.Message, "streaming", now)
	if err == nil {
		_, err = tx.Exec(`INSERT INTO messages VALUES(?,?,?,?,?,?)`, mid, cid, "assistant", "", "streaming", now+1)
	}
	if err == nil {
		_, err = tx.Exec(`INSERT INTO generation_requests(conversation_id,client_request_id,status,message_id,created_at) VALUES(?,?,?,?,?)`, cid, input.RequestID, "streaming", mid, time.Now().Unix())
	}
	if err == nil {
		err = tx.Commit()
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	sendEvent(w, "start", map[string]string{"messageId": mid})
	ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer cancel()
	var answer strings.Builder
	startedAt := time.Now()
	var firstToken time.Duration
	err = streamWithHeartbeat(ctx, s.AI, ai.Input{QuestionID: qid, Topic: topic, QuestionText: text, History: history, Message: input.Message}, func(delta string) error {
		if answer.Len()+len(delta) > 128<<10 {
			return fmt.Errorf("answer too long")
		}
		if answer.Len() == 0 {
			firstToken = time.Since(startedAt)
		}
		answer.WriteString(delta)
		return sendEvent(w, "delta", map[string]string{"text": delta})
	}, func() error {
		_, e := fmt.Fprint(w, ": keepalive\n\n")
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
		return e
	}, 10*time.Second)
	status, code, publicMessage := "completed", "", ""
	if err != nil {
		status = "interrupted"
		if ctx.Err() != nil {
			err = ctx.Err()
		}
		code, publicMessage = ai.PublicError(err)
	}
	log.Printf("request=%s ai_status=%s code=%s duration_ms=%d first_token_ms=%d answer_bytes=%d", w.Header().Get("X-Request-ID"), status, code, time.Since(startedAt).Milliseconds(), firstToken.Milliseconds(), answer.Len())
	saveCtx, saveCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer saveCancel()
	tx, saveErr := s.DB.BeginTx(saveCtx, nil)
	if saveErr == nil {
		_, saveErr = tx.ExecContext(saveCtx, `UPDATE messages SET content=?,status=? WHERE id=?`, answer.String(), status, mid)
		if saveErr == nil {
			_, saveErr = tx.ExecContext(saveCtx, `UPDATE messages SET status=? WHERE id=?`, status, uid)
		}
		if saveErr == nil {
			_, saveErr = tx.ExecContext(saveCtx, `UPDATE generation_requests SET status=?,error_code=? WHERE conversation_id=? AND client_request_id=?`, status, code, cid, input.RequestID)
		}
		if saveErr == nil {
			saveErr = tx.Commit()
		} else {
			tx.Rollback()
		}
	}
	if saveErr != nil {
		sendEvent(w, "error", map[string]string{"code": "SAVE_FAILED", "message": "บันทึกคำตอบไม่สำเร็จ กรุณาโหลดประวัติใหม่", "requestId": w.Header().Get("X-Request-ID")})
		return
	}
	if err != nil {
		sendEvent(w, "error", map[string]string{"code": code, "message": publicMessage, "requestId": w.Header().Get("X-Request-ID")})
		return
	}
	sendEvent(w, "done", map[string]string{"messageId": mid, "status": status})
}

// A single goroutine writes the response; keepalives keep a silent model stream alive through proxies.
func streamWithHeartbeat(ctx context.Context, p ai.Provider, in ai.Input, emit func(string) error, ping func() error, interval time.Duration) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	deltas := make(chan string)
	done := make(chan error, 1)
	go func() {
		done <- p.Stream(ctx, in, func(text string) error {
			select {
			case deltas <- text:
				return nil
			case <-ctx.Done():
				return ctx.Err()
			}
		})
	}()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-done:
			return err
		case delta := <-deltas:
			if err := emit(delta); err != nil {
				return err
			}
		case <-ticker.C:
			if err := ping(); err != nil {
				return err
			}
		}
	}
}
func sendEvent(w http.ResponseWriter, event string, data any) error {
	b, err := json.Marshal(data)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, b)
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
	return err
}
