package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"eemath/internal/ai"
	"eemath/internal/questiontext"
	"eemath/internal/studycontent"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Server struct {
	DB              *sql.DB
	DataDir, WebDir string
	AI              ai.Provider
	mux             *http.ServeMux
	mu              sync.Mutex
	active          map[string]bool
	slots           chan struct{}
}
type Image struct {
	URL    string `json:"url"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}
type Question struct {
	ID          string   `json:"id"`
	TopicID     int      `json:"topicId"`
	Topic       string   `json:"topic"`
	Number      int      `json:"displayNumber"`
	Type        string   `json:"examType"`
	TypeRaw     string   `json:"examTypeRaw"`
	Date        string   `json:"dateLabel"`
	Year        int      `json:"year"`
	Source      string   `json:"sourceLabel"`
	Image       Image    `json:"questionImage"`
	Original    bool     `json:"hasOriginalSolution"`
	Explanation bool     `json:"hasAIExplanation"`
	Tags        []string `json:"tags"`
}

func New(db *sql.DB, data, web string, provider ai.Provider) *Server {
	s := &Server{DB: db, DataDir: data, WebDir: web, AI: provider, mux: http.NewServeMux(), active: map[string]bool{}, slots: make(chan struct{}, 4)}
	s.mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) { write(w, 200, map[string]bool{"ok": true}) })
	s.mux.HandleFunc("GET /api/v1/catalog", s.catalog)
	s.mux.HandleFunc("GET /api/v1/guides", s.guides)
	s.mux.HandleFunc("POST /api/v1/practice/sets", s.practiceSet)
	s.mux.HandleFunc("GET /api/v1/questions/{id}/choices", s.choices)
	s.mux.HandleFunc("POST /api/v1/choices/check", s.checkChoices)
	s.mux.HandleFunc("POST /api/v1/questions/{id}/reports", s.report)
	s.mux.HandleFunc("GET /api/v1/questions", s.questions)
	s.mux.HandleFunc("GET /api/v1/questions/{id}", s.question)
	s.mux.HandleFunc("GET /api/v1/questions/{id}/solutions", s.solutions)
	s.mux.HandleFunc("GET /api/v1/questions/{id}/context", s.questionContext)
	s.mux.HandleFunc("POST /api/v1/session", s.session)
	s.mux.HandleFunc("POST /api/v1/conversations", s.conversation)
	s.mux.HandleFunc("GET /api/v1/conversations/{id}/messages", s.messages)
	s.mux.HandleFunc("POST /api/v1/conversations/{id}/messages", s.generate)
	s.mux.HandleFunc("GET /media/{name}", s.media)
	s.mux.HandleFunc("GET /mascot.png", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, filepath.Join(s.DataDir, "mascot.png"))
	})
	s.mux.HandleFunc("/", s.static)
	return s
}
func randomID() string {
	var b [24]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b[:])
}
func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	write(w, status, map[string]any{"error": map[string]string{"code": code, "message": message, "requestId": w.Header().Get("X-Request-ID")}})
}
func internal(w http.ResponseWriter, r *http.Request, err error) {
	log.Printf("request=%s error=%v", w.Header().Get("X-Request-ID"), err)
	fail(w, r, 500, "INTERNAL_ERROR", "ระบบขัดข้อง กรุณาลองใหม่")
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	defer r.Body.Close()
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		fail(w, r, 400, "INVALID_BODY", "ข้อมูลคำขอไม่ถูกต้อง")
		return false
	}
	var extra any
	if err := d.Decode(&extra); err != io.EOF {
		fail(w, r, 400, "INVALID_BODY", "ส่งข้อมูลได้หนึ่งรายการ")
		return false
	}
	return true
}
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Request-ID", randomID())
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "same-origin")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'")
	if strings.HasPrefix(r.URL.Path, "/api/") {
		w.Header().Set("Cache-Control", "no-store")
	}
	if r.Method != "GET" && r.Method != "HEAD" {
		if origin := r.Header.Get("Origin"); origin != "" {
			u, e := url.Parse(origin)
			if e != nil || u.Host != r.Host {
				fail(w, r, 403, "ORIGIN_NOT_ALLOWED", "ไม่อนุญาตคำขอจากเว็บไซต์นี้")
				return
			}
		}
	}
	defer func() {
		if e := recover(); e != nil {
			log.Printf("request=%s panic", w.Header().Get("X-Request-ID"))
			fail(w, r, 500, "INTERNAL_ERROR", "ระบบขัดข้อง")
		}
	}()
	s.mux.ServeHTTP(w, r)
}
func (s *Server) catalog(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.QueryContext(r.Context(), `SELECT t.id,t.name,COUNT(q.id) FROM topics t LEFT JOIN questions q ON q.topic_id=t.id GROUP BY t.id ORDER BY t.sort_order`)
	if err != nil {
		internal(w, r, err)
		return
	}
	topics := []map[string]any{}
	for rows.Next() {
		var id, count int
		var name string
		if err = rows.Scan(&id, &name, &count); err != nil {
			break
		}
		topics = append(topics, map[string]any{"id": id, "name": name, "totalCount": count})
	}
	if err == nil {
		err = rows.Err()
	}
	rows.Close()
	if err != nil {
		internal(w, r, err)
		return
	}
	years := []int{}
	rows, err = s.DB.QueryContext(r.Context(), `SELECT DISTINCT year FROM questions ORDER BY year DESC`)
	if err != nil {
		internal(w, r, err)
		return
	}
	for rows.Next() {
		var y int
		rows.Scan(&y)
		years = append(years, y)
	}
	rows.Close()
	types := []string{}
	rows, err = s.DB.QueryContext(r.Context(), `SELECT DISTINCT exam_type FROM questions ORDER BY CASE exam_type WHEN 'Midterm' THEN 0 WHEN 'Final' THEN 1 WHEN 'Quiz' THEN 2 ELSE 3 END,exam_type`)
	if err != nil {
		internal(w, r, err)
		return
	}
	for rows.Next() {
		var t string
		rows.Scan(&t)
		types = append(types, t)
	}
	rows.Close()
	write(w, 200, map[string]any{"topics": topics, "years": years, "examTypes": types, "aiAvailable": s.AI != nil})
}

const selectQuestion = `SELECT q.id,q.topic_id,t.name,q.display_number,q.exam_type,q.exam_type_raw,q.date_label,q.year,q.source_label,m.id,m.width,m.height,EXISTS(SELECT 1 FROM question_media WHERE question_id=q.id AND role='original_solution'),EXISTS(SELECT 1 FROM explanations WHERE question_id=q.id) FROM questions q JOIN topics t ON t.id=q.topic_id JOIN question_media qm ON qm.question_id=q.id AND qm.role='question' JOIN media m ON m.id=qm.media_id`

func scanQuestion(row interface{ Scan(...any) error }) (Question, error) {
	var q Question
	var hash string
	err := row.Scan(&q.ID, &q.TopicID, &q.Topic, &q.Number, &q.Type, &q.TypeRaw, &q.Date, &q.Year, &q.Source, &hash, &q.Image.Width, &q.Image.Height, &q.Original, &q.Explanation)
	q.Image.URL = "/media/" + hash + ".png"
	q.Tags = studycontent.Tags(q.TopicID)
	return q, err
}
func (s *Server) questions(w http.ResponseWriter, r *http.Request) {
	values := r.URL.Query()
	where := []string{"1=1"}
	args := []any{}
	if values.Get("choiceOnly") == "1" {
		condition, values := choiceCondition()
		where = append(where, condition)
		args = append(args, values...)
	}
	for _, pair := range []struct{ key, col string }{{"topicId", "q.topic_id"}, {"year", "q.year"}} {
		if v := values.Get(pair.key); v != "" {
			n, e := strconv.Atoi(v)
			if e != nil || n < 1 {
				fail(w, r, 400, "INVALID_FILTER", "ตัวกรองไม่ถูกต้อง")
				return
			}
			where = append(where, pair.col+"=?")
			args = append(args, n)
		}
	}
	if v := values.Get("examType"); v != "" {
		where = append(where, "q.exam_type=?")
		args = append(args, v)
	}
	for _, filter := range []struct {
		key     string
		exclude bool
	}{{"ids", false}, {"excludeIds", true}} {
		if raw, ok := values[filter.key]; ok {
			ids := []string{}
			if len(raw) > 0 && raw[0] != "" {
				ids = strings.Split(raw[0], ",")
			}
			if len(ids) > 500 {
				fail(w, r, 400, "INVALID_FILTER", "จำนวนข้อในตัวกรองมากเกินไป")
				return
			}
			clause, vals := idClause("q.id", ids)
			if filter.exclude {
				clause = "NOT (" + clause + ")"
			}
			where = append(where, clause)
			args = append(args, vals...)
		}
	}
	if v := strings.TrimSpace(values.Get("q")); v != "" {
		if len([]rune(v)) > 200 {
			fail(w, r, 400, "QUERY_TOO_LONG", "คำค้นยาวเกิน 200 ตัวอักษร")
			return
		}
		where = append(where, `instr(lower(q.search_text_raw || ' ' || q.date_label || ' ' || q.year || ' ' || q.exam_type_raw || ' ' || q.source_label || ' ข้อ' || q.display_number || ' ' || t.name || ' ' || `+studycontent.SearchSQL()+`),lower(?))>0`)
		args = append(args, v)
	}
	page, size := 1, 20
	for _, p := range []struct {
		k string
		n *int
	}{{"page", &page}, {"pageSize", &size}} {
		if v := values.Get(p.k); v != "" {
			n, e := strconv.Atoi(v)
			if e != nil || n < 1 || n > 100000 {
				fail(w, r, 400, "INVALID_PAGINATION", "เลขหน้าไม่ถูกต้อง")
				return
			}
			*p.n = n
		}
	}
	if size > 100 {
		fail(w, r, 400, "INVALID_PAGINATION", "ขอได้สูงสุด 100 ข้อต่อหน้า")
		return
	}
	clause := " WHERE " + strings.Join(where, " AND ")
	var total int
	if err := s.DB.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM questions q JOIN topics t ON t.id=q.topic_id`+clause, args...).Scan(&total); err != nil {
		internal(w, r, err)
		return
	}
	listArgs := append(append([]any{}, args...), size, (page-1)*size)
	order := "q.topic_id,q.display_number,q.id"
	switch values.Get("sort") {
	case "", "default":
	case "year_asc":
		order = "q.year ASC," + order
	case "year_desc":
		order = "q.year DESC," + order
	case "number_desc":
		order = "q.display_number DESC,q.topic_id,q.id"
	default:
		fail(w, r, 400, "INVALID_SORT", "รูปแบบเรียงลำดับไม่ถูกต้อง")
		return
	}
	rows, err := s.DB.QueryContext(r.Context(), selectQuestion+clause+` ORDER BY `+order+` LIMIT ? OFFSET ?`, listArgs...)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	items := []Question{}
	for rows.Next() {
		q, e := scanQuestion(rows)
		if e != nil {
			internal(w, r, e)
			return
		}
		items = append(items, q)
	}
	if err = rows.Err(); err != nil {
		internal(w, r, err)
		return
	}
	write(w, 200, map[string]any{"items": items, "total": total, "page": page, "pageSize": size})
}
func (s *Server) question(w http.ResponseWriter, r *http.Request) {
	q, err := scanQuestion(s.DB.QueryRowContext(r.Context(), selectQuestion+` WHERE q.id=?`, r.PathValue("id")))
	if errors.Is(err, sql.ErrNoRows) {
		fail(w, r, 404, "QUESTION_NOT_FOUND", "ไม่พบโจทย์ข้อนี้")
		return
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	write(w, 200, q)
}
func (s *Server) solutions(w http.ResponseWriter, r *http.Request) {
	var im Image
	var hash string
	err := s.DB.QueryRowContext(r.Context(), `SELECT m.id,m.width,m.height FROM question_media qm JOIN media m ON m.id=qm.media_id WHERE qm.question_id=? AND qm.role='original_solution'`, r.PathValue("id")).Scan(&hash, &im.Width, &im.Height)
	if errors.Is(err, sql.ErrNoRows) {
		fail(w, r, 404, "QUESTION_NOT_FOUND", "ไม่พบเฉลย")
		return
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	im.URL = "/media/" + hash + ".png"
	var body, status string
	var explanation any
	err = s.DB.QueryRowContext(r.Context(), `SELECT body_html,review_status FROM explanations WHERE question_id=?`, r.PathValue("id")).Scan(&body, &status)
	if err == nil {
		explanation = map[string]string{"bodyHtml": body, "reviewStatus": status, "origin": "imported_ai"}
	} else if !errors.Is(err, sql.ErrNoRows) {
		internal(w, r, err)
		return
	}
	write(w, 200, map[string]any{"original": im, "aiExplanation": explanation})
}

func (s *Server) questionContext(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var raw string
	err := s.DB.QueryRowContext(r.Context(), `SELECT search_text_raw FROM questions WHERE id=?`, id).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		fail(w, r, 404, "QUESTION_NOT_FOUND", "ไม่พบโจทย์ข้อนี้")
		return
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	write(w, 200, questiontext.FromLegacy(id, raw))
}
func (s *Server) media(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	hash := strings.TrimSuffix(name, ".png")
	if len(hash) != 64 || name != hash+".png" {
		http.NotFound(w, r)
		return
	}
	if _, e := hex.DecodeString(hash); e != nil {
		http.NotFound(w, r)
		return
	}
	var rel string
	if err := s.DB.QueryRowContext(r.Context(), `SELECT relative_path FROM media WHERE id=?`, hash).Scan(&rel); err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "public,max-age=31536000,immutable")
	http.ServeFile(w, r, filepath.Join(s.DataDir, "media", filepath.Base(rel)))
}
func (s *Server) static(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/media/") {
		fail(w, r, 404, "NOT_FOUND", "ไม่พบเส้นทางนี้")
		return
	}
	if r.Method != "GET" && r.Method != "HEAD" {
		w.WriteHeader(405)
		return
	}
	clean := filepath.Clean(filepath.FromSlash(r.URL.Path))
	clean = strings.TrimLeft(clean, `/\`)
	if strings.HasPrefix(clean, "..") || strings.Contains(clean, ":") {
		http.NotFound(w, r)
		return
	}
	target := filepath.Join(s.WebDir, clean)
	if info, err := os.Stat(target); err == nil && !info.IsDir() {
		http.ServeFile(w, r, target)
		return
	}
	if r.URL.Path != "/" && r.URL.Path != "/questions" && !strings.HasPrefix(r.URL.Path, "/questions/") && r.URL.Path != "/practice" && r.URL.Path != "/formulas" && r.URL.Path != "/progress" {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, filepath.Join(s.WebDir, "index.html"))
}
func tokenHash(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
func (s *Server) owner(r *http.Request) (string, error) {
	c, e := r.Cookie("ee_session")
	if e != nil {
		return "", e
	}
	var id string
	e = s.DB.QueryRowContext(r.Context(), `SELECT id FROM browser_sessions WHERE token_hash=? AND expires_at>?`, tokenHash(c.Value), time.Now().Unix()).Scan(&id)
	return id, e
}
func (s *Server) session(w http.ResponseWriter, r *http.Request) {
	if _, e := s.owner(r); e == nil {
		write(w, 200, map[string]bool{"ok": true})
		return
	}
	token, id := randomID(), randomID()
	_, err := s.DB.ExecContext(r.Context(), `INSERT INTO browser_sessions VALUES(?,?,?)`, id, tokenHash(token), time.Now().Add(30*24*time.Hour).Unix())
	if err != nil {
		internal(w, r, err)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "ee_session", Value: token, Path: "/", HttpOnly: true, Secure: r.TLS != nil, SameSite: http.SameSiteStrictMode, MaxAge: 30 * 86400})
	write(w, 201, map[string]bool{"ok": true})
}
func (s *Server) conversation(w http.ResponseWriter, r *http.Request) {
	owner, err := s.owner(r)
	if err != nil {
		fail(w, r, 401, "SESSION_REQUIRED", "กรุณาเริ่ม session ใหม่")
		return
	}
	var input struct {
		QuestionID string `json:"questionId"`
	}
	if !decode(w, r, &input) {
		return
	}
	var exists int
	if s.DB.QueryRowContext(r.Context(), `SELECT 1 FROM questions WHERE id=?`, input.QuestionID).Scan(&exists) != nil {
		fail(w, r, 404, "QUESTION_NOT_FOUND", "ไม่พบโจทย์")
		return
	}
	id := randomID()
	_, err = s.DB.ExecContext(r.Context(), `INSERT INTO conversations VALUES(?,?,?,?)`, id, owner, input.QuestionID, time.Now().Unix())
	if err != nil {
		internal(w, r, err)
		return
	}
	write(w, 201, map[string]string{"id": id, "questionId": input.QuestionID})
}
func (s *Server) ownedConversation(r *http.Request) (string, error) {
	owner, e := s.owner(r)
	if e != nil {
		return "", e
	}
	var q string
	e = s.DB.QueryRowContext(r.Context(), `SELECT question_id FROM conversations WHERE id=? AND session_id=?`, r.PathValue("id"), owner).Scan(&q)
	return q, e
}
func (s *Server) messages(w http.ResponseWriter, r *http.Request) {
	if _, e := s.ownedConversation(r); e != nil {
		fail(w, r, 404, "NOT_FOUND", "ไม่พบบทสนทนา")
		return
	}
	rows, e := s.DB.QueryContext(r.Context(), `SELECT id,role,content,status FROM messages WHERE conversation_id=? ORDER BY created_at,id`, r.PathValue("id"))
	if e != nil {
		internal(w, r, e)
		return
	}
	defer rows.Close()
	items := []map[string]string{}
	for rows.Next() {
		var id, role, content, status string
		if e = rows.Scan(&id, &role, &content, &status); e != nil {
			internal(w, r, e)
			return
		}
		items = append(items, map[string]string{"id": id, "role": role, "content": content, "status": status})
	}
	write(w, 200, map[string]any{"items": items})
}

// Cleanup is run on startup and periodically; expired sessions cascade to chats.
func (s *Server) Cleanup() {
	s.DB.Exec(`DELETE FROM browser_sessions WHERE expires_at<=?`, time.Now().Unix())
}
