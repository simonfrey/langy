package gemini

import (
	"context"
	"log/slog"
	"os"

	"github.com/XiaoConstantine/dspy-go/pkg/core"
	"github.com/XiaoConstantine/dspy-go/pkg/modules"
)

var gradeSignature = core.NewSignature(
	[]core.InputField{
		{Field: core.NewTextField("exercise_type", core.WithDescription("The type of exercise being graded"))},
		{Field: core.NewTextField("prompt", core.WithDescription("The exercise prompt shown to the learner"))},
		{Field: core.NewTextField("correct_answer", core.WithDescription("The expected correct answer"))},
		{Field: core.NewTextField("user_answer", core.WithDescription("The learner's submitted answer"))},
		{Field: core.NewTextField("source_lang", core.WithDescription("The learner's native language"))},
		{Field: core.NewTextField("target_lang", core.WithDescription("The language the learner is studying"))},
	},
	[]core.OutputField{
		{Field: core.NewTextField("result", core.WithDescription("JSON grading result"))},
	},
).WithInstruction(`You are grading a language exercise.
The learner is studying the "target_lang" language and their native language is "source_lang".

Rules:
- Be STRICT on spelling — wrong spelling is wrong. Only accept correctly spelled forms.
- Be STRICT on grammar errors (wrong conjugation, wrong case, wrong gender/article, wrong agreement) — mark as incorrect.
- If the answer is semantically correct but uses a different valid form, mark as correct.
- Provide brief, encouraging feedback in the learner's native language (source_lang).
- If incorrect, provide the corrected answer.

Respond ONLY with valid JSON matching this exact shape (no markdown code fences, no commentary):
{"correct": true|false, "feedback": "...", "corrected_answer": "..."}`)

const gradeModuleName = "grade"

func newGradeProgram(llm core.LLM) core.Program {
	factory := func(mods map[string]core.Module) func(context.Context, map[string]any) (map[string]any, error) {
		return func(ctx context.Context, inputs map[string]any) (map[string]any, error) {
			return mods[gradeModuleName].Process(ctx, inputs)
		}
	}

	predict := modules.NewPredict(gradeSignature).WithTextOutput().WithName(gradeModuleName)
	predict.SetLLM(llm)

	return core.NewProgramWithForwardFactory(
		map[string]core.Module{gradeModuleName: predict},
		factory,
	)
}

func loadGradeProgram(llm core.LLM, statePath string) core.Program {
	program := newGradeProgram(llm)

	if _, err := os.Stat(statePath); err != nil {
		return program
	}

	if err := core.LoadProgram(&program, statePath); err != nil {
		slog.Warn("failed to load optimized grade program, using base", "path", statePath, "error", err)
		return newGradeProgram(llm)
	}

	slog.Info("loaded optimized grade program", "path", statePath)
	return program
}
