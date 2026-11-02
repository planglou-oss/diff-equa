// export-static builds public study content from source using a fresh database.
// It never opens the user's data directory or reads .env.
package main

import (
	"crypto/sha256"
	"eemath/internal/httpapi"
	"eemath/internal/legacy"
	"eemath/internal/storage"
	"eemath/internal/studycontent"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
)

func run(source, output string) error {
	temp, err := os.MkdirTemp("", "eemath-static-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(temp)
	db, err := storage.Open(temp)
	if err != nil {
		return err
	}
	defer db.Close()
	if _, err = legacy.Import(db, source, temp); err != nil {
		return err
	}
	if err = studycontent.SeedExplanations(db); err != nil {
		return err
	}
	server := httpapi.New(db, temp, "", nil)
	read := func(path string, target any) error {
		response := httptest.NewRecorder()
		server.ServeHTTP(response, httptest.NewRequest("GET", "/api/v1"+path, nil))
		if response.Code != 200 {
			return fmt.Errorf("export %s: HTTP %d", path, response.Code)
		}
		return json.Unmarshal(response.Body.Bytes(), target)
	}
	var catalog, guides any
	if err = read("/catalog", &catalog); err != nil {
		return err
	}
	if err = read("/guides", &guides); err != nil {
		return err
	}
	questions := []httpapi.Question{}
	for page := 1; ; page++ {
		var list struct {
			Items []httpapi.Question `json:"items"`
			Total int                `json:"total"`
		}
		if err = read(fmt.Sprintf("/questions?pageSize=100&page=%d", page), &list); err != nil {
			return err
		}
		questions = append(questions, list.Items...)
		if len(questions) >= list.Total {
			break
		}
	}
	solutions := map[string]any{}
	contexts := map[string]any{}
	choices := map[string]any{}
	grading := map[string]any{}
	search := map[string]string{}
	media := map[string]bool{}
	for i := range questions {
		q := &questions[i]
		var solution, context any
		if err = read("/questions/"+q.ID+"/solutions", &solution); err != nil {
			return err
		}
		if err = read("/questions/"+q.ID+"/context", &context); err != nil {
			return err
		}
		solutions[q.ID] = solution
		contexts[q.ID] = context
		var raw string
		if err = db.QueryRow(`SELECT search_text_raw FROM questions WHERE id=?`, q.ID).Scan(&raw); err != nil {
			return err
		}
		search[q.ID] = strings.ToLower(fmt.Sprintf("%s %s %d %s %s ข้อ%d %s %s", raw, q.Date, q.Year, q.TypeRaw, q.Source, q.Number, q.Topic, strings.Join(q.Tags, " ")))
		media[strings.TrimPrefix(q.Image.URL, "/media/")] = true
		q.Image.URL = "/study" + q.Image.URL
		var choice struct {
			Available bool                        `json:"available"`
			Options   []studycontent.PublicOption `json:"options"`
		}
		var public any
		if err = read("/questions/"+q.ID+"/choices", &public); err != nil {
			return err
		}
		b, _ := json.Marshal(public)
		if err = json.Unmarshal(b, &choice); err != nil {
			return err
		}
		if choice.Available {
			choices[q.ID] = public
			grades := map[string]any{}
			key := studycontent.AnswerKeys[q.ID]
			for _, option := range choice.Options {
				body, _ := json.Marshal(map[string]any{"items": []map[string]string{{"questionId": q.ID, "answer": "mcq:" + key.Version() + ":" + option.ID}}})
				response := httptest.NewRecorder()
				server.ServeHTTP(response, httptest.NewRequest("POST", "/api/v1/choices/check", strings.NewReader(string(body))))
				var result struct {
					Items []map[string]any `json:"items"`
				}
				if response.Code != 200 {
					return fmt.Errorf("grading export failed: %s", q.ID)
				}
				if err = json.Unmarshal(response.Body.Bytes(), &result); err != nil {
					return err
				}
				grades[option.ID] = result.Items[0]
			}
			grading[q.ID] = grades
		}
	}
	rows, err := db.Query(`SELECT media_id FROM question_media`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id string
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		media[id+".png"] = true
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	dataset := map[string]any{"schemaVersion": 1, "catalog": catalog, "guides": guides, "questions": questions, "solutions": solutions, "contexts": contexts, "choices": choices, "grading": grading, "search": search}
	bytes, err := json.Marshal(dataset)
	if err != nil {
		return err
	}
	// API responses contain media URLs; export images under the same static prefix.
	// Question URLs have already been prefixed, so replace only unprefixed values.
	bytes = []byte(strings.ReplaceAll(string(bytes), `"/media/`, `"/study/media/`))
	hash := sha256.Sum256(bytes)
	if err = os.MkdirAll(filepath.Join(output, "media"), 0755); err != nil {
		return err
	}
	if err = os.WriteFile(filepath.Join(output, "data.json"), bytes, 0644); err != nil {
		return err
	}
	for name := range media {
		if err = copyFile(filepath.Join(temp, "media", name), filepath.Join(output, "media", name)); err != nil {
			return err
		}
	}
	if err = copyFile(filepath.Join(temp, "mascot.png"), filepath.Join(output, "mascot.png")); err != nil {
		return err
	}
	metadata, _ := json.MarshalIndent(map[string]any{"schemaVersion": 1, "sha256": hex.EncodeToString(hash[:]), "questions": len(questions), "media": len(media), "choiceQuestions": len(choices)}, "", "  ")
	if err = os.WriteFile(filepath.Join(output, "manifest.json"), append(metadata, '\n'), 0644); err != nil {
		return err
	}
	log.Printf("Exported %d questions, %d unique images, %d choice keys to %s", len(questions), len(media), len(choices), output)
	return nil
}
func copyFile(source, dest string) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	output, err := os.Create(dest)
	if err != nil {
		return err
	}
	_, err = io.Copy(output, input)
	closeErr := output.Close()
	if err != nil {
		return err
	}
	return closeErr
}
func main() {
	source := flag.String("source", "../exam201_solutions.html", "legacy source")
	out := flag.String("out", "../frontend/public/study", "public content directory")
	flag.Parse()
	if err := run(*source, *out); err != nil {
		log.Fatal(err)
	}
}
