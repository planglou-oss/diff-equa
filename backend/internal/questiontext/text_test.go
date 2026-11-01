package questiontext

import (
	"strings"
	"testing"
)

func TestRemoveMetadataAndRecognizedSolution(t *testing.T) {
	c := FromLegacy("q-other", `3. (Midterm, December 30, 1999) [WKG] Solve y'+y=0. We have y=C exp(-x).`)
	if c.Text != "Solve y'+y=0." || c.ReviewStatus != "unreviewed" {
		t.Fatalf("unexpected draft: %+v", c)
	}
	c = FromLegacy("q-other", `Find the general solution to y'=x. (Method I) We integrate...`)
	if !strings.Contains(c.Text, "general solution") || strings.Contains(c.Text, "We integrate") {
		t.Fatal("removed problem instruction or kept solution")
	}
}

func TestCheckedPiecewiseQuestionPreservesConditions(t *testing.T) {
	c := FromLegacy("ee201-t01-q002", "")
	for _, s := range []string{"4y'+5y=f(x)", `0<x<\pi`, "otherwise"} {
		if !strings.Contains(c.Text, s) {
			t.Fatal("missing " + s)
		}
	}
	if c.ReviewStatus != "reviewed" {
		t.Fatal(c)
	}
}
