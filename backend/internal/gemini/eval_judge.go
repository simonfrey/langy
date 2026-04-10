package gemini

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/XiaoConstantine/dspy-go/pkg/core"
)

type judgeScore struct {
	Score  float64 `json:"score"`
	Reason string  `json:"reason"`
}

// judgeCards uses an LLM to evaluate generated card quality against reference cards.
// Returns a score from 0.0 to 1.0.
func judgeCards(ctx context.Context, llm core.LLM, generated, reference []CardPair, topic, sourceLang, targetLang string) (float64, error) {
	genJSON, err := json.Marshal(generated)
	if err != nil {
		return 0, err
	}
	refJSON, err := json.Marshal(reference)
	if err != nil {
		return 0, err
	}

	prompt := fmt.Sprintf(`You are evaluating the quality of generated flashcards for language learning.

TOPIC: %s
SOURCE LANGUAGE: %s
TARGET LANGUAGE: %s

REFERENCE CARDS (gold standard):
%s

GENERATED CARDS (to evaluate):
%s

Score the generated cards on a scale from 0.0 to 1.0 based on these criteria:
1. TRANSLATION ACCURACY (0.4 weight): Are the front/back translations correct and natural?
2. TOPIC RELEVANCE (0.3 weight): Are the cards relevant to the requested topic?
3. QUALITY (0.2 weight): Do nouns include articles? Are expressions idiomatic? Is difficulty varied?
4. COVERAGE (0.1 weight): Do the cards cover a good range of the topic?

Respond ONLY with valid JSON (no markdown fences):
{"score": 0.0-1.0, "reason": "brief explanation"}`, topic, sourceLang, targetLang, string(refJSON), string(genJSON))

	var result judgeScore
	resp, err := llm.Generate(ctx, prompt)
	if err != nil {
		return 0, fmt.Errorf("judge cards: %w", err)
	}
	if err := json.Unmarshal([]byte(stripJSONFence(resp.Content)), &result); err != nil {
		return 0, fmt.Errorf("parse judge result: %w", err)
	}
	return max(0, min(1, result.Score)), nil
}

// judgeExercises uses an LLM to evaluate generated exercise quality.
// Returns a score from 0.0 to 1.0.
func judgeExercises(ctx context.Context, llm core.LLM, exercises []Exercise, cards []ExerciseCard, exerciseType, sourceLang, targetLang string) (float64, error) {
	exJSON, err := json.Marshal(exercises)
	if err != nil {
		return 0, err
	}
	cardsJSON, err := json.Marshal(cards)
	if err != nil {
		return 0, err
	}

	prompt := fmt.Sprintf(`You are evaluating the quality of generated language learning exercises.

EXERCISE TYPE: %s
SOURCE LANGUAGE (learner's native): %s
TARGET LANGUAGE (being learned): %s

INPUT CARDS:
%s

GENERATED EXERCISES:
%s

Score the exercises on a scale from 0.0 to 1.0 based on these criteria:
1. ANSWER CORRECTNESS (0.3 weight): Is the "correct_answer" actually correct? Is it unambiguous?
2. INSTRUCTION LANGUAGE (0.2 weight): Are instructions written in the source language (%s)?
3. GRAMMATICAL QUALITY (0.3 weight): Are the sentences grammatically correct in the target language?
4. EXERCISE DESIGN (0.2 weight): Does each exercise naturally use the target vocabulary word? Is difficulty appropriate?

Respond ONLY with valid JSON (no markdown fences):
{"score": 0.0-1.0, "reason": "brief explanation"}`, exerciseType, sourceLang, targetLang, string(cardsJSON), string(exJSON), sourceLang)

	var result judgeScore
	resp, err := llm.Generate(ctx, prompt)
	if err != nil {
		return 0, fmt.Errorf("judge exercises: %w", err)
	}
	if err := json.Unmarshal([]byte(stripJSONFence(resp.Content)), &result); err != nil {
		return 0, fmt.Errorf("parse judge result: %w", err)
	}
	return max(0, min(1, result.Score)), nil
}
