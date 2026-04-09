package gemini

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/XiaoConstantine/dspy-go/pkg/core"
	"github.com/XiaoConstantine/dspy-go/pkg/datasets"
	"github.com/XiaoConstantine/dspy-go/pkg/optimizers"
)

// CompletedExercise holds a graded exercise for training data.
type CompletedExercise struct {
	ExerciseType  string
	Prompt        string
	CorrectAnswer string
	UserAnswer    string
	Correct       bool
	Feedback      string
	SourceLang    string
	TargetLang    string
}

// Optimize runs BootstrapFewShot on completed grading examples and saves
// the optimized program state (few-shot demos) to outputPath.
func Optimize(ctx context.Context, llm core.LLM, exercises []CompletedExercise, outputPath string) error {
	if len(exercises) < 5 {
		return fmt.Errorf("need at least 5 completed exercises for optimization, got %d", len(exercises))
	}

	examples := make([]core.Example, len(exercises))
	for i, ex := range exercises {
		resultJSON, err := json.Marshal(GradeResult{
			Correct:         ex.Correct,
			Feedback:        ex.Feedback,
			CorrectedAnswer: ex.CorrectAnswer,
		})
		if err != nil {
			return fmt.Errorf("marshal training example %d: %w", i, err)
		}

		examples[i] = core.Example{
			Inputs: map[string]any{
				"exercise_type":  ex.ExerciseType,
				"prompt":         ex.Prompt,
				"correct_answer": ex.CorrectAnswer,
				"user_answer":    ex.UserAnswer,
				"source_lang":    langName(ex.SourceLang),
				"target_lang":    langName(ex.TargetLang),
			},
			Outputs: map[string]any{
				"result": string(resultJSON),
			},
		}
	}

	dataset := datasets.NewSimpleDataset(examples)
	program := newGradeProgram(llm)

	metric := func(example, prediction map[string]any, _ context.Context) bool {
		predStr, ok := prediction["result"].(string)
		if !ok {
			return false
		}
		var predicted GradeResult
		if err := json.Unmarshal([]byte(stripJSONFence(predStr)), &predicted); err != nil {
			return false
		}

		expStr, ok := example["result"].(string)
		if !ok {
			return false
		}
		var expected GradeResult
		if err := json.Unmarshal([]byte(expStr), &expected); err != nil {
			return false
		}

		return predicted.Correct == expected.Correct
	}

	optimizer := optimizers.NewBootstrapFewShot(metric, 3)

	slog.Info("starting grade optimization", "examples", len(exercises))
	optimized, err := optimizer.Compile(ctx, program, dataset, nil)
	if err != nil {
		return fmt.Errorf("bootstrap few-shot compile: %w", err)
	}

	if err := core.SaveProgram(&optimized, outputPath); err != nil {
		return fmt.Errorf("save optimized program: %w", err)
	}

	slog.Info("saved optimized grade program", "path", outputPath)
	return nil
}
