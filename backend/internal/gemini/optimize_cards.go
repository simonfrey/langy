package gemini

import (
	"encoding/json"
	"fmt"
	"log/slog"

	"context"

	"github.com/XiaoConstantine/dspy-go/pkg/core"
	"github.com/XiaoConstantine/dspy-go/pkg/datasets"
	"github.com/XiaoConstantine/dspy-go/pkg/optimizers"
	"github.com/simonfrey/langy/internal/gemini/testdata"
)

// OptimizeCards runs COPRO optimization on the card generation program using the
// provided test cases. It saves the optimized program state to outputPath.
func OptimizeCards(ctx context.Context, llm core.LLM, testCases []testdata.CardTestCase, mode, outputPath string) error {
	if len(testCases) < 3 {
		return fmt.Errorf("need at least 3 test cases for optimization, got %d", len(testCases))
	}

	// Filter test cases by mode.
	var filtered []testdata.CardTestCase
	for _, tc := range testCases {
		if tc.Mode == mode {
			filtered = append(filtered, tc)
		}
	}
	if len(filtered) < 3 {
		return fmt.Errorf("need at least 3 %s test cases, got %d", mode, len(filtered))
	}

	// Build examples from test cases. Embed min/max/concepts in outputs
	// so the metric can access them (COPRO passes ex.Outputs as expected).
	examples := make([]core.Example, len(filtered))
	for i, tc := range filtered {
		cardsJSON, err := json.Marshal(tc.ExpectedCards)
		if err != nil {
			return fmt.Errorf("marshal expected cards %d: %w", i, err)
		}
		conceptsJSON, err := json.Marshal(tc.RequiredConcepts)
		if err != nil {
			return fmt.Errorf("marshal concepts %d: %w", i, err)
		}
		examples[i] = core.Example{
			Inputs: map[string]any{
				"topic":       tc.Prompt,
				"source_lang": langName(tc.SourceLang),
				"target_lang": langName(tc.TargetLang),
			},
			Outputs: map[string]any{
				"cards":      string(cardsJSON),
				"_min_cards": tc.MinCards,
				"_max_cards": tc.MaxCards,
				"_concepts":  string(conceptsJSON),
			},
		}
	}

	dataset := datasets.NewSimpleDataset(examples)
	program := newCardProgram(llm, mode)

	// Metric: COPRO calls metric(ex.Outputs, prediction).
	metric := func(expected, actual map[string]any) float64 {
		cardsStr, ok := actual["cards"].(string)
		if !ok {
			return 0
		}
		var generated []CardPair
		if err := json.Unmarshal([]byte(stripJSONFence(cardsStr)), &generated); err != nil {
			return 0
		}

		// Extract bounds and concepts from expected outputs.
		minCards, _ := expected["_min_cards"].(int)
		maxCards, _ := expected["_max_cards"].(int)
		if minCards == 0 {
			minCards = 5
		}
		if maxCards == 0 {
			maxCards = 15
		}

		var concepts []string
		if cs, ok := expected["_concepts"].(string); ok {
			_ = json.Unmarshal([]byte(cs), &concepts)
		}

		structural := CardStructuralScore(generated, minCards, maxCards)
		coverage := ConceptCoverage(generated, concepts)

		return structural*0.4 + coverage*0.6
	}

	optimizer := optimizers.NewCOPRO(
		metric,
		optimizers.WithBreadth(3),
		optimizers.WithDepth(2),
	)

	slog.Info("starting card optimization", "mode", mode, "test_cases", len(filtered))
	optimized, err := optimizer.Compile(ctx, program, dataset, metric)
	if err != nil {
		return fmt.Errorf("COPRO compile: %w", err)
	}

	if err := core.SaveProgram(&optimized, outputPath); err != nil {
		return fmt.Errorf("save optimized card program: %w", err)
	}

	slog.Info("saved optimized card program", "mode", mode, "path", outputPath)
	return nil
}
