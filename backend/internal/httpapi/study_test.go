package httpapi

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

func TestPracticeSelectionIsScopedUniqueAndExcludesMastered(t *testing.T) {
	ts, _ := fixture(t, nil)
	c := client()
	body := `{"topicId":1,"count":50,"excludeIds":["ee201-t01-q001"]}`
	out := call(t, c, ts.URL, "POST", "/practice/sets", body, 200)
	var result struct {
		Items     []Question
		Available int
	}
	json.Unmarshal(out, &result)
	if len(result.Items) != 50 || result.Available != 55 {
		t.Fatalf("bad selection %d/%d", len(result.Items), result.Available)
	}
	seen := map[string]bool{}
	for _, q := range result.Items {
		if q.TopicID != 1 || q.ID == "ee201-t01-q001" || seen[q.ID] {
			t.Fatal("invalid or duplicate question")
		}
		seen[q.ID] = true
	}
	out = call(t, c, ts.URL, "POST", "/practice/sets", `{"topicId":1,"count":5,"includeIds":["ee201-t01-q002","ee201-t02-q001"]}`, 200)
	json.Unmarshal(out, &result)
	if len(result.Items) != 1 || result.Items[0].ID != "ee201-t01-q002" {
		t.Fatal("include/topic intersection failed")
	}
	out = call(t, c, ts.URL, "POST", "/practice/sets", `{"count":5,"includeIds":[]}`, 200)
	if !strings.Contains(string(out), `"items":[]`) {
		t.Fatal("empty favorites selected all questions")
	}
	for _, body := range []string{`{"count":0}`, `{"count":51}`, `{"count":1,"topicId":10}`} {
		call(t, c, ts.URL, "POST", "/practice/sets", body, 400)
	}
}
func TestGuideAliasesAndPersonalIDFilters(t *testing.T) {
	ts, _ := fixture(t, nil)
	c := client()
	out := call(t, c, ts.URL, "GET", "/guides", "", 200)
	var guides struct {
		Items []struct {
			TopicID       int
			Formulas      []any
			Hints, Checks []string
		}
		QuestionHints map[string][]string
	}
	json.Unmarshal(out, &guides)
	if len(guides.Items) != 9 || len(guides.QuestionHints["ee201-t01-q002"]) != 3 {
		t.Fatal("missing guides")
	}
	for _, g := range guides.Items {
		if len(g.Formulas) == 0 || len(g.Hints) != 3 || len(g.Checks) == 0 {
			t.Fatal("incomplete guide")
		}
	}
	out = call(t, c, ts.URL, "GET", "/questions?q=%E0%B8%A5%E0%B8%B2%E0%B8%9B%E0%B8%A5%E0%B8%B2%E0%B8%8B&pageSize=100", "", 200)
	var list struct {
		Items []Question
		Total int
	}
	json.Unmarshal(out, &list)
	if list.Total != 71 {
		t.Fatalf("Thai search alias: %d", list.Total)
	}
	for _, q := range list.Items {
		if q.TopicID != 7 || len(q.Tags) == 0 {
			t.Fatal("alias results wrong")
		}
	}
	out = call(t, c, ts.URL, "GET", "/questions?ids=ee201-t01-q001,ee201-t02-q001&excludeIds=ee201-t02-q001", "", 200)
	json.Unmarshal(out, &list)
	if list.Total != 1 || list.Items[0].ID != "ee201-t01-q001" {
		t.Fatal("personal filter failed")
	}
	out = call(t, c, ts.URL, "GET", "/questions?ids=", "", 200)
	if !strings.Contains(string(out), `"total":0`) {
		t.Fatal("empty id filter leaked")
	}
}
func TestErrorReportRequiresSessionAndPersistsWithoutChangingReview(t *testing.T) {
	ts, s := fixture(t, nil)
	c := client()
	path := "/questions/ee201-t01-q001/reports"
	body := `{"kind":"ai_explanation","description":"Please check the sign in step 2"}`
	call(t, c, ts.URL, "POST", path, body, 401)
	call(t, c, ts.URL, "POST", "/session", "", 201)
	out := call(t, c, ts.URL, "POST", path, body, 201)
	var v map[string]string
	json.Unmarshal(out, &v)
	if v["status"] != "recorded" || v["id"] == "" {
		t.Fatal(string(out))
	}
	var kind, description, status string
	if e := s.DB.QueryRow(`SELECT kind,description FROM reports WHERE id=?`, v["id"]).Scan(&kind, &description); e != nil || kind != "ai_explanation" || !strings.Contains(description, "step 2") {
		t.Fatal(e)
	}
	s.DB.QueryRow(`SELECT review_status FROM explanations WHERE question_id='ee201-t01-q001'`).Scan(&status)
	if status != "unreviewed" {
		t.Fatal("report silently verified explanation")
	}
	call(t, c, ts.URL, "POST", path, `{"kind":"wrong","description":"test"}`, 400)
	call(t, c, ts.URL, "POST", "/questions/nope/reports", body, 404)
	for i := 0; i < 19; i++ {
		call(t, c, ts.URL, "POST", path, fmt.Sprintf(`{"kind":"question","description":"test report %d"}`, i), 201)
	}
	call(t, c, ts.URL, "POST", path, body, 429)
}
