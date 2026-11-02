package httpapi

import (
	"eemath/internal/studycontent"
	"encoding/json"
	"fmt"
	"testing"
)

func TestBVPExplanationsCoverageFlagsAndAPI(t *testing.T) {
	ts, s := fixture(t, nil)
	for i := 0; i < 2; i++ {
		if err := studycontent.SeedExplanations(s.DB); err != nil {
			t.Fatal(err)
		}
	}
	var count int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM questions q JOIN explanations e ON e.question_id=q.id WHERE q.topic_id=9`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 25 {
		t.Fatalf("coverage %d/25", count)
	}
	c := client()
	for n := 1; n <= 25; n++ {
		id := fmt.Sprintf("ee201-t09-q%03d", n)
		b := call(t, c, ts.URL, "GET", "/questions/"+id+"/solutions", "", 200)
		var result struct {
			AIExplanation *struct{ BodyHTML, ReviewStatus string }
		}
		if err := json.Unmarshal(b, &result); err != nil {
			t.Fatal(err)
		}
		expected := "ai_checked"
		if n == 15 || n == 22 {
			expected = "needs_clarification"
		}
		if result.AIExplanation == nil || len(result.AIExplanation.BodyHTML) < 400 || result.AIExplanation.ReviewStatus != expected {
			t.Fatalf("missing explanation or wrong review status: %s", id)
		}
	}
}

func TestBVPExplanationsPreserveEditsAndRequireOriginalScans(t *testing.T) {
	_, s := fixture(t, nil)
	for _, row := range []struct{ id, body, status string }{
		{"ee201-t09-q001", "instructor correction", "reviewed"},
		{"ee201-t09-q002", "my own working", "unreviewed"},
	} {
		if _, err := s.DB.Exec(`INSERT INTO explanations(question_id,body_html,review_status) VALUES(?,?,?) ON CONFLICT(question_id) DO UPDATE SET body_html=excluded.body_html,review_status=excluded.review_status`, row.id, row.body, row.status); err != nil {
			t.Fatal(err)
		}
	}
	for _, row := range []struct{ id, role string }{{"ee201-t09-q003", "question"}, {"ee201-t09-q004", "original_solution"}} {
		if _, err := s.DB.Exec(`UPDATE question_media SET media_id=(SELECT media_id FROM question_media WHERE question_id='ee201-t09-q005' AND role=?) WHERE question_id=? AND role=?`, row.role, row.id, row.role); err != nil {
			t.Fatal(err)
		}
	}
	if err := studycontent.SeedExplanations(s.DB); err != nil {
		t.Fatal(err)
	}
	var body, status string
	for _, row := range []struct{ id, body, status string }{
		{"ee201-t09-q001", "instructor correction", "reviewed"},
		{"ee201-t09-q002", "my own working", "unreviewed"},
	} {
		if err := s.DB.QueryRow(`SELECT body_html,review_status FROM explanations WHERE question_id=?`, row.id).Scan(&body, &status); err != nil {
			t.Fatal(err)
		}
		if body != row.body || status != row.status {
			t.Fatalf("custom content replaced: %s", row.id)
		}
	}
	var count int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM explanations WHERE question_id IN ('ee201-t09-q003','ee201-t09-q004')`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatal("mismatched scans accepted")
	}
	// A source change after review must invalidate the warning/check status.
	if _, err := s.DB.Exec(`UPDATE question_media SET media_id=(SELECT media_id FROM question_media WHERE question_id='ee201-t09-q005' AND role='question') WHERE question_id='ee201-t09-q022' AND role='question'`); err != nil {
		t.Fatal(err)
	}
	if err := studycontent.SeedExplanations(s.DB); err != nil {
		t.Fatal(err)
	}
	if err := s.DB.QueryRow(`SELECT review_status FROM explanations WHERE question_id='ee201-t09-q022'`).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "unreviewed" {
		t.Fatal("stale boundary inconsistency status retained after scan changed")
	}
}
