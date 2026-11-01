package studycontent

import (
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"sort"
)

//go:embed choices.json
var choiceJSON []byte

type AnswerOption struct {
	Latex    string `json:"latex"`
	Feedback string `json:"feedback"`
}
type AnswerKey struct {
	QuestionID    string         `json:"questionId"`
	Prompt        string         `json:"prompt"`
	SourceMediaID string         `json:"sourceMediaId"`
	Options       []AnswerOption `json:"options"`
	CorrectIndex  int            `json:"correctIndex"`
	Explanation   string         `json:"explanation"`
}
type PublicOption struct {
	ID    string `json:"id"`
	Latex string `json:"latex"`
}

func digest(s string) string              { h := sha256.Sum256([]byte(s)); return hex.EncodeToString(h[:])[:16] }
func (k AnswerKey) Version() string       { b, _ := json.Marshal(k); return digest(string(b)) }
func (k AnswerKey) OptionID(i int) string { return digest(k.QuestionID + ":" + k.Options[i].Latex) }
func (k AnswerKey) PublicOptions() []PublicOption {
	out := make([]PublicOption, 0, 4)
	for i, o := range k.Options {
		out = append(out, PublicOption{k.OptionID(i), o.Latex})
	}
	// Stable order preserves the meaning of saved selections across reloads.
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

var AnswerKeys = func() map[string]AnswerKey {
	var items []AnswerKey
	if err := json.Unmarshal(choiceJSON, &items); err != nil {
		panic(err)
	}
	out := map[string]AnswerKey{}
	for _, k := range items {
		if len(k.Options) != 4 || k.CorrectIndex < 0 || k.CorrectIndex > 3 || len(k.SourceMediaID) != 64 || k.Explanation == "" {
			panic("invalid choice key: " + k.QuestionID)
		}
		seen := map[string]bool{}
		for i, o := range k.Options {
			id := k.OptionID(i)
			if o.Latex == "" || seen[id] {
				panic("duplicate/empty option")
			}
			seen[id] = true
		}
		if _, ok := out[k.QuestionID]; ok {
			panic("duplicate choice key")
		}
		out[k.QuestionID] = k
	}
	return out
}()
