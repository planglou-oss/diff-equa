package httpapi

import (
	"context"
	"eemath/internal/ai"
	"eemath/internal/legacy"
	"eemath/internal/storage"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

type fakeProvider struct {
	mu         sync.Mutex
	Calls      int
	Inputs     []ai.Input
	Fail, Wait bool
	Err        error
	Started    chan struct{}
}

func (f *fakeProvider) Stream(ctx context.Context, in ai.Input, emit func(string) error) error {
	f.mu.Lock()
	f.Calls++
	f.Inputs = append(f.Inputs, in)
	f.mu.Unlock()
	if f.Started != nil {
		close(f.Started)
	}
	if err := emit("คำใบ้ "); err != nil {
		return err
	}
	if f.Wait {
		<-ctx.Done()
		return ctx.Err()
	}
	if f.Fail {
		return errors.New("private upstream detail")
	}
	if f.Err != nil {
		return f.Err
	}
	return emit(in.QuestionID)
}
func fixture(t *testing.T, p ai.Provider) (*httptest.Server, *Server) {
	t.Helper()
	dir := t.TempDir()
	db, e := storage.Open(dir)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = legacy.Import(db, "../../../exam201_solutions.html", dir); e != nil {
		t.Fatal(e)
	}
	s := New(db, dir, dir, p)
	ts := httptest.NewServer(s)
	t.Cleanup(func() { ts.Close(); db.Close() })
	return ts, s
}
func client() *http.Client {
	jar, _ := cookiejar.New(nil)
	return &http.Client{Jar: jar, Timeout: 10 * time.Second}
}
func call(t *testing.T, c *http.Client, base, method, path, body string, status int) []byte {
	t.Helper()
	req, e := http.NewRequest(method, base+"/api/v1"+path, strings.NewReader(body))
	if e != nil {
		t.Fatal(e)
	}
	req.Header.Set("Content-Type", "application/json")
	res, e := c.Do(req)
	if e != nil {
		t.Fatal(e)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	if res.StatusCode != status {
		t.Fatalf("%s %s: got %d want %d: %s", method, path, res.StatusCode, status, b)
	}
	return b
}
func startConversation(t *testing.T, c *http.Client, base, qid string) string {
	call(t, c, base, "POST", "/session", "", 201)
	b := call(t, c, base, "POST", "/conversations", `{"questionId":"`+qid+`"}`, 201)
	var v map[string]string
	json.Unmarshal(b, &v)
	return v["id"]
}

func TestCatalogFilterPaginationAndSolutions(t *testing.T) {
	ts, _ := fixture(t, nil)
	c := client()
	b := call(t, c, ts.URL, "GET", "/catalog", "", 200)
	var catalog struct {
		Topics []struct {
			Total int `json:"totalCount"`
		}
		Available bool `json:"aiAvailable"`
	}
	json.Unmarshal(b, &catalog)
	total := 0
	for _, topic := range catalog.Topics {
		total += topic.Total
	}
	if len(catalog.Topics) != 10 || total != 427 || catalog.Available {
		t.Fatalf("bad catalog %s", b)
	}
	for _, path := range []string{"/questions?topicId=1&year=1998&examType=Midterm", "/questions?q=1998&topicId=1&examType=Midterm"} {
		b = call(t, c, ts.URL, "GET", path, "", 200)
		var result struct {
			Items []Question
			Total int
		}
		json.Unmarshal(b, &result)
		if result.Total == 0 {
			t.Fatal("expected results")
		}
		for _, q := range result.Items {
			if q.TopicID != 1 || q.Year != 1998 || q.Type != "Midterm" {
				t.Fatal("filter leaked")
			}
		}
	}
	first := call(t, c, ts.URL, "GET", "/questions?pageSize=1&page=1", "", 200)
	second := call(t, c, ts.URL, "GET", "/questions?pageSize=1&page=2", "", 200)
	var one, two struct{ Items []Question }
	json.Unmarshal(first, &one)
	json.Unmarshal(second, &two)
	if one.Items[0].ID == two.Items[0].ID {
		t.Fatal("pagination repeated item")
	}
	call(t, c, ts.URL, "GET", "/questions?page=-1", "", 400)
	call(t, c, ts.URL, "GET", "/questions?pageSize=101", "", 400)
	call(t, c, ts.URL, "GET", "/questions/nope", "", 404)
	b = call(t, c, ts.URL, "GET", "/questions/ee201-t01-q001/solutions", "", 200)
	var sol struct {
		Original    Image
		Explanation any `json:"aiExplanation"`
	}
	json.Unmarshal(b, &sol)
	if sol.Original.URL == "" || sol.Explanation == nil {
		t.Fatal("missing solution")
	}
	res, e := c.Get(ts.URL + sol.Original.URL)
	if e != nil {
		t.Fatal(e)
	}
	res.Body.Close()
	if res.StatusCode != 200 || !strings.Contains(res.Header.Get("Cache-Control"), "immutable") {
		t.Fatal("bad media")
	}
	b = call(t, c, ts.URL, "GET", "/questions/ee201-t02-q050/solutions", "", 200)
	if !strings.Contains(string(b), `"aiExplanation":null`) {
		t.Fatal("invented explanation")
	}
	call(t, c, ts.URL, "POST", "/session", `{} garbage`, 201) // session body is intentionally unused
	call(t, c, ts.URL, "POST", "/conversations", `{"questionId":"ee201-t01-q001"} garbage`, 400)
}
func TestStreamOwnershipAndIdempotency(t *testing.T) {
	p := &fakeProvider{}
	ts, s := fixture(t, p)
	a, b := client(), client()
	id := startConversation(t, a, ts.URL, "ee201-t01-q001")
	call(t, b, ts.URL, "POST", "/session", "", 201)
	call(t, b, ts.URL, "GET", "/conversations/"+id+"/messages", "", 404)
	call(t, b, ts.URL, "POST", "/conversations/"+id+"/messages", `{"message":"hello","clientRequestId":"request-123"}`, 404)
	body := `{"message":"ขอคำใบ้","clientRequestId":"request-123"}`
	out := call(t, a, ts.URL, "POST", "/conversations/"+id+"/messages", body, 200)
	if !strings.Contains(string(out), "event: done") || !strings.Contains(string(out), "ee201-t01-q001") {
		t.Fatal("missing SSE events")
	}
	call(t, a, ts.URL, "POST", "/conversations/"+id+"/messages", body, 200)
	if p.Calls != 1 {
		t.Fatal("duplicate called upstream")
	}
	out = call(t, a, ts.URL, "GET", "/conversations/"+id+"/messages", "", 200)
	var messages struct {
		Items []struct{ Role, Content, Status string }
	}
	json.Unmarshal(out, &messages)
	if len(messages.Items) != 2 || messages.Items[1].Status != "completed" {
		t.Fatal("not saved")
	}
	call(t, a, ts.URL, "POST", "/conversations/"+id+"/messages", `{"message":"ต่อเลย","clientRequestId":"request-456"}`, 200)
	if len(p.Inputs[1].History) != 2 || !strings.Contains(p.Inputs[1].QuestionText, "y^2") {
		t.Fatal("lost history/question text")
	}
	req, _ := http.NewRequest("POST", ts.URL+"/api/v1/session", nil)
	req.Header.Set("Origin", "https://another.example")
	res, e := a.Do(req)
	if e != nil {
		t.Fatal(e)
	}
	res.Body.Close()
	if res.StatusCode != 403 {
		t.Fatal("cross origin mutation accepted")
	}
	// A new conversation must not inherit history from another question.
	out = call(t, a, ts.URL, "POST", "/conversations", `{"questionId":"ee201-t02-q001"}`, 201)
	var other map[string]string
	json.Unmarshal(out, &other)
	call(t, a, ts.URL, "POST", "/conversations/"+other["id"]+"/messages", body, 200)
	if len(p.Inputs[2].History) != 0 || p.Inputs[2].QuestionID != "ee201-t02-q001" {
		t.Fatal("cross-question history leak")
	}
	s.DB.Exec(`UPDATE browser_sessions SET expires_at=0`)
	s.Cleanup()
	call(t, a, ts.URL, "GET", "/conversations/"+id+"/messages", "", 404)
}
func TestProviderFailureAndDisabledAI(t *testing.T) {
	p := &fakeProvider{Fail: true}
	ts, _ := fixture(t, p)
	c := client()
	id := startConversation(t, c, ts.URL, "ee201-t01-q001")
	out := call(t, c, ts.URL, "POST", "/conversations/"+id+"/messages", `{"message":"test","clientRequestId":"failure-123"}`, 200)
	if !strings.Contains(string(out), "event: error") || strings.Contains(string(out), "private upstream") {
		t.Fatal("bad upstream error")
	}
	p.Fail = false
	call(t, c, ts.URL, "POST", "/conversations/"+id+"/messages", `{"message":"again","clientRequestId":"failure-456"}`, 200)
	if len(p.Inputs[1].History) != 0 {
		t.Fatal("partial answer in history")
	}
	ts2, _ := fixture(t, nil)
	c2 := client()
	id2 := startConversation(t, c2, ts2.URL, "ee201-t01-q001")
	call(t, c2, ts2.URL, "POST", "/conversations/"+id2+"/messages", `{"message":"test","clientRequestId":"disabled-123"}`, 503)
}
func TestCancelMarksInterrupted(t *testing.T) {
	p := &fakeProvider{Wait: true, Started: make(chan struct{})}
	ts, s := fixture(t, p)
	c := client()
	id := startConversation(t, c, ts.URL, "ee201-t01-q001")
	ctx, cancel := context.WithCancel(context.Background())
	req, _ := http.NewRequestWithContext(ctx, "POST", ts.URL+"/api/v1/conversations/"+id+"/messages", strings.NewReader(`{"message":"test","clientRequestId":"cancel-123"}`))
	res, e := c.Do(req)
	if e != nil {
		t.Fatal(e)
	}
	<-p.Started
	call(t, c, ts.URL, "POST", "/conversations/"+id+"/messages", `{"message":"again","clientRequestId":"cancel-456"}`, 409)
	cancel()
	res.Body.Close()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		var status string
		s.DB.QueryRow(`SELECT status FROM generation_requests WHERE conversation_id=?`, id).Scan(&status)
		if status == "interrupted" {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal(fmt.Sprintf("request not interrupted: %s", id))
}

func TestQuotaPreventsProviderCall(t *testing.T) {
	p := &fakeProvider{}
	ts, s := fixture(t, p)
	c := client()
	id := startConversation(t, c, ts.URL, "ee201-t01-q001")
	for i := 0; i < 30; i++ {
		_, err := s.DB.Exec(`INSERT INTO generation_requests(conversation_id,client_request_id,status,message_id,created_at) VALUES(?,?,?,?,?)`, id, fmt.Sprintf("previous-%d", i), "completed", "saved-message", time.Now().Unix())
		if err != nil {
			t.Fatal(err)
		}
	}
	call(t, c, ts.URL, "POST", "/conversations/"+id+"/messages", `{"message":"help","clientRequestId":"over-quota-123"}`, 429)
	if p.Calls != 0 {
		t.Fatal("quota called provider")
	}
}

func TestProviderCodeSavedAndFontCSP(t *testing.T) {
	p := &fakeProvider{Err: &ai.Error{Code: "AI_PROVIDER_QUOTA", Message: "Gemini quota reached", Status: 429}}
	ts, s := fixture(t, p)
	c := client()
	id := startConversation(t, c, ts.URL, "ee201-t01-q001")
	out := call(t, c, ts.URL, "POST", "/conversations/"+id+"/messages", `{"message":"help","clientRequestId":"quota-upstream-123"}`, 200)
	if !strings.Contains(string(out), `"code":"AI_PROVIDER_QUOTA"`) {
		t.Fatalf("lost error code: %s", out)
	}
	var code string
	s.DB.QueryRow(`SELECT error_code FROM generation_requests WHERE conversation_id=?`, id).Scan(&code)
	if code != "AI_PROVIDER_QUOTA" {
		t.Fatal(code)
	}
	res, e := c.Get(ts.URL + "/api/v1/health")
	if e != nil {
		t.Fatal(e)
	}
	defer res.Body.Close()
	csp := res.Header.Get("Content-Security-Policy")
	if !strings.Contains(csp, "font-src 'self' data:") || !strings.Contains(csp, "script-src 'self';") {
		t.Fatalf("unexpected CSP: %s", csp)
	}
}

func TestSilentStreamHeartbeatAndCancel(t *testing.T) {
	p := &fakeProvider{Wait: true}
	sentinel := errors.New("connection closed")
	count := 0
	err := streamWithHeartbeat(context.Background(), p, ai.Input{}, func(string) error { return nil }, func() error { count++; return sentinel }, 5*time.Millisecond)
	if !errors.Is(err, sentinel) || count != 1 {
		t.Fatalf("heartbeat failed: %v %d", err, count)
	}
}

func TestTextContextAndShortHistory(t *testing.T) {
	p := &fakeProvider{}
	ts, _ := fixture(t, p)
	c := client()
	id := startConversation(t, c, ts.URL, "ee201-t01-q002")
	b := call(t, c, ts.URL, "GET", "/questions/ee201-t01-q002/context", "", 200)
	var context struct{ QuestionID, Text, Source, ReviewStatus string }
	json.Unmarshal(b, &context)
	if context.QuestionID != "ee201-t01-q002" || !strings.Contains(context.Text, "4y'+5y=f(x)") || context.ReviewStatus != "reviewed" {
		t.Fatalf("bad context: %s", b)
	}
	call(t, c, ts.URL, "GET", "/questions/nope/context", "", 404)
	for i := 0; i < 4; i++ {
		call(t, c, ts.URL, "POST", "/conversations/"+id+"/messages", fmt.Sprintf(`{"message":"question-%d","clientRequestId":"context-test-%d"}`, i, i), 200)
	}
	if len(p.Inputs[3].History) != 4 || p.Inputs[3].History[0].Content != "question-1" {
		t.Fatalf("history not limited to two exchanges: %+v", p.Inputs[3].History)
	}
	call(t, c, ts.URL, "POST", "/conversations/"+id+"/messages", `{"message":"help","questionText":"Solve y'=2x, y(0)=1.","clientRequestId":"context-edit-123"}`, 200)
	if p.Inputs[4].QuestionText != "Solve y'=2x, y(0)=1." || p.Inputs[4].QuestionID != "ee201-t01-q002" {
		t.Fatal("edited text lost question scope")
	}
	call(t, c, ts.URL, "POST", "/conversations/"+id+"/messages", `{"message":"help","questionText":"  ","clientRequestId":"context-empty-123"}`, 400)
}
