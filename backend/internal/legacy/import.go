package legacy

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	_ "image/png"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type item struct {
	C, N, Y          int
	T, D, A, Q, S, X string
}
type source struct {
	Topics [][]json.RawMessage `json:"topics"`
	Items  []item              `json:"items"`
}
type Report struct {
	Topics, Questions, Images, Explanations int
	Checksum                                string
}

func Import(db *sql.DB, path, dir string) (Report, error) {
	var report Report
	raw, err := os.ReadFile(path)
	if err != nil {
		return report, err
	}
	hash := sha256.Sum256(raw)
	report.Checksum = hex.EncodeToString(hash[:])
	extract := func(name string, out any) error {
		re := regexp.MustCompile(`const\s+` + name + `\s*=\s*`)
		loc := re.FindIndex(raw)
		if loc == nil {
			return fmt.Errorf("missing %s", name)
		}
		return json.NewDecoder(bytes.NewReader(raw[loc[1]:])).Decode(out)
	}
	var d source
	var a map[string]string
	if err = extract("D", &d); err != nil {
		return report, err
	}
	if err = extract("A", &a); err != nil {
		return report, err
	}
	if len(d.Items) == 0 {
		return report, fmt.Errorf("empty source")
	}
	if err = os.MkdirAll(filepath.Join(dir, "media"), 0755); err != nil {
		return report, err
	}
	tx, err := db.Begin()
	if err != nil {
		return report, err
	}
	defer tx.Rollback()
	for order, t := range d.Topics {
		if len(t) != 2 {
			return report, fmt.Errorf("invalid topic")
		}
		var id int
		var name string
		if err = json.Unmarshal(t[0], &id); err != nil {
			return report, err
		}
		if err = json.Unmarshal(t[1], &name); err != nil {
			return report, err
		}
		if _, err = tx.Exec(`INSERT INTO topics VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order`, id, name, order); err != nil {
			return report, err
		}
		report.Topics++
	}
	saveImage := func(encoded string) (string, error) {
		b, e := base64.StdEncoding.DecodeString(encoded)
		if e != nil {
			return "", e
		}
		cfg, format, e := image.DecodeConfig(bytes.NewReader(b))
		if e != nil || format != "png" {
			return "", fmt.Errorf("invalid PNG")
		}
		h := sha256.Sum256(b)
		id := hex.EncodeToString(h[:])
		rel := id + ".png"
		target := filepath.Join(dir, "media", rel)
		if existing, e := os.ReadFile(target); e == nil {
			if !bytes.Equal(existing, b) {
				return "", fmt.Errorf("media hash mismatch")
			}
		} else {
			temp, e := os.CreateTemp(filepath.Join(dir, "media"), "import-*.tmp")
			if e != nil {
				return "", e
			}
			name := temp.Name()
			defer os.Remove(name)
			if _, e = temp.Write(b); e != nil {
				temp.Close()
				return "", e
			}
			if e = temp.Close(); e != nil {
				return "", e
			}
			if e = os.Rename(name, target); e != nil {
				return "", e
			}
		}
		_, e = tx.Exec(`INSERT INTO media VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`, id, rel, "image/png", cfg.Width, cfg.Height, len(b))
		return id, e
	}
	seen := map[string]bool{}
	for _, i := range d.Items {
		key := fmt.Sprintf("%d-%d", i.C, i.N)
		if seen[key] {
			return report, fmt.Errorf("duplicate %s", key)
		}
		seen[key] = true
		id := fmt.Sprintf("ee201-t%02d-q%03d", i.C, i.N)
		typ := i.T
		for _, v := range []string{"Midterm", "Final", "Quiz"} {
			if strings.HasPrefix(i.T, v) {
				typ = v
				break
			}
		}
		var date any
		if dt, e := time.Parse("January 2, 2006", i.D); e == nil {
			date = dt.Format("2006-01-02")
		}
		_, err = tx.Exec(`INSERT INTO questions VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(legacy_key) DO UPDATE SET topic_id=excluded.topic_id,display_number=excluded.display_number,exam_type=excluded.exam_type,exam_type_raw=excluded.exam_type_raw,date_label=excluded.date_label,exam_date=excluded.exam_date,year=excluded.year,source_label=excluded.source_label,search_text_raw=excluded.search_text_raw`, id, key, i.C, i.N, typ, i.T, i.D, date, i.Y, i.A, i.X)
		if err != nil {
			return report, err
		}
		for _, im := range []struct{ role, data string }{{"question", i.Q}, {"original_solution", i.S}} {
			if im.data == "" {
				return report, fmt.Errorf("missing %s for %s", im.role, key)
			}
			mid, e := saveImage(im.data)
			if e != nil {
				return report, e
			}
			if _, e = tx.Exec(`INSERT INTO question_media VALUES(?,?,?) ON CONFLICT(question_id,role) DO UPDATE SET media_id=excluded.media_id`, id, im.role, mid); e != nil {
				return report, e
			}
			report.Images++
		}
		if body, ok := a[key]; ok {
			_, err = tx.Exec(`INSERT INTO explanations(question_id,body_html) VALUES(?,?) ON CONFLICT(question_id) DO UPDATE SET body_html=excluded.body_html,review_status=CASE WHEN explanations.body_html=excluded.body_html THEN explanations.review_status ELSE 'unreviewed' END`, id, body)
			if err != nil {
				return report, err
			}
			report.Explanations++
		}
		report.Questions++
	}
	for key := range a {
		if !seen[key] {
			return report, fmt.Errorf("orphan explanation %s", key)
		}
	}
	// The mascot is an app asset, extracted without executing the original script.
	re := regexp.MustCompile(`<img class="av" src="data:image/png;base64,([^"]+)"`)
	if match := re.FindSubmatch(raw); match != nil {
		b, e := base64.StdEncoding.DecodeString(string(match[1]))
		if e != nil {
			return report, e
		}
		if _, _, e = image.DecodeConfig(bytes.NewReader(b)); e != nil {
			return report, e
		}
		if e = os.WriteFile(filepath.Join(dir, "mascot.png"), b, 0644); e != nil {
			return report, e
		}
	}
	if _, err = tx.Exec(`INSERT OR IGNORE INTO imports(checksum) VALUES(?)`, report.Checksum); err != nil {
		return report, err
	}
	err = tx.Commit()
	return report, err
}
