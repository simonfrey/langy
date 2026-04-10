//go:build eval

package gemini

import (
	"os"
	"testing"
	"time"

	"github.com/XiaoConstantine/dspy-go/pkg/core"
	"github.com/XiaoConstantine/dspy-go/pkg/llms"
	"github.com/simonfrey/langy/internal/gemini/testdata"
)

func evalModel() core.ModelID {
	if m := os.Getenv("GEMINI_MODEL"); m != "" {
		return core.ModelID(m)
	}
	return core.ModelGoogleGeminiFlash
}

func setupLLM(t *testing.T) core.LLM {
	t.Helper()
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		t.Skip("GEMINI_API_KEY not set")
	}
	llm, err := llms.NewGeminiLLM(apiKey, evalModel())
	if err != nil {
		t.Fatalf("create LLM: %v", err)
	}
	return llm
}

func setupClient(t *testing.T) *Client {
	t.Helper()
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		t.Skip("GEMINI_API_KEY not set")
	}
	client, err := NewWithModel(apiKey, evalModel())
	if err != nil {
		t.Fatalf("create client: %v", err)
	}
	return client
}

func TestCardGenerationQuality(t *testing.T) {
	client := setupClient(t)
	llm := setupLLM(t)
	ctx := t.Context()

	cases, err := testdata.LoadCardTestCases("testdata/cards.json")
	if err != nil {
		t.Fatalf("load test cases: %v", err)
	}

	var totalStructural, totalSemantic, totalCoverage float64
	evaluated := 0

	for _, tc := range cases {
		t.Run(tc.ID, func(t *testing.T) {
			var pairs []CardPair
			var genErr error
			for attempt := range 3 {
				pairs, genErr = client.GenerateCards(ctx, tc.Prompt, tc.SourceLang, tc.TargetLang, nil, false, tc.Mode)
				if genErr == nil {
					break
				}
				t.Logf("attempt %d failed: %v", attempt+1, genErr)
				time.Sleep(time.Duration(2*(attempt+1)) * time.Second)
			}
			if genErr != nil {
				t.Errorf("GenerateCards (after retries): %v", genErr)
				return
			}

			structural := CardStructuralScore(pairs, tc.MinCards, tc.MaxCards)
			coverage := ConceptCoverage(pairs, tc.RequiredConcepts)

			refPairs := make([]CardPair, len(tc.ExpectedCards))
			for i, ec := range tc.ExpectedCards {
				refPairs[i] = CardPair{Front: ec.Front, Back: ec.Back}
			}

			semantic, err := judgeCards(ctx, llm, pairs, refPairs, tc.Prompt, langName(tc.SourceLang), langName(tc.TargetLang))
			if err != nil {
				t.Logf("judgeCards failed (using 0): %v", err)
				semantic = 0
			}

			composite := structural*0.2 + coverage*0.1 + semantic*0.7
			t.Logf("structural=%.2f coverage=%.2f semantic=%.2f composite=%.2f cards=%d",
				structural, coverage, semantic, composite, len(pairs))
			for _, p := range pairs {
				t.Logf("  %s → %s", p.Front, p.Back)
			}

			totalStructural += structural
			totalSemantic += semantic
			totalCoverage += coverage
			evaluated++
		})
	}

	if evaluated > 0 {
		n := float64(evaluated)
		t.Logf("\n=== CARD GENERATION SUMMARY ===")
		t.Logf("Cases evaluated: %d/%d", evaluated, len(cases))
		t.Logf("Avg structural:  %.3f", totalStructural/n)
		t.Logf("Avg coverage:    %.3f", totalCoverage/n)
		t.Logf("Avg semantic:    %.3f", totalSemantic/n)
		t.Logf("Avg composite:   %.3f", (totalStructural*0.2+totalCoverage*0.1+totalSemantic*0.7)/n)
	}
}

func TestExerciseGenerationQuality(t *testing.T) {
	client := setupClient(t)
	llm := setupLLM(t)
	ctx := t.Context()

	cases, err := testdata.LoadExerciseTestCases("testdata/exercises.json")
	if err != nil {
		t.Fatalf("load test cases: %v", err)
	}

	var totalStructural, totalSemantic float64
	evaluated := 0

	for _, tc := range cases {
		t.Run(tc.ID, func(t *testing.T) {
			cards := make([]ExerciseCard, len(tc.Cards))
			for i, c := range tc.Cards {
				cards[i] = ExerciseCard{ID: c.ID, Front: c.Front, Back: c.Back, Level: c.Level}
			}
			known := make([]KnownWord, len(tc.KnownWords))
			for i, w := range tc.KnownWords {
				known[i] = KnownWord{Front: w.Front, Back: w.Back}
			}

			var exercises []Exercise
			var genErr error
			for attempt := range 3 {
				exercises, genErr = client.GenerateExercisesForType(ctx, cards, known, tc.SourceLang, tc.TargetLang, tc.ExerciseType)
				if genErr == nil {
					break
				}
				t.Logf("attempt %d failed: %v", attempt+1, genErr)
				time.Sleep(time.Duration(2*(attempt+1)) * time.Second)
			}
			if genErr != nil {
				t.Errorf("GenerateExercisesForType (after retries): %v", genErr)
				return
			}

			structural := ExerciseStructuralScore(exercises, len(tc.Cards), tc.ExerciseType)

			semantic, err := judgeExercises(ctx, llm, exercises, cards, tc.ExerciseType, langName(tc.SourceLang), langName(tc.TargetLang))
			if err != nil {
				t.Logf("judgeExercises failed (using 0): %v", err)
				semantic = 0
			}

			composite := structural*0.4 + semantic*0.6
			t.Logf("type=%s structural=%.2f semantic=%.2f composite=%.2f exercises=%d",
				tc.ExerciseType, structural, semantic, composite, len(exercises))
			for _, ex := range exercises {
				t.Logf("  [%s] %s → %s", ex.Type, ex.Prompt, ex.CorrectAnswer)
			}

			totalStructural += structural
			totalSemantic += semantic
			evaluated++
		})
	}

	if evaluated > 0 {
		n := float64(evaluated)
		t.Logf("\n=== EXERCISE GENERATION SUMMARY ===")
		t.Logf("Cases evaluated: %d/%d", evaluated, len(cases))
		t.Logf("Avg structural:  %.3f", totalStructural/n)
		t.Logf("Avg semantic:    %.3f", totalSemantic/n)
		t.Logf("Avg composite:   %.3f", (totalStructural*0.4+totalSemantic*0.6)/n)
	}
}

func TestCardStructuralScoreUnit(t *testing.T) {
	tests := []struct {
		name     string
		cards    []CardPair
		min, max int
		wantMin  float64
	}{
		{
			name:    "good cards",
			cards:   []CardPair{{Front: "der Hund", Back: "the dog"}, {Front: "die Katze", Back: "the cat"}},
			min:     2,
			max:     5,
			wantMin: 0.9,
		},
		{
			name:    "empty",
			cards:   nil,
			min:     1,
			max:     5,
			wantMin: 0,
		},
		{
			name:    "too few cards",
			cards:   []CardPair{{Front: "a", Back: "b"}},
			min:     5,
			max:     10,
			wantMin: 0.5,
		},
		{
			name: "duplicates",
			cards: []CardPair{
				{Front: "der Hund", Back: "the dog"},
				{Front: "der Hund", Back: "the dog"},
				{Front: "die Katze", Back: "the cat"},
			},
			min:     2,
			max:     5,
			wantMin: 0.5,
		},
		{
			name: "empty fields",
			cards: []CardPair{
				{Front: "", Back: "the dog"},
				{Front: "die Katze", Back: ""},
			},
			min:     2,
			max:     5,
			wantMin: 0.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := CardStructuralScore(tt.cards, tt.min, tt.max)
			if score < tt.wantMin {
				t.Errorf("score=%.2f, want >= %.2f", score, tt.wantMin)
			}
			t.Logf("score=%.3f", score)
		})
	}
}

func TestConceptCoverageUnit(t *testing.T) {
	cards := []CardPair{
		{Front: "der Hund", Back: "the dog"},
		{Front: "die Katze", Back: "the cat"},
		{Front: "der Vogel", Back: "the bird"},
	}

	coverage := ConceptCoverage(cards, []string{"dog", "cat", "bird", "fish"})
	if coverage != 0.75 {
		t.Errorf("coverage=%.2f, want 0.75", coverage)
	}

	fullCoverage := ConceptCoverage(cards, []string{"dog", "cat"})
	if fullCoverage != 1.0 {
		t.Errorf("coverage=%.2f, want 1.0", fullCoverage)
	}
}

func TestExerciseStructuralScoreUnit(t *testing.T) {
	good := []Exercise{
		{
			Type:          "vocab_fill_blank",
			Instruction:   "Fill in the missing word",
			Prompt:        "Der ___ ist groß.",
			CorrectAnswer: "Der Hund ist groß.",
		},
	}
	score := ExerciseStructuralScore(good, 1, "vocab_fill_blank")
	if score < 0.9 {
		t.Errorf("score=%.2f, want >= 0.9", score)
	}

	mcq := []Exercise{
		{
			Type:          "grammar_multiple_choice",
			Instruction:   "Choose the correct form",
			Prompt:        "Ich ___ zur Schule.",
			CorrectAnswer: "gehe",
			Options:       []string{"gehe", "gehst", "geht", "gehen"},
		},
	}
	mcqScore := ExerciseStructuralScore(mcq, 1, "grammar_multiple_choice")
	if mcqScore < 0.9 {
		t.Errorf("mcq score=%.2f, want >= 0.9", mcqScore)
	}

	badMCQ := []Exercise{
		{
			Type:          "grammar_multiple_choice",
			Instruction:   "Choose",
			Prompt:        "Ich ___ zur Schule.",
			CorrectAnswer: "gehe",
			Options:       []string{"a", "b"}, // wrong count
		},
	}
	badScore := ExerciseStructuralScore(badMCQ, 1, "grammar_multiple_choice")
	if badScore >= 0.9 {
		t.Errorf("bad mcq score=%.2f, want < 0.9", badScore)
	}
}
