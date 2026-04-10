package gemini

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/XiaoConstantine/dspy-go/pkg/core"
	"github.com/XiaoConstantine/dspy-go/pkg/datasets"
	"github.com/XiaoConstantine/dspy-go/pkg/optimizers"
	"github.com/simonfrey/langy/internal/gemini/testdata"
)

// OptimizeExercises runs COPRO optimization on exercise generation programs for
// the specified types. It saves each optimized program to basePath/exercise_{type}.json.
func OptimizeExercises(ctx context.Context, llm core.LLM, testCases []testdata.ExerciseTestCase, basePath string, types []string) error {
	// Group test cases by exercise type.
	byType := make(map[string][]testdata.ExerciseTestCase)
	for _, tc := range testCases {
		byType[tc.ExerciseType] = append(byType[tc.ExerciseType], tc)
	}

	for _, typeName := range types {
		cases, ok := byType[typeName]
		if !ok || len(cases) == 0 {
			slog.Warn("no test cases for exercise type, skipping", "type", typeName)
			continue
		}

		if err := optimizeExerciseType(ctx, llm, cases, typeName, basePath); err != nil {
			slog.Error("failed to optimize exercise type", "type", typeName, "error", err)
			continue
		}
	}

	return nil
}

func optimizeExerciseType(ctx context.Context, llm core.LLM, cases []testdata.ExerciseTestCase, typeName, basePath string) error {
	// Build examples from test cases.
	examples := make([]core.Example, len(cases))
	for i, tc := range cases {
		var knownVocab string
		for _, w := range tc.KnownWords {
			knownVocab += w.Front + " = " + w.Back + "\n"
		}

		indexed := make([]indexedCard, len(tc.Cards))
		for j, c := range tc.Cards {
			indexed[j] = indexedCard{
				index: j,
				card:  ExerciseCard{ID: c.ID, Front: c.Front, Back: c.Back, Level: c.Level},
			}
		}

		expectedJSON, err := json.Marshal(tc.ExpectedExercises)
		if err != nil {
			return fmt.Errorf("marshal expected exercises %d: %w", i, err)
		}

		examples[i] = core.Example{
			Inputs: map[string]any{
				"cards_list":  buildCardList(indexed),
				"known_vocab": knownVocab,
				"source_lang": langName(tc.SourceLang),
				"target_lang": langName(tc.TargetLang),
			},
			Outputs: map[string]any{
				"exercises":       string(expectedJSON),
				"_expected_count": len(tc.Cards),
			},
		}
	}

	dataset := datasets.NewSimpleDataset(examples)
	program := newExerciseProgram(llm, typeName)

	// Metric: COPRO calls metric(ex.Outputs, prediction).
	metric := func(expected, actual map[string]any) float64 {
		exStr, ok := actual["exercises"].(string)
		if !ok {
			return 0
		}
		var exercises []Exercise
		if err := json.Unmarshal([]byte(stripJSONFence(exStr)), &exercises); err != nil {
			return 0
		}

		expectedCount := 1
		if c, ok := expected["_expected_count"].(int); ok && c > 0 {
			expectedCount = c
		}

		return ExerciseStructuralScore(exercises, expectedCount, typeName)
	}

	optimizer := optimizers.NewCOPRO(
		metric,
		optimizers.WithBreadth(3),
		optimizers.WithDepth(2),
	)

	slog.Info("starting exercise optimization", "type", typeName, "test_cases", len(cases))
	optimized, err := optimizer.Compile(ctx, program, dataset, metric)
	if err != nil {
		return fmt.Errorf("COPRO compile %s: %w", typeName, err)
	}

	outPath := exerciseStatePath(basePath, typeName)
	if err := core.SaveProgram(&optimized, outPath); err != nil {
		return fmt.Errorf("save optimized exercise program %s: %w", typeName, err)
	}

	slog.Info("saved optimized exercise program", "type", typeName, "path", outPath)
	return nil
}
