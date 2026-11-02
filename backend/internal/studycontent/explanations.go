package studycontent

import (
	"crypto/sha256"
	"database/sql"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
)

//go:embed laplace_explanations.json
var laplaceExplanations []byte

//go:embed z_transform_explanations.json
var zTransformExplanations []byte

//go:embed bvp_explanations.json
var bvpExplanations []byte

// SeedExplanations applies source-matched authored content. A revision may replace
// only a known previous body; custom edits and human-reviewed bodies are retained.
// AI review status is valid only for the exact body and both original images.
func SeedExplanations(db *sql.DB) error {
	type authoredExplanation struct {
		QuestionID         string   `json:"questionId"`
		SourceMediaID      string   `json:"sourceMediaId"`
		BodyHTML           string   `json:"bodyHtml"`
		QuestionMediaID    string   `json:"questionMediaId"`
		PreviousBodySHA256 []string `json:"previousBodySHA256"`
		ReviewedBodySHA256 string   `json:"reviewedBodySHA256"`
		ReviewStatus       string   `json:"reviewStatus"`
	}
	var items []authoredExplanation
	for _, content := range [][]byte{laplaceExplanations, zTransformExplanations, bvpExplanations} {
		var batch []authoredExplanation
		if err := json.Unmarshal(content, &batch); err != nil {
			return err
		}
		items = append(items, batch...)
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, item := range items {
		var questionImage, solutionImage string
		err = tx.QueryRow(`SELECT q.media_id,s.media_id FROM question_media q JOIN question_media s ON s.question_id=q.question_id AND s.role='original_solution' WHERE q.question_id=? AND q.role='question'`, item.QuestionID).Scan(&questionImage, &solutionImage)
		if errors.Is(err, sql.ErrNoRows) {
			if err = invalidateAIReview(tx, item.QuestionID); err != nil {
				return err
			}
			continue
		}
		if err != nil {
			return err
		}
		if solutionImage != item.SourceMediaID || (item.QuestionMediaID != "" && questionImage != item.QuestionMediaID) {
			if err = invalidateAIReview(tx, item.QuestionID); err != nil {
				return err
			}
			continue
		}
		status := "unreviewed"
		if bodyHash(item.BodyHTML) == item.ReviewedBodySHA256 && item.QuestionMediaID != "" && (item.ReviewStatus == "ai_checked" || item.ReviewStatus == "needs_clarification") {
			status = item.ReviewStatus
		}
		var current, currentStatus string
		err = tx.QueryRow(`SELECT body_html,review_status FROM explanations WHERE question_id=?`, item.QuestionID).Scan(&current, &currentStatus)
		if errors.Is(err, sql.ErrNoRows) {
			_, err = tx.Exec(`INSERT INTO explanations(question_id,body_html,review_status) VALUES(?,?,?)`, item.QuestionID, item.BodyHTML, status)
		} else if err == nil {
			if currentStatus == "reviewed" {
				continue
			}
			allowed := current == item.BodyHTML
			for _, previous := range item.PreviousBodySHA256 {
				if previous == bodyHash(current) {
					allowed = true
				}
			}
			if !allowed {
				if err = invalidateAIReview(tx, item.QuestionID); err != nil {
					return err
				}
				continue
			}
			_, err = tx.Exec(`UPDATE explanations SET body_html=?,review_status=? WHERE question_id=?`, item.BodyHTML, status, item.QuestionID)
		}
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func invalidateAIReview(tx *sql.Tx, id string) error {
	_, err := tx.Exec(`UPDATE explanations SET review_status='unreviewed' WHERE question_id=? AND review_status IN ('ai_checked','needs_clarification')`, id)
	return err
}

func bodyHash(body string) string {
	hash := sha256.Sum256([]byte(body))
	return hex.EncodeToString(hash[:])
}
