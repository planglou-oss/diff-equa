package httpapi

import (
	"eemath/internal/studycontent"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

func TestChoiceBankSourceAndScoring(t *testing.T) {
	p := &fakeProvider{}
	ts, s := fixture(t, p)
	c := client()
	submissions := []choiceSubmission{}
	for id, k := range studycontent.AnswerKeys {
		out := call(t, c, ts.URL, "GET", "/questions/"+id+"/choices", "", 200)
		var pub struct {
			Available bool
			Version   string
			Options   []studycontent.PublicOption
		}
		if e := json.Unmarshal(out, &pub); e != nil {
			t.Fatal(e)
		}
		if !pub.Available || len(pub.Options) != 4 || pub.Version != k.Version() {
			t.Fatalf("missing checked choices %s: %s", id, out)
		}
		for _, secret := range []string{"correctOptionId", "correctIndex", "feedback", "explanation"} {
			if strings.Contains(string(out), `"`+secret+`"`) {
				t.Fatal("answer leaked before submission")
			}
		}
		if fmt.Sprint(pub.Options) != fmt.Sprint(k.PublicOptions()) {
			t.Fatal("option order is not stable")
		}
		submissions = append(submissions, choiceSubmission{id, "mcq:" + k.Version() + ":" + k.OptionID(k.CorrectIndex)})
	}
	body, _ := json.Marshal(map[string]any{"items": submissions})
	out := call(t, c, ts.URL, "POST", "/choices/check", string(body), 200)
	var score struct {
		Correct, Wrong, Unanswered, Ungraded, Total int
		Items                                       []map[string]any
	}
	json.Unmarshal(out, &score)
	if score.Correct != len(submissions) || score.Total != 10 || score.Wrong != 0 {
		t.Fatalf("bad score: %s", out)
	}
	for _, item := range score.Items {
		if item["status"] != "correct" || item["sourceUrl"] == nil || item["explanation"] == nil {
			t.Fatal("missing source-based feedback")
		}
	}
	k := studycontent.AnswerKeys["ee201-t01-q001"]
	wrong := "mcq:" + k.Version() + ":" + k.OptionID(1)
	body, _ = json.Marshal(map[string]any{"items": []choiceSubmission{{k.QuestionID, wrong}, {"ee201-t01-q002", ""}, {"ee201-t01-q003", ""}, {"ee201-t02-q001", "old handwritten answer"}, {"ee201-t03-q001", "mcq:old-version:old-option"}}})
	out = call(t, c, ts.URL, "POST", "/choices/check", string(body), 200)
	json.Unmarshal(out, &score)
	if score.Correct != 0 || score.Wrong != 1 || score.Unanswered != 1 || score.Ungraded != 3 {
		t.Fatalf("bad partial score: %s", out)
	}
	out = call(t, c, ts.URL, "GET", "/questions/ee201-t01-q003/choices", "", 200)
	if !strings.Contains(string(out), `"available":false`) {
		t.Fatal("unreviewed OCR became a grading key")
	}
	// A changed scan invalidates the key instead of silently grading against another source.
	_, e := s.DB.Exec(`UPDATE question_media SET media_id=(SELECT media_id FROM question_media WHERE question_id='ee201-t01-q002' AND role='original_solution') WHERE question_id=? AND role='original_solution'`, k.QuestionID)
	if e != nil {
		t.Fatal(e)
	}
	out = call(t, c, ts.URL, "GET", "/questions/"+k.QuestionID+"/choices", "", 200)
	if !strings.Contains(string(out), `"available":false`) {
		t.Fatal("changed source did not invalidate key")
	}
	if p.Calls != 0 {
		t.Fatal("choice checks called AI")
	}
}
func TestChoiceValidationAndPracticePool(t *testing.T) {
	ts, _ := fixture(t, nil)
	c := client()
	out := call(t, c, ts.URL, "POST", "/practice/sets", `{"count":50,"mode":"choice"}`, 200)
	var pool struct {
		Items     []Question
		Available int
	}
	json.Unmarshal(out, &pool)
	if len(pool.Items) != 10 || pool.Available != 10 {
		t.Fatalf("bad choice pool %s", out)
	}
	seen := map[string]bool{}
	for _, q := range pool.Items {
		if _, ok := studycontent.AnswerKeys[q.ID]; !ok || seen[q.ID] {
			t.Fatal("unprepared/duplicate practice question")
		}
		seen[q.ID] = true
	}
	out = call(t, c, ts.URL, "GET", "/questions?choiceOnly=1&pageSize=100", "", 200)
	var list struct {
		Items []Question
		Total int
	}
	json.Unmarshal(out, &list)
	if list.Total != 10 || len(list.Items) != 10 {
		t.Fatal("choice library filter differs from practice pool")
	}
	call(t, c, ts.URL, "GET", "/questions/missing/choices", "", 404)
	call(t, c, ts.URL, "POST", "/choices/check", `{"items":[]}`, 400)
	call(t, c, ts.URL, "POST", "/choices/check", `{"items":[{"questionId":"ee201-t01-q001","answer":""},{"questionId":"ee201-t01-q001","answer":""}]}`, 400)
	k := studycontent.AnswerKeys["ee201-t01-q001"]
	body := fmt.Sprintf(`{"items":[{"questionId":%q,"answer":%q}]}`, k.QuestionID, "mcq:"+k.Version()+":forged-option")
	call(t, c, ts.URL, "POST", "/choices/check", body, 400)
	call(t, c, ts.URL, "POST", "/practice/sets", `{"count":1,"mode":"bad"}`, 400)
}
