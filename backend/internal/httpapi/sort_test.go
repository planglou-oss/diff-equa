package httpapi

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

func TestYearSortingAcrossPagesAndFilters(t *testing.T) {
	ts, _ := fixture(t, nil)
	c := client()
	for _, direction := range []string{"year_asc", "year_desc"} {
		seen := map[string]bool{}
		var previous *Question
		for page := 1; page <= 5; page++ {
			b := call(t, c, ts.URL, "GET", fmt.Sprintf("/questions?sort=%s&pageSize=100&page=%d", direction, page), "", 200)
			var out struct {
				Items []Question
				Total int
			}
			json.Unmarshal(b, &out)
			if out.Total != 427 {
				t.Fatal("sort changed total")
			}
			for _, q := range out.Items {
				if seen[q.ID] {
					t.Fatal("duplicate across pages")
				}
				seen[q.ID] = true
				if previous != nil {
					a := *previous
					if (direction == "year_asc" && a.Year > q.Year) || (direction == "year_desc" && a.Year < q.Year) {
						t.Fatal("years out of order")
					}
					if a.Year == q.Year && (a.TopicID > q.TopicID || (a.TopicID == q.TopicID && (a.Number > q.Number || (a.Number == q.Number && a.ID > q.ID)))) {
						t.Fatal("unstable tie order")
					}
				}
				copy := q
				previous = &copy
			}
		}
		if len(seen) != 427 {
			t.Fatal("missing sorted questions")
		}
		b := call(t, c, ts.URL, "GET", "/questions?topicId=1&examType=Quiz&sort="+direction, "", 200)
		var out struct{ Items []Question }
		json.Unmarshal(b, &out)
		if len(out.Items) == 0 {
			t.Fatal("expected filtered results")
		}
		for _, q := range out.Items {
			if q.TopicID != 1 || q.Type != "Quiz" {
				t.Fatal("sort lost filters")
			}
		}
	}
	b := call(t, c, ts.URL, "GET", "/questions?sort=year%20DESC%3BDROP%20TABLE%20questions", "", 400)
	if !strings.Contains(string(b), "INVALID_SORT") {
		t.Fatal("unvalidated sort")
	}
}
