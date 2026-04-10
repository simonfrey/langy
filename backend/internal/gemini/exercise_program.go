package gemini

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/XiaoConstantine/dspy-go/pkg/core"
	"github.com/XiaoConstantine/dspy-go/pkg/modules"
)

// exerciseSignatureInputs are shared across all exercise type programs.
var exerciseSignatureInputs = []core.InputField{
	{Field: core.NewTextField("cards_list", core.WithDescription("Indexed list of vocabulary cards, one per line: [index] front = back"))},
	{Field: core.NewTextField("known_vocab", core.WithDescription("Known vocabulary list: front = back, one per line"))},
	{Field: core.NewTextField("source_lang", core.WithDescription("The learner's native language (full name)"))},
	{Field: core.NewTextField("target_lang", core.WithDescription("The language being learned (full name)"))},
}

var exerciseSignatureOutputs = []core.OutputField{
	{Field: core.NewTextField("exercises", core.WithDescription("JSON array of exercises"))},
}

// buildExerciseInstruction creates the full instruction for a given exercise type
// by combining the common preamble with the type-specific prompt.
func buildExerciseInstruction(typeName string) string {
	promptDef, ok := exercisePrompts[typeName]
	if !ok {
		return ""
	}

	// Build a template instruction using placeholder values.
	// The actual language names come from inputs at runtime, but the instruction
	// captures the structure and rules. We use descriptive placeholders.
	dummyCards := []indexedCard{{index: 0, card: ExerciseCard{Front: "{card_front}", Back: "{card_back}"}}}
	instruction := promptDef.build(dummyCards, "{known_vocab}", "{source_lang}", "{target_lang}")

	instruction += jsonInstruction(singleExerciseShape)
	return instruction
}

func newExerciseProgram(llm core.LLM, typeName string) core.Program {
	modName := "exercise_" + typeName

	instruction := buildExerciseInstruction(typeName)
	sig := core.NewSignature(
		exerciseSignatureInputs,
		exerciseSignatureOutputs,
	).WithInstruction(instruction)

	factory := func(mods map[string]core.Module) func(context.Context, map[string]any) (map[string]any, error) {
		return func(ctx context.Context, inputs map[string]any) (map[string]any, error) {
			return mods[modName].Process(ctx, inputs)
		}
	}

	predict := modules.NewPredict(sig).WithTextOutput().WithName(modName)
	predict.SetLLM(llm)

	return core.NewProgramWithForwardFactory(
		map[string]core.Module{modName: predict},
		factory,
	)
}

func exerciseStatePath(basePath, typeName string) string {
	return filepath.Join(basePath, fmt.Sprintf("exercise_%s.json", typeName))
}

func loadExerciseProgram(llm core.LLM, typeName, basePath string) core.Program {
	program := newExerciseProgram(llm, typeName)
	statePath := exerciseStatePath(basePath, typeName)

	if _, err := os.Stat(statePath); err != nil {
		return program
	}

	if err := core.LoadProgram(&program, statePath); err != nil {
		slog.Warn("failed to load optimized exercise program, using base", "type", typeName, "path", statePath, "error", err)
		return newExerciseProgram(llm, typeName)
	}

	slog.Info("loaded optimized exercise program", "type", typeName, "path", statePath)
	return program
}

// loadAllExercisePrograms loads optimized programs for all known exercise types.
func loadAllExercisePrograms(llm core.LLM, basePath string) map[string]core.Program {
	allTypes := make([]string, 0, len(exercisePrompts))
	for t := range exercisePrompts {
		allTypes = append(allTypes, t)
	}

	programs := make(map[string]core.Program, len(allTypes))
	for _, t := range allTypes {
		programs[t] = loadExerciseProgram(llm, t, basePath)
	}
	return programs
}
