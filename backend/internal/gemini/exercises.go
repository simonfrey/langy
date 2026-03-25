package gemini

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
)

// exerciseTypePrompt builds a dedicated prompt for a specific exercise type.
type exerciseTypePrompt struct {
	typeName string
	build    func(cards []indexedCard, knownVocab, srcName, tgtName string) string
}

type indexedCard struct {
	index int
	card  ExerciseCard
}

// Level → available exercise types
var l1Types = []string{
	"vocab_fill_blank",
	"vocab_matching_pairs",
	"vocab_word_bank",
}

var l2Types = []string{
	"grammar_fill_conjugation",
	"grammar_fill_article",
	"grammar_fill_preposition",
	"grammar_conjugation_drill",
	"grammar_reorder",
	"grammar_multiple_choice",
}

var l3Types = []string{
	"grammar_error_correction",
	"grammar_transformation",
	"grammar_categorization",
	"grammar_matching",
	"integrative_dialogue",
	"integrative_reading",
	"integrative_cloze_passage",
}

// pickExerciseType selects a random exercise type for the given level.
func pickExerciseType(level int) string {
	switch level {
	case 1:
		return l1Types[rand.Intn(len(l1Types))]
	case 2:
		return l2Types[rand.Intn(len(l2Types))]
	default:
		return l3Types[rand.Intn(len(l3Types))]
	}
}

func buildCardList(cards []indexedCard) string {
	result := ""
	for _, c := range cards {
		result += fmt.Sprintf("[%d] %s = %s\n", c.index, c.card.Front, c.card.Back)
	}
	return result
}

func commonPreamble(srcName, tgtName, knownVocab string) string {
	return fmt.Sprintf(`You are an exercise generator for a %s learner whose native language is %s.

KNOWN VOCABULARY (use these to build natural sentences):
%s

RULES:
- Every exercise MUST have exactly ONE unambiguous correct answer.
- The "source_card_index" must be the [index] of the vocabulary word the exercise is based on.
- Write all "instruction" fields in %s (the learner's native language).
- The sentence should naturally use the vocabulary word from the card.
- Each exercise MUST require the correct GRAMMATICAL form — never accept just the base/dictionary form.

Generate exactly one exercise per word listed below.
`, tgtName, srcName, knownVocab, srcName)
}

// --- Prompt builders per exercise type ---

var exercisePrompts = map[string]exerciseTypePrompt{
	"vocab_fill_blank": {
		typeName: "vocab_fill_blank",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: vocab_fill_blank (Fill in the Blank — Vocabulary)

For each word below, create a %s sentence with ___ replacing the target word.

Fields:
- "instruction": "Fill in the missing word" (in %s)
- "prompt": The %s sentence with ___ blank(s) where the vocabulary word should go
- "source_sentence": The COMPLETE translation in %s (no blanks)
- "correct_answer": The FULL correct %s sentence (blanks filled in)
- "hint": leave empty

WORDS:
%s`, tgtName, srcName, tgtName, srcName, tgtName, buildCardList(cards))
		},
	},

	"vocab_matching_pairs": {
		typeName: "vocab_matching_pairs",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: vocab_matching_pairs (Match native↔target word pairs)

For each word below, create a matching exercise. Include the target word PLUS 3-4 other words from the KNOWN VOCABULARY list to form 4-5 pairs total.

Fields:
- "instruction": "Match the pairs" (in %s)
- "prompt": leave empty
- "correct_answer": leave empty (graded by matching logic)
- "data": A JSON string: {"pairs":[{"native":"...","target":"..."},...]}, 4-5 pairs
- "hint": leave empty

WORDS:
%s`, srcName, buildCardList(cards))
		},
	},

	"vocab_word_bank": {
		typeName: "vocab_word_bank",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: vocab_word_bank (Build a sentence from scrambled words)

For each word below, create a sentence using the target word. Scramble all words of the %s sentence and add 2-3 distractor words.

Fields:
- "instruction": "Build the sentence" (in %s)
- "source_sentence": The complete %s translation
- "options": Array of scrambled %s words + 2-3 distractors (shuffled)
- "correct_answer": The words in correct order, space-separated
- "hint": leave empty

WORDS:
%s`, tgtName, srcName, srcName, tgtName, buildCardList(cards))
		},
	},

	"grammar_fill_conjugation": {
		typeName: "grammar_fill_conjugation",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: grammar_fill_conjugation (Fill in the Blank — Conjugation)

For each word below, create a %s sentence with ___ replacing a verb that needs conjugation. Show the infinitive in parentheses after the blank.

Fields:
- "instruction": "Conjugate the verb" (in %s)
- "prompt": %s sentence with "___ (infinitive)" blank, e.g., "Ich ___ (gehen) zur Schule"
- "correct_answer": The FULL correct sentence with the conjugated form filled in
- "hint": Grammar explanation (tense, person, number)
- "source_sentence": leave empty

WORDS:
%s`, tgtName, srcName, tgtName, buildCardList(cards))
		},
	},

	"grammar_fill_article": {
		typeName: "grammar_fill_article",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: grammar_fill_article (Fill in the correct article)

For each word below, create a %s sentence with ___ before a noun where the article should go.

Fields:
- "instruction": "Fill in the correct article" (in %s)
- "prompt": %s sentence with ___ before the noun, e.g., "___ Hund ist groß"
- "correct_answer": The FULL correct sentence with the article filled in, e.g., "Der Hund ist groß"
- "hint": Gender rule hint
- "source_sentence": leave empty

WORDS:
%s`, tgtName, srcName, tgtName, buildCardList(cards))
		},
	},

	"grammar_fill_preposition": {
		typeName: "grammar_fill_preposition",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: grammar_fill_preposition (Fill in the correct preposition)

For each word below, create a %s sentence with ___ where a preposition should go.

Fields:
- "instruction": "Fill in the correct preposition" (in %s)
- "prompt": %s sentence with ___ blank
- "source_sentence": Full %s translation
- "correct_answer": The FULL correct sentence with the preposition filled in
- "hint": Preposition usage rule

WORDS:
%s`, tgtName, srcName, tgtName, srcName, buildCardList(cards))
		},
	},

	"grammar_conjugation_drill": {
		typeName: "grammar_conjugation_drill",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: grammar_conjugation_drill (Isolated conjugation)

For each word below, give a pronoun + infinitive and ask for the correct conjugated form.

Fields:
- "instruction": "Conjugate: [tense name]" (in %s)
- "prompt": "pronoun + infinitive", e.g., "yo + hablar"
- "correct_answer": The conjugated form, e.g., "hablo"
- "hint": Conjugation pattern hint

WORDS:
%s`, srcName, buildCardList(cards))
		},
	},

	"grammar_reorder": {
		typeName: "grammar_reorder",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: grammar_reorder (Put words in correct order)

For each word below, create a %s sentence using the word, then scramble ALL words (no distractors).

Fields:
- "instruction": "Put the words in the correct order" (in %s)
- "source_sentence": The complete %s translation
- "options": Array of ALL %s words of the sentence, scrambled
- "correct_answer": The words in correct order, space-separated
- "hint": Word order note (optional)

WORDS:
%s`, tgtName, srcName, srcName, tgtName, buildCardList(cards))
		},
	},

	"grammar_multiple_choice": {
		typeName: "grammar_multiple_choice",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: grammar_multiple_choice (Choose the correct form)

For each word below, create a %s sentence with ___ blank and provide 4 grammatical form options.

Fields:
- "instruction": "Choose the correct form" (in %s)
- "prompt": %s sentence with ___ blank
- "options": Array of exactly 4 forms of the same word (different conjugations/declensions)
- "correct_answer": The correct form (must be one of the options)
- "hint": Grammar rule being tested

WORDS:
%s`, tgtName, srcName, tgtName, buildCardList(cards))
		},
	},

	"grammar_error_correction": {
		typeName: "grammar_error_correction",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: grammar_error_correction (Find and fix the error)

For each word below, create a %s sentence containing ONE intentional grammar error involving the vocabulary word.

Fields:
- "instruction": "Find and fix the error" (in %s)
- "prompt": The %s sentence with one grammar error
- "source_sentence": The correct %s translation
- "correct_answer": The full corrected %s sentence
- "hint": Grammar area hint, e.g., "Check verb tense"

WORDS:
%s`, tgtName, srcName, tgtName, srcName, tgtName, buildCardList(cards))
		},
	},

	"grammar_transformation": {
		typeName: "grammar_transformation",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: grammar_transformation (Transform the sentence)

For each word below, create a correct %s sentence and ask the user to transform it (e.g., make negative, change tense, change to plural).

Fields:
- "instruction": The transformation instruction in %s, e.g., "Make it negative" / "Change to past tense"
- "prompt": The original correct %s sentence
- "correct_answer": The transformed sentence
- "hint": Grammar rule for the transformation

WORDS:
%s`, tgtName, srcName, tgtName, buildCardList(cards))
		},
	},

	"grammar_categorization": {
		typeName: "grammar_categorization",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: grammar_categorization (Sort words into categories)

For each word below, create a sorting exercise. Use the target word plus 5-7 other words from KNOWN VOCABULARY. Choose a grammatical category split (e.g., Masculine/Feminine, Singular/Plural, Regular/Irregular).

Fields:
- "instruction": "Sort the words into the correct category" (in %s)
- "correct_answer": leave empty (graded by sorting logic)
- "data": JSON string: {"categories":["Category1","Category2"],"words":[{"word":"...","category":"Category1"},...]}, 6-8 words total
- "hint": Grammar rule

WORDS:
%s`, srcName, buildCardList(cards))
		},
	},

	"grammar_matching": {
		typeName: "grammar_matching",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: grammar_matching (Match grammar patterns)

For each word below, create a matching exercise with 4-5 pairs showing a grammar pattern (e.g., pronoun→conjugated verb, noun→article, infinitive→past participle).

Fields:
- "instruction": "Match the correct forms" (in %s)
- "correct_answer": leave empty (graded by matching logic)
- "data": JSON string: {"pairs":[{"left":"ich","right":"bin"},...]}, 4-5 pairs
- "hint": Pattern name, e.g., "sein conjugation"

WORDS:
%s`, srcName, buildCardList(cards))
		},
	},

	"integrative_dialogue": {
		typeName: "integrative_dialogue",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: integrative_dialogue (Complete a dialogue)

For each word below, create a short 4-6 line dialogue in %s with ___ blanks where the user must fill in appropriate responses using the vocabulary word.

Fields:
- "instruction": Situation description in %s
- "prompt": The dialogue with ___ blanks
- "correct_answer": The full correct dialogue (all blanks filled in)
- "hint": Contextual hint

WORDS:
%s`, tgtName, srcName, buildCardList(cards))
		},
	},

	"integrative_reading": {
		typeName: "integrative_reading",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: integrative_reading (Reading comprehension)

For each word below, write a 3-5 sentence passage in %s that naturally uses the vocabulary word, then create 2-3 comprehension questions with multiple choice answers.

Fields:
- "instruction": "Read and answer the questions" (in %s)
- "prompt": The %s passage (3-5 sentences)
- "correct_answer": leave empty (graded per-question)
- "data": JSON string: {"questions":[{"question":"...","options":["a","b","c","d"],"answer":"correct option"},...]}, 2-3 questions

WORDS:
%s`, tgtName, srcName, tgtName, buildCardList(cards))
		},
	},

	"integrative_cloze_passage": {
		typeName: "integrative_cloze_passage",
		build: func(cards []indexedCard, knownVocab, srcName, tgtName string) string {
			return commonPreamble(srcName, tgtName, knownVocab) + fmt.Sprintf(`
EXERCISE TYPE: integrative_cloze_passage (Fill in blanks in a passage)

For each word below, write a 3-5 sentence paragraph in %s that uses the vocabulary word. Replace 2-4 key words (including the target word) with ___ blanks.

Fields:
- "instruction": "Fill in all blanks" (in %s)
- "prompt": The %s paragraph with multiple ___ blanks
- "source_sentence": The full %s translation
- "correct_answer": The full correct %s paragraph (all blanks filled in)

WORDS:
%s`, tgtName, srcName, tgtName, srcName, tgtName, buildCardList(cards))
		},
	},
}

// GenerateExercises picks a type per card, groups by type, calls Gemini once per type.
func (c *Client) GenerateExercises(ctx context.Context, cards []ExerciseCard, knownWords []KnownWord, sourceLang, targetLang string) ([]Exercise, error) {
	srcName := langName(sourceLang)
	tgtName := langName(targetLang)

	var knownVocab string
	for _, w := range knownWords {
		knownVocab += w.Front + " = " + w.Back + "\n"
	}

	// Assign a type to each card and group by type
	type assignment struct {
		typeName string
		cards    []indexedCard
	}
	groups := make(map[string]*assignment)
	for i, card := range cards {
		typ := pickExerciseType(card.Level)
		if _, ok := groups[typ]; !ok {
			groups[typ] = &assignment{typeName: typ, cards: nil}
		}
		groups[typ].cards = append(groups[typ].cards, indexedCard{index: i, card: card})
	}

	var allExercises []Exercise

	for typeName, group := range groups {
		promptDef, ok := exercisePrompts[typeName]
		if !ok {
			slog.Warn("unknown exercise type, falling back to vocab_fill_blank", "type", typeName)
			promptDef = exercisePrompts["vocab_fill_blank"]
		}

		prompt := promptDef.build(group.cards, knownVocab, srcName, tgtName)

		instruction := `Generate exercises as a JSON array. Each object must have: "instruction" (string), "correct_answer" (string), "source_card_index" (integer), and optionally "prompt", "hint", "source_sentence", "options" (string array), "data" (JSON string). Return ONLY valid JSON, no extra text.`

		slog.Info("generating exercises via dspy-go", "type", typeName, "card_count", len(group.cards))
		text, err := c.dspyGenerate(ctx, instruction, prompt)
		if err != nil {
			slog.Error("dspy-go error for exercise type", "type", typeName, "error", err)
			continue
		}

		var rawExercises []struct {
			Instruction     string   `json:"instruction"`
			Prompt          string   `json:"prompt"`
			CorrectAnswer   string   `json:"correct_answer"`
			Hint            string   `json:"hint"`
			SourceSentence  string   `json:"source_sentence"`
			Options         []string `json:"options"`
			Data            string   `json:"data"`
			SourceCardIndex int      `json:"source_card_index"`
		}
		if err := json.Unmarshal([]byte(text), &rawExercises); err != nil {
			slog.Error("failed to parse exercises", "type", typeName, "error", err)
			continue
		}

		for i, raw := range rawExercises {
			// Map source_card_index back to original card index
			cardIdx := raw.SourceCardIndex
			if cardIdx < 0 || cardIdx >= len(cards) {
				if i < len(group.cards) {
					cardIdx = group.cards[i].index
				} else {
					cardIdx = group.cards[0].index
				}
			}

			ex := Exercise{
				ID:             fmt.Sprintf("ex-%s-%d", typeName, i),
				Type:           typeName,
				Level:          cards[cardIdx].Level,
				Instruction:    raw.Instruction,
				Prompt:         raw.Prompt,
				CorrectAnswer:  raw.CorrectAnswer,
				Hint:           raw.Hint,
				SourceSentence: raw.SourceSentence,
				Options:        raw.Options,
				SourceCardID:   cards[cardIdx].ID,
			}
			if raw.Data != "" {
				ex.Data = json.RawMessage(raw.Data)
			}
			allExercises = append(allExercises, ex)
		}
	}

	if len(allExercises) == 0 {
		return nil, fmt.Errorf("failed to generate any exercises")
	}

	return allExercises, nil
}
