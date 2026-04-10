package gemini

import (
	"context"
	"log/slog"
	"os"

	"github.com/XiaoConstantine/dspy-go/pkg/core"
	"github.com/XiaoConstantine/dspy-go/pkg/modules"
)

var cardVocabSignature = core.NewSignature(
	[]core.InputField{
		{Field: core.NewTextField("topic", core.WithDescription("The topic or request for flashcards, e.g. 'kitchen vocabulary' or 'give me 5 words about weather'"))},
		{Field: core.NewTextField("source_lang", core.WithDescription("The learner's native language (full name, e.g. English)"))},
		{Field: core.NewTextField("target_lang", core.WithDescription("The language being learned (full name, e.g. German)"))},
	},
	[]core.OutputField{
		{Field: core.NewTextField("cards", core.WithDescription("JSON array of flashcard pairs"))},
	},
).WithInstruction(`Generate flashcard pairs for learning the target language from the source language.
Each card has:
- "front": the target language word/phrase (include articles for nouns where applicable)
- "back": the source language translation

Guidelines:
- Include natural, commonly-used expressions
- For non-Latin script languages, include romanization in the "back" field
- Do NOT include standalone pronunciation hints
- Vary difficulty levels within the set
- If the request implies a specific number, generate exactly that many. Otherwise, generate around 10.
- Always include the appropriate article with nouns (e.g., "der Hund" not "Hund", "el perro" not "perro")
- Translations should be natural and idiomatic, not word-for-word

Respond ONLY with valid JSON matching this exact shape (no markdown code fences, no commentary):
[{"front": "...", "back": "..."}, ...]`)

var cardGrammarSignature = core.NewSignature(
	[]core.InputField{
		{Field: core.NewTextField("topic", core.WithDescription("The grammar topic or request, e.g. 'present tense conjugation' or 'German articles'"))},
		{Field: core.NewTextField("source_lang", core.WithDescription("The learner's native language (full name)"))},
		{Field: core.NewTextField("target_lang", core.WithDescription("The language being learned (full name)"))},
	},
	[]core.OutputField{
		{Field: core.NewTextField("cards", core.WithDescription("JSON array of grammar flashcard pairs"))},
	},
).WithInstruction(`Generate grammar flashcard pairs for learning the target language from the source language.
Each card has:
- "front": a grammar challenge, question, or exercise in the target language (e.g., conjugation prompt, fill-in-the-blank, "when do you use X?", sentence transformation)
- "back": the answer, rule, or explanation in the source language

Guidelines:
- Mix card types: conjugation exercises, fill-in-the-blank, rule explanations, sentence corrections, pattern recognition
- Focus on practical, commonly-needed grammar patterns
- For conjugation cards, test specific forms (not full tables on one card)
- Include example sentences where helpful
- For non-Latin script languages, include romanization in the "back" field
- Vary difficulty levels within the set
- If the request implies a specific number, generate exactly that many. Otherwise, generate around 10.

Respond ONLY with valid JSON matching this exact shape (no markdown code fences, no commentary):
[{"front": "...", "back": "..."}, ...]`)

const (
	cardVocabModuleName   = "card_vocab"
	cardGrammarModuleName = "card_grammar"
)

func newCardProgram(llm core.LLM, mode string) core.Program {
	sig := cardVocabSignature
	modName := cardVocabModuleName
	if mode == "grammar" {
		sig = cardGrammarSignature
		modName = cardGrammarModuleName
	}

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

func loadCardProgram(llm core.LLM, mode, statePath string) core.Program {
	program := newCardProgram(llm, mode)

	if _, err := os.Stat(statePath); err != nil {
		return program
	}

	if err := core.LoadProgram(&program, statePath); err != nil {
		slog.Warn("failed to load optimized card program, using base", "mode", mode, "path", statePath, "error", err)
		return newCardProgram(llm, mode)
	}

	slog.Info("loaded optimized card program", "mode", mode, "path", statePath)
	return program
}
