package ai

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestGeminiTextOnlyRequestAndStream(t *testing.T) {
	g := &Gemini{Key: "test-secret", Model: "test-model", Client: &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host != "generativelanguage.googleapis.com" || r.Header.Get("x-goog-api-key") != "test-secret" || strings.Contains(r.URL.String(), "test-secret") {
			t.Fatal("bad provider request")
		}
		var body map[string]any
		if e := json.NewDecoder(r.Body).Decode(&body); e != nil {
			t.Fatal(e)
		}
		contents := body["contents"].([]any)
		parts := contents[0].(map[string]any)["parts"].([]any)
		if len(parts) != 2 || !strings.Contains(parts[0].(map[string]any)["text"].(string), "4y'+5y=f(x)") {
			t.Fatal("missing selected-question text")
		}
		encoded, _ := json.Marshal(body)
		if strings.Contains(string(encoded), "inline_data") || strings.Contains(string(encoded), "inlineData") || strings.Contains(string(encoded), "image/png") {
			t.Fatal("image attachment leaked into text-only request")
		}
		if _, ok := body["system_instruction"]; !ok {
			t.Fatal("missing system instruction")
		}
		stream := `: keepalive

data: {"candidates":[{"content":{"parts":[{"text":"hidden","thought":true},{"text":"คำใบ้ "}]}}]}

data: {"candidates":[{"content":{"parts":[{"text":"$y=1$"}]},"finishReason":"STOP"}]}

`
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(stream)), Header: http.Header{}}, nil
	})}}
	answer := ""
	e := g.Stream(context.Background(), Input{QuestionID: "q1", Topic: "ODE", QuestionText: "4y'+5y=f(x)", Message: "help"}, func(s string) error { answer += s; return nil })
	if e != nil || answer != "คำใบ้ $y=1$" {
		t.Fatalf("unexpected answer %q, %v", answer, e)
	}
}

func TestGeminiFailuresHaveActionableCodes(t *testing.T) {
	cases := []struct {
		name       string
		status     int
		body, code string
	}{
		{"quota", 429, `{"error":{"message":"private"}}`, "AI_PROVIDER_QUOTA"},
		{"key", 403, `{"error":{}}`, "AI_ACCESS_DENIED"},
		{"model", 404, `{"error":{}}`, "AI_MODEL_NOT_FOUND"},
		{"config", 400, `{"error":{}}`, "AI_INVALID_CONFIG"},
		{"empty", 200, "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"hidden\",\"thought\":true}]},\"finishReason\":\"STOP\"}]}\n\n", "AI_EMPTY_RESPONSE"},
		{"limit", 200, "data: {\"candidates\":[{\"finishReason\":\"MAX_TOKENS\"}]}\n\n", "AI_OUTPUT_LIMIT"},
		{"blocked", 200, "data: {\"promptFeedback\":{\"blockReason\":\"SAFETY\"}}\n\n", "AI_RESPONSE_BLOCKED"},
		{"broken_stream", 200, "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"partial\"}]}}]}\n\n", "AI_STREAM_INTERRUPTED"},
		{"stream_error", 200, "data: {\"error\":{\"code\":429,\"message\":\"private\"}}\n\n", "AI_PROVIDER_QUOTA"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			g := &Gemini{Model: "test", Client: &http.Client{Transport: transportFunc(func(*http.Request) (*http.Response, error) {
				return &http.Response{StatusCode: tc.status, Body: io.NopCloser(strings.NewReader(tc.body)), Header: http.Header{}}, nil
			})}}
			err := g.Stream(context.Background(), Input{}, func(string) error { return nil })
			if err == nil {
				t.Fatal("expected error")
			}
			code, message := PublicError(err)
			if code != tc.code || message == "" || strings.Contains(message, "private") {
				t.Fatalf("unexpected diagnostic %s %s", code, message)
			}
		})
	}
}

func TestGeminiThinkingDefaults(t *testing.T) {
	for _, tc := range []struct{ model, level, want string }{{"gemini-3.6-flash", "", "LOW"}, {"gemini-3.6-flash", "default", ""}, {"gemini-3.6-flash", "high", "HIGH"}, {"gemini-2.5-flash", "", ""}} {
		t.Run(tc.model+tc.level, func(t *testing.T) {
			g := &Gemini{Model: tc.model, ThinkingLevel: tc.level, Client: &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
				var body struct {
					GenerationConfig struct {
						MaxOutputTokens int
						ThinkingConfig  struct{ ThinkingLevel string }
					}
				}
				if e := json.NewDecoder(r.Body).Decode(&body); e != nil {
					t.Fatal(e)
				}
				if body.GenerationConfig.ThinkingConfig.ThinkingLevel != tc.want || body.GenerationConfig.MaxOutputTokens != 4096 {
					t.Fatalf("unexpected config: %+v", body)
				}
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader("data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"ok\"}]},\"finishReason\":\"STOP\"}]}\n\n")), Header: http.Header{}}, nil
			})}}
			if e := g.Stream(context.Background(), Input{}, func(string) error { return nil }); e != nil {
				t.Fatal(e)
			}
		})
	}
}
func TestGeminiDoesNotLeakUpstreamError(t *testing.T) {
	g := &Gemini{Key: "secret", Model: "test", Client: &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 403, Body: io.NopCloser(strings.NewReader(`{"error":"sensitive upstream"}`)), Header: http.Header{}}, nil
	})}}
	e := g.Stream(context.Background(), Input{}, func(string) error { return nil })
	if e == nil || strings.Contains(e.Error(), "sensitive") {
		t.Fatalf("bad error: %v", e)
	}
}
