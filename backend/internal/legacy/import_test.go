package legacy

import (
	"bytes"
	"crypto/sha256"
	"eemath/internal/storage"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"testing"
)

func TestRealSourceImportAndRepeat(t *testing.T) {
	dir := t.TempDir()
	db, err := storage.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	sourcePath := "../../../exam201_solutions.html"
	report, err := Import(db, sourcePath, dir)
	if err != nil {
		t.Fatal(err)
	}
	if report.Topics != 10 || report.Questions != 427 || report.Images != 854 || report.Explanations != 10 {
		t.Fatalf("unexpected report: %+v", report)
	}
	raw, _ := os.ReadFile(sourcePath)
	loc := regexp.MustCompile(`const\s+D\s*=\s*`).FindIndex(raw)
	var d source
	if err = json.NewDecoder(bytes.NewReader(raw[loc[1]:])).Decode(&d); err != nil {
		t.Fatal(err)
	}
	for _, item := range d.Items {
		for _, encoded := range []string{item.Q, item.S} {
			b, e := base64.StdEncoding.DecodeString(encoded)
			if e != nil {
				t.Fatal(e)
			}
			h := sha256.Sum256(b)
			file, e := os.ReadFile(filepath.Join(dir, "media", hex.EncodeToString(h[:])+".png"))
			if e != nil || !bytes.Equal(file, b) {
				t.Fatal("image bytes changed")
			}
		}
	}
	var firstID string
	if err = db.QueryRow(`SELECT id FROM questions WHERE legacy_key='1-1'`).Scan(&firstID); err != nil {
		t.Fatal(err)
	}
	again, err := Import(db, sourcePath, dir)
	if err != nil || again.Checksum != report.Checksum {
		t.Fatalf("repeat: %v", err)
	}
	for table, want := range map[string]int{"topics": 10, "questions": 427, "question_media": 854, "explanations": 10, "imports": 1} {
		var n int
		if err = db.QueryRow(`SELECT COUNT(*) FROM ` + table).Scan(&n); err != nil || n != want {
			t.Fatalf("%s: got %d want %d err %v", table, n, want, err)
		}
	}
	var secondID string
	db.QueryRow(`SELECT id FROM questions WHERE legacy_key='1-1'`).Scan(&secondID)
	if firstID != secondID {
		t.Fatal("unstable ID")
	}
}

func TestImportRejectsOrphanWithoutPartialDB(t *testing.T) {
	dir := t.TempDir()
	db, e := storage.Open(dir)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	raw, e := os.ReadFile("../../../exam201_solutions.html")
	if e != nil {
		t.Fatal(e)
	}
	raw = bytes.Replace(raw, []byte(`const A={`), []byte(`const A={"999-999":"bad",`), 1)
	path := filepath.Join(dir, "bad.html")
	os.WriteFile(path, raw, 0644)
	if _, e = Import(db, path, dir); e == nil {
		t.Fatal("expected orphan error")
	}
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM questions`).Scan(&count)
	if count != 0 {
		t.Fatal("partial import committed")
	}
}
