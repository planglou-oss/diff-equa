package httpapi

import (
	"database/sql"
	"eemath/internal/studycontent"
	"errors"
	"net/http"
	"strings"
)

func choiceCondition() (string, []any) {
	ready := []string{}
	args := []any{}
	for id, k := range studycontent.AnswerKeys {
		ready = append(ready, "(q.id=? AND EXISTS(SELECT 1 FROM question_media cm WHERE cm.question_id=q.id AND cm.role='original_solution' AND cm.media_id=?))")
		args = append(args, id, k.SourceMediaID)
	}
	if len(ready) == 0 {
		return "0=1", args
	}
	return "(" + strings.Join(ready, " OR ") + ")", args
}

func (s *Server) choiceKey(r *http.Request, id string) (studycontent.AnswerKey, bool, error) {
	var source string
	e := s.DB.QueryRowContext(r.Context(), `SELECT media_id FROM question_media WHERE question_id=? AND role='original_solution'`, id).Scan(&source)
	if errors.Is(e, sql.ErrNoRows) {
		return studycontent.AnswerKey{}, false, nil
	}
	if e != nil {
		return studycontent.AnswerKey{}, false, e
	}
	k, ok := studycontent.AnswerKeys[id]
	return k, ok && k.SourceMediaID == source, nil
}
func (s *Server) choices(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var exists int
	e := s.DB.QueryRowContext(r.Context(), `SELECT 1 FROM questions WHERE id=?`, id).Scan(&exists)
	if errors.Is(e, sql.ErrNoRows) {
		fail(w, r, 404, "QUESTION_NOT_FOUND", "ไม่พบโจทย์")
		return
	}
	if e != nil {
		internal(w, r, e)
		return
	}
	k, ok, e := s.choiceKey(r, id)
	if e != nil {
		internal(w, r, e)
		return
	}
	if !ok {
		write(w, 200, map[string]any{"available": false, "message": "ข้อนี้ยังไม่มีตัวเลือก 4 ข้อที่ตรวจเทียบเฉลยต้นฉบับแล้ว สามารถเปิดเฉลยเพื่อทบทวนได้"})
		return
	}
	write(w, 200, map[string]any{"available": true, "version": k.Version(), "prompt": k.Prompt, "options": k.PublicOptions(), "sourceLabel": "จัดทำตัวเลือกโดยเทียบภาพเฉลยต้นฉบับ"})
}

type choiceSubmission struct {
	QuestionID string `json:"questionId"`
	Answer     string `json:"answer"`
}

// Both single-question checks and finished practice sets use this same answer key.
func (s *Server) checkChoices(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Items []choiceSubmission `json:"items"`
	}
	if !decode(w, r, &in) {
		return
	}
	if len(in.Items) == 0 || len(in.Items) > 50 {
		fail(w, r, 400, "INVALID_CHOICES", "ส่งได้ 1–50 ข้อ")
		return
	}
	results := []map[string]any{}
	seen := map[string]bool{}
	correct, wrong, unanswered, ungraded := 0, 0, 0, 0
	for _, a := range in.Items {
		if seen[a.QuestionID] {
			fail(w, r, 400, "DUPLICATE_QUESTION", "ส่งข้อซ้ำไม่ได้")
			return
		}
		seen[a.QuestionID] = true
		k, ok, e := s.choiceKey(r, a.QuestionID)
		if e != nil {
			internal(w, r, e)
			return
		}
		result := map[string]any{"questionId": a.QuestionID}
		if !ok {
			result["status"] = "unavailable"
			ungraded++
			results = append(results, result)
			continue
		}
		if a.Answer == "" {
			result["status"] = "unanswered"
			unanswered++
			results = append(results, result)
			continue
		}
		parts := strings.Split(a.Answer, ":")
		if len(parts) != 3 || parts[0] != "mcq" {
			result["status"] = "legacy"
			ungraded++
			results = append(results, result)
			continue
		}
		if parts[1] != k.Version() {
			result["status"] = "stale"
			ungraded++
			results = append(results, result)
			continue
		}
		selected := -1
		for i := range k.Options {
			if k.OptionID(i) == parts[2] {
				selected = i
				break
			}
		}
		if selected < 0 {
			fail(w, r, 400, "INVALID_OPTION", "ตัวเลือกไม่ตรงกับโจทย์")
			return
		}
		isCorrect := selected == k.CorrectIndex
		result["status"] = "wrong"
		if isCorrect {
			result["status"] = "correct"
			correct++
		} else {
			wrong++
		}
		result["correctOptionId"] = k.OptionID(k.CorrectIndex)
		result["correctLatex"] = k.Options[k.CorrectIndex].Latex
		result["explanation"] = k.Explanation
		result["feedback"] = k.Options[selected].Feedback
		result["sourceUrl"] = "/media/" + k.SourceMediaID + ".png"
		results = append(results, result)
	}
	write(w, 200, map[string]any{"items": results, "correct": correct, "wrong": wrong, "unanswered": unanswered, "ungraded": ungraded, "total": len(in.Items)})
}
