package httpapi

import (
	"eemath/internal/studycontent"
	"encoding/json"
	"testing"
)

func TestLaplaceExplanationsCoverEveryQuestionAndPreserveExisting(t *testing.T) {
	ts, s := fixture(t, nil)
	var before string
	if err := s.DB.QueryRow(`SELECT body_html FROM explanations WHERE question_id='ee201-t07-q001'`).Scan(&before); err != nil {
		t.Fatal(err)
	}
	before += "<p>Custom human-reviewed note</p>"
	if _, err := s.DB.Exec(`UPDATE explanations SET body_html=?,review_status='reviewed' WHERE question_id='ee201-t07-q001'`, before); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err := studycontent.SeedExplanations(s.DB); err != nil {
			t.Fatal(err)
		}
	}
	var total, ready int
	if err := s.DB.QueryRow(`SELECT COUNT(*),COUNT(e.question_id) FROM questions q LEFT JOIN explanations e ON e.question_id=q.id WHERE q.topic_id=7`).Scan(&total, &ready); err != nil {
		t.Fatal(err)
	}
	if total != 71 || ready != total {
		t.Fatalf("coverage %d/%d", ready, total)
	}
	var after string
	s.DB.QueryRow(`SELECT body_html FROM explanations WHERE question_id='ee201-t07-q001'`).Scan(&after)
	if after != before {
		t.Fatal("seed replaced existing explanation")
	}
	c := client()
	for _, id := range []string{"ee201-t07-q006", "ee201-t07-q071"} {
		b := call(t, c, ts.URL, "GET", "/questions/"+id+"/solutions", "", 200)
		var result struct {
			AIExplanation *struct {
				BodyHTML     string
				ReviewStatus string
			}
		}
		if err := json.Unmarshal(b, &result); err != nil {
			t.Fatal(err)
		}
		if result.AIExplanation == nil || len(result.AIExplanation.BodyHTML) < 200 || result.AIExplanation.ReviewStatus != "ai_checked" {
			t.Fatal("missing explanation or incorrect review status")
		}
	}
	b := call(t, c, ts.URL, "GET", "/questions/ee201-t07-q065/solutions", "", 200)
	var flagged struct {
		AIExplanation *struct{ ReviewStatus string }
	}
	json.Unmarshal(b, &flagged)
	if flagged.AIExplanation == nil || flagged.AIExplanation.ReviewStatus != "needs_clarification" {
		t.Fatal("inconsistent problem must stay flagged")
	}
}

func TestLaplaceReviewSourceAndEditGuards(t *testing.T) {
	_, s := fixture(t, nil)
	// A changed question image or original solution invalidates that authored item.
	for _, entry := range []struct{ id, role string }{{"ee201-t07-q006", "original_solution"}, {"ee201-t07-q008", "question"}} {
		_, err := s.DB.Exec(`UPDATE question_media SET media_id=(SELECT media_id FROM question_media WHERE question_id='ee201-t07-q007' AND role=?) WHERE question_id=? AND role=?`, entry.role, entry.id, entry.role)
		if err != nil {
			t.Fatal(err)
		}
	}
	_, err := s.DB.Exec(`INSERT INTO explanations(question_id,body_html,review_status) VALUES('ee201-t07-q009','custom draft','unreviewed')`)
	if err != nil {
		t.Fatal(err)
	}
	var old string
	s.DB.QueryRow(`SELECT body_html FROM explanations WHERE question_id='ee201-t07-q001'`).Scan(&old)
	if err = studycontent.SeedExplanations(s.DB); err != nil {
		t.Fatal(err)
	}
	var count int
	s.DB.QueryRow(`SELECT COUNT(*) FROM explanations WHERE question_id IN ('ee201-t07-q006','ee201-t07-q008')`).Scan(&count)
	if count != 0 {
		t.Fatal("changed scan accepted as reviewed content")
	}
	var body, status string
	s.DB.QueryRow(`SELECT body_html,review_status FROM explanations WHERE question_id='ee201-t07-q009'`).Scan(&body, &status)
	if body != "custom draft" || status != "unreviewed" {
		t.Fatal("custom draft replaced")
	}
	s.DB.QueryRow(`SELECT body_html,review_status FROM explanations WHERE question_id='ee201-t07-q001'`).Scan(&body, &status)
	if body == old || status != "ai_checked" {
		t.Fatal("known legacy explanation was not upgraded")
	}
	_, err = s.DB.Exec(`UPDATE question_media SET media_id=(SELECT media_id FROM question_media WHERE question_id='ee201-t07-q001' AND role='question') WHERE question_id='ee201-t07-q007' AND role='question'`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = s.DB.Exec(`UPDATE explanations SET body_html='changed after AI review' WHERE question_id='ee201-t07-q010'`)
	if err != nil {
		t.Fatal(err)
	}
	if err = studycontent.SeedExplanations(s.DB); err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{"ee201-t07-q007", "ee201-t07-q010"} {
		s.DB.QueryRow(`SELECT review_status FROM explanations WHERE question_id=?`, id).Scan(&status)
		if status != "unreviewed" {
			t.Fatal("stale AI review was not invalidated")
		}
	}
}
