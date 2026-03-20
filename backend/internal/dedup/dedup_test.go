package dedup

import (
	"testing"
)

func TestNormalizeText(t *testing.T) {
	tests := []struct {
		input, want string
	}{
		{"  Hello  World  ", "hello world"},
		{"BAILAR", "bailar"},
		{"café", "café"},
		{"", ""},
	}
	for _, tt := range tests {
		got := NormalizeText(tt.input)
		if got != tt.want {
			t.Errorf("NormalizeText(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestLevenshtein(t *testing.T) {
	tests := []struct {
		a, b string
		want int
	}{
		{"", "", 0},
		{"abc", "", 3},
		{"", "abc", 3},
		{"abc", "abc", 0},
		{"abc", "abd", 1},
		{"bailo", "bailas", 2},
	}
	for _, tt := range tests {
		got := levenshtein(tt.a, tt.b)
		if got != tt.want {
			t.Errorf("levenshtein(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
		}
	}
}

const defaultThreshold = 0.15

func TestFilterDuplicates_ExactDuplicate(t *testing.T) {
	existing := []CardText{{Front: "bailar", Back: "to dance"}}
	generated := []CardText{{Front: "bailar", Back: "to dance"}}

	result := FilterDuplicates(generated, existing, defaultThreshold)
	if len(result) != 0 {
		t.Errorf("expected 0 results, got %d", len(result))
	}
}

func TestFilterDuplicates_CaseWhitespace(t *testing.T) {
	existing := []CardText{{Front: "  Bailar ", Back: " To Dance "}}
	generated := []CardText{{Front: "bailar", Back: "to dance"}}

	result := FilterDuplicates(generated, existing, defaultThreshold)
	if len(result) != 0 {
		t.Errorf("expected 0 results, got %d", len(result))
	}
}

func TestFilterDuplicates_ConjugationsPreserved(t *testing.T) {
	existing := []CardText{{Front: "yo bailo", Back: "I dance"}}
	generated := []CardText{{Front: "tu bailas", Back: "you dance"}}

	result := FilterDuplicates(generated, existing, defaultThreshold)
	if len(result) != 1 {
		t.Errorf("expected 1 result (conjugation preserved), got %d", len(result))
	}
}

func TestFilterDuplicates_NearDuplicateTypo(t *testing.T) {
	existing := []CardText{{Front: "the beautiful house", Back: "la casa hermosa"}}
	generated := []CardText{{Front: "the beautful house", Back: "la casa hermosa"}}

	result := FilterDuplicates(generated, existing, defaultThreshold)
	if len(result) != 0 {
		t.Errorf("expected 0 results (typo caught), got %d", len(result))
	}
}

func TestFilterDuplicates_WithinBatch(t *testing.T) {
	generated := []CardText{
		{Front: "comer", Back: "to eat"},
		{Front: "comer", Back: "to eat"},
	}

	result := FilterDuplicates(generated, nil, defaultThreshold)
	if len(result) != 1 {
		t.Errorf("expected 1 result (batch dedup), got %d", len(result))
	}
}

func TestFilterDuplicates_DifferentMeanings(t *testing.T) {
	existing := []CardText{{Front: "banco", Back: "bank"}}
	generated := []CardText{{Front: "banco", Back: "bench"}}

	result := FilterDuplicates(generated, existing, defaultThreshold)
	if len(result) != 1 {
		t.Errorf("expected 1 result (different meaning), got %d", len(result))
	}
}
