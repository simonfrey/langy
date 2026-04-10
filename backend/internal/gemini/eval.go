package gemini

import (
	"encoding/json"
	"strings"
)

// CardStructuralScore checks structural validity of generated cards (0.0–1.0).
func CardStructuralScore(cards []CardPair, minCards, maxCards int) float64 {
	if len(cards) == 0 {
		return 0
	}

	score := 1.0
	penalties := 0.0

	// Card count in range.
	if len(cards) < minCards {
		penalties += 0.3
	}
	if len(cards) > maxCards {
		penalties += 0.2
	}

	// Check for empty fields and duplicates.
	seen := make(map[string]bool)
	emptyCount := 0
	dupCount := 0
	for _, c := range cards {
		if strings.TrimSpace(c.Front) == "" || strings.TrimSpace(c.Back) == "" {
			emptyCount++
		}
		key := strings.ToLower(strings.TrimSpace(c.Front))
		if seen[key] {
			dupCount++
		}
		seen[key] = true
	}

	if emptyCount > 0 {
		penalties += float64(emptyCount) / float64(len(cards)) * 0.5
	}
	if dupCount > 0 {
		penalties += float64(dupCount) / float64(len(cards)) * 0.3
	}

	score -= penalties
	return max(0, score)
}

// ConceptCoverage checks what fraction of required concepts appear in generated cards.
func ConceptCoverage(cards []CardPair, requiredConcepts []string) float64 {
	if len(requiredConcepts) == 0 {
		return 1.0
	}

	// Build a searchable string from all card fronts and backs.
	var all strings.Builder
	for _, c := range cards {
		all.WriteString(strings.ToLower(c.Front))
		all.WriteString(" ")
		all.WriteString(strings.ToLower(c.Back))
		all.WriteString(" ")
	}
	text := all.String()

	found := 0
	for _, concept := range requiredConcepts {
		if strings.Contains(text, strings.ToLower(concept)) {
			found++
		}
	}
	return float64(found) / float64(len(requiredConcepts))
}

// ExerciseStructuralScore checks structural validity of generated exercises (0.0–1.0).
func ExerciseStructuralScore(exercises []Exercise, expectedCount int, exerciseType string) float64 {
	if len(exercises) == 0 {
		return 0
	}

	score := 1.0
	penalties := 0.0

	// Count mismatch.
	if len(exercises) != expectedCount {
		penalties += 0.2
	}

	for _, ex := range exercises {
		// Required fields check.
		if strings.TrimSpace(ex.Instruction) == "" {
			penalties += 0.1
		}
		if strings.TrimSpace(ex.CorrectAnswer) == "" && !isGradedByData(exerciseType) {
			penalties += 0.15
		}

		// Type-specific checks.
		switch exerciseType {
		case "grammar_multiple_choice":
			if len(ex.Options) != 4 {
				penalties += 0.15
			}
			if len(ex.Options) > 0 && !containsOption(ex.Options, ex.CorrectAnswer) {
				penalties += 0.2
			}
		case "vocab_word_bank", "grammar_reorder":
			if len(ex.Options) == 0 {
				penalties += 0.15
			}
		case "vocab_matching_pairs", "grammar_matching", "grammar_categorization":
			if len(ex.Data) == 0 {
				penalties += 0.2
			}
		case "integrative_reading":
			if len(ex.Data) == 0 {
				penalties += 0.2
			} else {
				var data struct {
					Questions []json.RawMessage `json:"questions"`
				}
				if err := json.Unmarshal(ex.Data, &data); err != nil || len(data.Questions) < 2 {
					penalties += 0.15
				}
			}
		case "vocab_fill_blank", "grammar_fill_conjugation", "grammar_fill_article", "grammar_fill_preposition":
			if !strings.Contains(ex.Prompt, "___") {
				penalties += 0.15
			}
		}
	}

	// Normalize per exercise.
	penalties /= float64(len(exercises))

	score -= penalties
	return max(0, score)
}

// isGradedByData returns true for exercise types where correct_answer lives in the data field.
func isGradedByData(exerciseType string) bool {
	switch exerciseType {
	case "vocab_matching_pairs", "grammar_categorization", "grammar_matching", "integrative_reading":
		return true
	}
	return false
}

func containsOption(options []string, answer string) bool {
	for _, o := range options {
		if strings.EqualFold(strings.TrimSpace(o), strings.TrimSpace(answer)) {
			return true
		}
	}
	return false
}
