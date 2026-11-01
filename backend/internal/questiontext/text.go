// Package questiontext prepares editable text context from legacy search OCR.
// It never infers missing exponents, fractions, or diagram coordinates.
package questiontext

import (
	"regexp"
	"strings"
)

type Context struct {
	QuestionID   string `json:"questionId"`
	Text         string `json:"text"`
	Source       string `json:"source"`
	ReviewStatus string `json:"reviewStatus"`
}

var header = regexp.MustCompile(`(?i)^\s*\d+\.\s*\([^)]*\)\s*(?:\[[^]]*\])?\s*`)
var solution = regexp.MustCompile(`(?i)\b(?:we have|we get|we obtain|hence|therefore|thus|it follows)\b|\(method\s+[ivx]+\)`)

// These two transcriptions were checked against the original question images.
var checked = map[string]string{
	"ee201-t01-q001": `Solve $y^2\,dx+(3xy-4y^3)\,dy=0$.`,
	"ee201-t01-q002": `Solve $4y'+5y=f(x)$, where $f(x)=1$ for $0<x<\pi$ and $f(x)=0$ otherwise.`,
}

func FromLegacy(id, raw string) Context {
	if text, ok := checked[id]; ok {
		return Context{id, text, "transcribed", "reviewed"}
	}
	text := header.ReplaceAllString(strings.TrimSpace(raw), "")
	if loc := solution.FindStringIndex(text); loc != nil && loc[0] > 0 {
		text = text[:loc[0]]
	}
	return Context{id, strings.Join(strings.Fields(text), " "), "legacy_ocr", "unreviewed"}
}
