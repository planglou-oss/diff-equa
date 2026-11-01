package httpapi

import (
	"database/sql"
	"eemath/internal/studycontent"
	"errors"
	"net/http"
	"strings"
	"time"
)

func (s *Server) guides(w http.ResponseWriter, r *http.Request) {
	write(w, 200, map[string]any{"items": studycontent.Guides, "questionHints": studycontent.QuestionHints})
}
func idClause(column string, ids []string) (string, []any) {
	if len(ids) == 0 {
		return "0=1", nil
	}
	marks := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		marks[i] = "?"
		args[i] = id
	}
	return column + " IN (" + strings.Join(marks, ",") + ")", args
}
func (s *Server) practiceSet(w http.ResponseWriter, r *http.Request) {
	var in struct {
		TopicID    int       `json:"topicId"`
		Count      int       `json:"count"`
		IncludeIDs *[]string `json:"includeIds"`
		ExcludeIDs []string  `json:"excludeIds"`
		Mode       string    `json:"mode"`
	}
	if !decode(w, r, &in) {
		return
	}
	if in.Count < 1 || in.Count > 50 || in.TopicID < 0 || in.TopicID > 9 || len(in.ExcludeIDs) > 500 || (in.IncludeIDs != nil && len(*in.IncludeIDs) > 500) {
		fail(w, r, 400, "INVALID_PRACTICE", "เลือกจำนวน 1–50 ข้อและหัวข้อที่มีในคลัง")
		return
	}
	where := []string{"1=1"}
	args := []any{}
	if in.Mode != "" && in.Mode != "choice" {
		fail(w, r, 400, "INVALID_PRACTICE", "รูปแบบชุดฝึกไม่ถูกต้อง")
		return
	}
	if in.Mode == "choice" {
		condition, values := choiceCondition()
		where = append(where, condition)
		args = append(args, values...)
	}
	if in.TopicID > 0 {
		where = append(where, "q.topic_id=?")
		args = append(args, in.TopicID)
	}
	if in.IncludeIDs != nil {
		clause, values := idClause("q.id", *in.IncludeIDs)
		where = append(where, clause)
		args = append(args, values...)
	}
	if len(in.ExcludeIDs) > 0 {
		clause, values := idClause("q.id", in.ExcludeIDs)
		where = append(where, "NOT ("+clause+")")
		args = append(args, values...)
	}
	clause := " WHERE " + strings.Join(where, " AND ")
	var available int
	if e := s.DB.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM questions q`+clause, args...).Scan(&available); e != nil {
		internal(w, r, e)
		return
	}
	rows, e := s.DB.QueryContext(r.Context(), selectQuestion+clause+" ORDER BY RANDOM() LIMIT ?", append(args, in.Count)...)
	if e != nil {
		internal(w, r, e)
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
	if e = rows.Err(); e != nil {
		internal(w, r, e)
		return
	}
	write(w, 200, map[string]any{"items": items, "available": available, "requestedCount": in.Count})
}
func (s *Server) report(w http.ResponseWriter, r *http.Request) {
	owner, e := s.owner(r)
	if e != nil {
		fail(w, r, 401, "SESSION_REQUIRED", "กรุณาเริ่ม session ใหม่")
		return
	}
	var in struct {
		Kind        string `json:"kind"`
		Description string `json:"description"`
	}
	if !decode(w, r, &in) {
		return
	}
	in.Description = strings.TrimSpace(in.Description)
	switch in.Kind {
	case "question", "original_solution", "ai_explanation", "guide":
	default:
		fail(w, r, 400, "INVALID_REPORT", "กรุณาเลือกส่วนที่ต้องการแจ้ง")
		return
	}
	if len([]rune(in.Description)) < 3 || len([]rune(in.Description)) > 2000 {
		fail(w, r, 400, "INVALID_REPORT", "รายละเอียดต้องมี 3–2,000 ตัวอักษร")
		return
	}
	var exists int
	e = s.DB.QueryRowContext(r.Context(), `SELECT 1 FROM questions WHERE id=?`, r.PathValue("id")).Scan(&exists)
	if errors.Is(e, sql.ErrNoRows) {
		fail(w, r, 404, "QUESTION_NOT_FOUND", "ไม่พบโจทย์")
		return
	}
	if e != nil {
		internal(w, r, e)
		return
	}
	var recent int
	if e = s.DB.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM reports WHERE session_id=? AND created_at>?`, owner, time.Now().Add(-time.Hour).Unix()).Scan(&recent); e != nil {
		internal(w, r, e)
		return
	}
	if recent >= 20 {
		fail(w, r, 429, "REPORT_LIMIT", "บันทึกได้ไม่เกิน 20 รายงานต่อชั่วโมง")
		return
	}
	id := randomID()
	_, e = s.DB.ExecContext(r.Context(), `INSERT INTO reports(id,question_id,session_id,kind,description,created_at) VALUES(?,?,?,?,?,?)`, id, r.PathValue("id"), owner, in.Kind, in.Description, time.Now().Unix())
	if e != nil {
		internal(w, r, e)
		return
	}
	write(w, 201, map[string]string{"id": id, "status": "recorded"})
}
