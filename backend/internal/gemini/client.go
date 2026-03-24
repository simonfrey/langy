package gemini

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"google.golang.org/genai"
)

type Client struct {
	client        *genai.Client
	model         string
	exerciseModel string
}

type CardPair struct {
	Front    string `json:"front"`
	Back     string `json:"back"`
	FrontImg []byte `json:"-"`
	BackImg  []byte `json:"-"`
	ImgType  string `json:"-"`
}

type ExerciseCard struct {
	ID    string `json:"id"`
	Front string `json:"front"`
	Back  string `json:"back"`
	Level int    `json:"level"` // 1=low, 2=medium, 3=high maturity
}

type Exercise struct {
	ID             string   `json:"id"`
	Type           string   `json:"type"`
	Level          int      `json:"level"`
	Instruction    string   `json:"instruction"`
	Prompt         string   `json:"prompt"`
	CorrectAnswer  string   `json:"correct_answer"`
	Hint           string   `json:"hint,omitempty"`
	SourceSentence string   `json:"source_sentence,omitempty"`
	Options        []string `json:"options,omitempty"`
	SourceCardID   string   `json:"source_card_id"`
}

type KnownWord struct {
	Front string `json:"front"`
	Back  string `json:"back"`
}

type GradeResult struct {
	Correct         bool   `json:"correct"`
	Feedback        string `json:"feedback"`
	CorrectedAnswer string `json:"corrected_answer,omitempty"`
}

type ImageData struct {
	Data     []byte
	MimeType string
}

func New(ctx context.Context, apiKey string) (*Client, error) {
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, err
	}
	return &Client{
		client:        client,
		model:         "gemini-2.5-pro",
		exerciseModel: "gemini-2.5-flash",
	}, nil
}

var cardPairSchema = &genai.Schema{
	Type: genai.TypeArray,
	Items: &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"front": {Type: genai.TypeString},
			"back":  {Type: genai.TypeString},
		},
		Required: []string{"front", "back"},
	},
}

var langNames = map[string]string{
	"en": "English", "es": "Spanish", "fr": "French", "de": "German", "it": "Italian",
	"pt": "Portuguese", "nl": "Dutch", "ru": "Russian", "uk": "Ukrainian", "pl": "Polish",
	"cs": "Czech", "sk": "Slovak", "hu": "Hungarian", "ro": "Romanian", "bg": "Bulgarian",
	"hr": "Croatian", "sr": "Serbian", "sl": "Slovenian", "el": "Greek", "tr": "Turkish",
	"ar": "Arabic", "he": "Hebrew", "fa": "Persian", "hi": "Hindi", "bn": "Bengali",
	"ta": "Tamil", "te": "Telugu", "th": "Thai", "vi": "Vietnamese", "id": "Indonesian",
	"ms": "Malay", "fil": "Filipino", "zh": "Chinese", "ja": "Japanese", "ko": "Korean",
	"sv": "Swedish", "da": "Danish", "no": "Norwegian", "fi": "Finnish", "et": "Estonian",
	"lv": "Latvian", "lt": "Lithuanian", "ka": "Georgian", "sw": "Swahili",
}

func langName(code string) string {
	if name, ok := langNames[code]; ok {
		return name
	}
	return code
}

func (c *Client) GenerateCards(ctx context.Context, prompt, sourceLang, targetLang string, images []ImageData, generateImages bool, mode string) ([]CardPair, error) {
	srcName := langName(sourceLang)
	tgtName := langName(targetLang)
	hasImages := len(images) > 0

	var fullPrompt string
	if mode == "grammar" {
		fullPrompt = c.buildGrammarPrompt(prompt, srcName, tgtName, hasImages, generateImages)
	} else {
		fullPrompt = c.buildVocabularyPrompt(prompt, srcName, tgtName, hasImages, generateImages)
	}

	parts := []*genai.Part{
		{Text: fullPrompt},
	}
	for _, img := range images {
		parts = append(parts, &genai.Part{
			InlineData: &genai.Blob{MIMEType: img.MimeType, Data: img.Data},
		})
	}

	config := &genai.GenerateContentConfig{
		ResponseMIMEType: "application/json",
		ResponseSchema:   cardPairSchema,
	}

	slog.Info("calling gemini API", "model", c.model, "source_lang", sourceLang, "target_lang", targetLang, "image_count", len(images))
	contents := []*genai.Content{{Parts: parts}}
	result, err := c.client.Models.GenerateContent(ctx, c.model, contents, config)
	if err != nil {
		return nil, fmt.Errorf("gemini API error: %w", err)
	}

	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from Gemini")
	}

	text := result.Candidates[0].Content.Parts[0].Text

	var pairs []CardPair
	if err := json.Unmarshal([]byte(text), &pairs); err != nil {
		return nil, fmt.Errorf("failed to parse Gemini response: %w", err)
	}

	if generateImages {
		var imgFailures int
		for i := range pairs {
			imgData, mimeType, err := c.generateCardImage(ctx, pairs[i].Front, pairs[i].Back, tgtName, mode)
			if err != nil {
				slog.Warn("failed to generate card image", "error", err, "front", pairs[i].Front)
				imgFailures++
				continue
			}
			pairs[i].FrontImg = imgData
			pairs[i].ImgType = mimeType
		}
		if imgFailures == len(pairs) {
			slog.Error("all card image generations failed")
		}
	}

	return pairs, nil
}

func (c *Client) buildVocabularyPrompt(prompt, srcName, tgtName string, hasImages, generateImages bool) string {
	switch {
	case hasImages && generateImages:
		return fmt.Sprintf(`You are a vocabulary flashcard generator. Carefully analyze the attached photo(s) and identify all visible objects, actions, settings, signs, text, food, animals, and contextual details.

Generate flashcard pairs for learning %s from %s based on what you see in the image(s).
- "front": the %s word/phrase for something visible in the photo
- "back": the %s translation

Additional context from the user: %s

Guidelines:
- Start with the most prominent items in the photo, then work outward
- Keep terms concrete and visually representable (an illustration will be generated for each card)
- Avoid abstract concepts that are hard to depict visually
- Include common collocations or idiomatic usage where appropriate
- For non-Latin script languages, include romanization in the "back" field
- Do NOT include standalone pronunciation hints
- Use verb forms for visible actions
- Vary difficulty levels across the set
- Generate 8-15 cards unless the user requests a specific number`, tgtName, srcName, tgtName, srcName, prompt)

	case hasImages && !generateImages:
		return fmt.Sprintf(`You are a vocabulary flashcard generator. Carefully analyze the attached photo(s) and identify all visible objects, actions, settings, signs, text, food, animals, and contextual details.

Generate flashcard pairs for learning %s from %s based on what you see in the image(s).
- "front": the %s word/phrase for something visible in the photo
- "back": the %s translation

Additional context from the user: %s

Guidelines:
- Start with the most prominent items in the photo, then work outward
- Include both concrete nouns and action verbs for what you see
- Include common collocations or idiomatic usage where appropriate
- For non-Latin script languages, include romanization in the "back" field
- Do NOT include standalone pronunciation hints
- Vary difficulty levels across the set
- Generate 8-15 cards unless the user requests a specific number`, tgtName, srcName, tgtName, srcName, prompt)

	case !hasImages && generateImages:
		return fmt.Sprintf(`Generate flashcard pairs for learning %s from %s.
- "front": the %s word/phrase
- "back": the %s translation

Topic/Request: %s

Guidelines:
- Favor concrete, visually representable terms (an illustration will be generated for each card)
- Avoid abstract concepts that are hard to depict visually
- Include natural, commonly-used expressions
- For non-Latin script languages, include romanization in the "back" field
- Do NOT include standalone pronunciation hints
- Vary difficulty levels within the set
- If the request implies a specific number, generate exactly that many. Otherwise, generate around 10.`, tgtName, srcName, tgtName, srcName, prompt)

	default:
		return fmt.Sprintf(`Generate flashcard pairs for learning %s from %s.
- "front": the %s word/phrase
- "back": the %s translation

Topic/Request: %s

Guidelines:
- Include natural, commonly-used expressions
- For non-Latin script languages, include romanization in the "back" field
- Do NOT include standalone pronunciation hints
- Vary difficulty levels within the set
- If the request implies a specific number, generate exactly that many. Otherwise, generate around 10.`, tgtName, srcName, tgtName, srcName, prompt)
	}
}

func (c *Client) buildGrammarPrompt(prompt, srcName, tgtName string, hasImages, generateImages bool) string {
	basePrompt := fmt.Sprintf(`You are a grammar flashcard generator for learning %s from %s.

Generate flashcard pairs that teach grammar rules, patterns, and exercises.
- "front": a grammar challenge, question, or exercise in %s (e.g., conjugation prompt, fill-in-the-blank, "when do you use X?", sentence transformation)
- "back": the answer, rule, or explanation in %s

Topic/Request: %s

Guidelines:
- Mix card types: conjugation exercises, fill-in-the-blank, rule explanations, sentence corrections, pattern recognition
- Focus on practical, commonly-needed grammar patterns
- For conjugation cards, test specific forms (not full tables on one card)
- Include example sentences where helpful
- For non-Latin script languages, include romanization in the "back" field
- Vary difficulty levels within the set
- If the request implies a specific number, generate exactly that many. Otherwise, generate around 10.`, tgtName, srcName, tgtName, srcName, prompt)

	return basePrompt
}

var exerciseSchema = &genai.Schema{
	Type: genai.TypeArray,
	Items: &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"type":           {Type: genai.TypeString},
			"instruction":    {Type: genai.TypeString},
			"prompt":         {Type: genai.TypeString},
			"correct_answer": {Type: genai.TypeString},
			"options": {
				Type:  genai.TypeArray,
				Items: &genai.Schema{Type: genai.TypeString},
			},
			"hint":              {Type: genai.TypeString},
			"source_sentence":   {Type: genai.TypeString},
			"source_card_index": {Type: genai.TypeInteger},
		},
		Required: []string{"type", "instruction", "prompt", "correct_answer", "hint", "source_card_index"},
	},
}

var gradeSchema = &genai.Schema{
	Type: genai.TypeObject,
	Properties: map[string]*genai.Schema{
		"correct":          {Type: genai.TypeBoolean},
		"feedback":         {Type: genai.TypeString},
		"corrected_answer": {Type: genai.TypeString},
	},
	Required: []string{"correct", "feedback"},
}

func (c *Client) GenerateExercises(ctx context.Context, cards []ExerciseCard, knownWords []KnownWord, sourceLang, targetLang string) ([]Exercise, error) {
	srcName := langName(sourceLang)
	tgtName := langName(targetLang)

	var l1Cards, l2Cards, l3Cards []string
	for i, card := range cards {
		entry := fmt.Sprintf("[%d] %s = %s", i, card.Front, card.Back)
		switch card.Level {
		case 1:
			l1Cards = append(l1Cards, entry)
		case 2:
			l2Cards = append(l2Cards, entry)
		default:
			l3Cards = append(l3Cards, entry)
		}
	}

	// Build known vocabulary list
	var knownVocab string
	for _, w := range knownWords {
		knownVocab += w.Front + " = " + w.Back + "\n"
	}

	prompt := fmt.Sprintf(`You are an exercise generator for a %s learner whose native language is %s.

Generate exercises based on the vocabulary words below. Each exercise MUST require the correct GRAMMATICAL form (conjugation, declension, gender, article, agreement) — never accept just the base/dictionary form.

When constructing sentences for exercises, primarily use words from the "KNOWN VOCABULARY" list below. You may use additional common words appropriate to the learner's level to make sentences natural. The exercise should test the target word — don't make unknown surrounding words the obstacle.

The "source_card_index" field must be the [index] of the vocabulary word the exercise is based on.
The "source_sentence" field must contain the complete sentence translated into the learner's native language (no blanks or placeholders). This tells the learner WHAT to express. Every exercise that contains a blank MUST have a source_sentence.
The "hint" field must contain a helpful clue that guides the user toward the answer WITHOUT giving it away directly. For example: the grammar rule being tested, or the base form of the target word. Never put the answer itself in the hint.

KNOWN VOCABULARY (use these words to build sentences):
%s

LEVEL 1 WORDS (beginner — provide %s translations as hints):
%s

Exercise types for Level 1: cloze_with_translation, word_order_scramble, article_check, morphing
- cloze_with_translation: Show a %s sentence with a blank, provide full %s translation in "source_sentence". User types the missing word in correct form.
- word_order_scramble: Show %s sentence, provide jumbled %s words in "options" array. User must order them.
- article_check: Show %s word, user must type it with correct article/gender marker.
- morphing: Give base word + grammatical instruction (e.g. "1st person past tense"), user types the correct form.

LEVEL 2 WORDS (intermediate — no native language hints):
%s

Exercise types for Level 2: context_typing, conjugation_cloze, adjective_agreement
- context_typing: Show %s sentence with blank, provide the native-language translation in "source_sentence". User types the missing word.
- conjugation_cloze: Show %s sentence with blank + base form in parentheses, provide native-language translation in "source_sentence". User types correct conjugated form.
- adjective_agreement: Show %s sentence with blank + base adjective, provide native-language translation in "source_sentence". User types with correct gender/number.

LEVEL 3 WORDS (advanced — generative tasks):
%s

Exercise types for Level 3: paragraph_cloze, tense_shifting, error_correction, full_translation
- paragraph_cloze: 3-4 sentence %s paragraph with exactly one blank. Provide native-language translation in "source_sentence".
- tense_shifting: Complete %s sentence, user rewrites in different tense.
- error_correction: %s sentence with intentional grammar error, user types corrected word.
- full_translation: Complex %s sentence, user translates entire sentence to %s. Put the source sentence in "prompt", put a brief grammar/context hint in "hint".

OUTPUT FORMAT RULES per exercise type:
- cloze_with_translation: Put the cloze sentence (with _) in "prompt", put the full translation in "source_sentence". Each exercise must have exactly one _ blank.
- error_correction: "correct_answer" should be just the corrected word(s), not the full sentence.
- tense_shifting: Include the target tense in the "instruction" field.
- full_translation: Put the source sentence in "prompt", put a brief grammar/context hint in "hint".

Write all "instruction" fields in %s (the learner's native language). Do NOT write instructions in English unless the native language IS English.

Generate one exercise per word. Use the appropriate exercise type for each word's level.`,
		tgtName, srcName,
		knownVocab,
		srcName,
		joinLines(l1Cards),
		tgtName, srcName, srcName, tgtName, tgtName,
		joinLines(l2Cards),
		tgtName, tgtName, tgtName,
		joinLines(l3Cards),
		tgtName, tgtName, tgtName, srcName, tgtName,
		srcName,
	)

	config := &genai.GenerateContentConfig{
		ResponseMIMEType: "application/json",
		ResponseSchema:   exerciseSchema,
	}

	slog.Info("generating exercises via gemini", "model", c.exerciseModel, "card_count", len(cards))
	contents := []*genai.Content{{Parts: []*genai.Part{{Text: prompt}}}}
	result, err := c.client.Models.GenerateContent(ctx, c.exerciseModel, contents, config)
	if err != nil {
		return nil, fmt.Errorf("gemini API error: %w", err)
	}

	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from Gemini")
	}

	text := result.Candidates[0].Content.Parts[0].Text

	var rawExercises []struct {
		Type            string   `json:"type"`
		Instruction     string   `json:"instruction"`
		Prompt          string   `json:"prompt"`
		CorrectAnswer   string   `json:"correct_answer"`
		Hint            string   `json:"hint"`
		SourceSentence  string   `json:"source_sentence"`
		Options         []string `json:"options"`
		SourceCardIndex int      `json:"source_card_index"`
	}
	if err := json.Unmarshal([]byte(text), &rawExercises); err != nil {
		return nil, fmt.Errorf("failed to parse exercises response: %w", err)
	}

	exercises := make([]Exercise, 0, len(rawExercises))
	for i, raw := range rawExercises {
		cardIdx := raw.SourceCardIndex
		if cardIdx < 0 || cardIdx >= len(cards) {
			cardIdx = i % len(cards)
		}
		exercises = append(exercises, Exercise{
			ID:             fmt.Sprintf("ex-%d", i),
			Type:           raw.Type,
			Level:          cards[cardIdx].Level,
			Instruction:    raw.Instruction,
			Prompt:         raw.Prompt,
			CorrectAnswer:  raw.CorrectAnswer,
			Hint:           raw.Hint,
			SourceSentence: raw.SourceSentence,
			Options:        raw.Options,
			SourceCardID:   cards[cardIdx].ID,
		})
	}

	return exercises, nil
}

func joinLines(lines []string) string {
	if len(lines) == 0 {
		return "(none)"
	}
	result := ""
	for _, l := range lines {
		result += l + "\n"
	}
	return result
}

func (c *Client) GradeExercise(ctx context.Context, exerciseType, prompt, correctAnswer, userAnswer, sourceLang, targetLang string) (*GradeResult, error) {
	srcName := langName(sourceLang)
	tgtName := langName(targetLang)

	gradePrompt := fmt.Sprintf(`You are grading a %s language exercise for a %s speaker.

Exercise type: %s
Exercise prompt: %s
Expected correct answer: %s
User's answer: %s

Rules:
- Be STRICT on spelling — wrong spelling is wrong. Only accept correctly spelled forms.
- Be STRICT on grammar errors (wrong conjugation, wrong case, wrong gender/article, wrong agreement) — mark as incorrect.
- If the answer is semantically correct but uses a different valid form, mark as correct.
- Provide brief, encouraging feedback in %s.
- If incorrect, provide the corrected answer.`, tgtName, srcName, exerciseType, prompt, correctAnswer, userAnswer, srcName)

	config := &genai.GenerateContentConfig{
		ResponseMIMEType: "application/json",
		ResponseSchema:   gradeSchema,
	}

	contents := []*genai.Content{{Parts: []*genai.Part{{Text: gradePrompt}}}}
	result, err := c.client.Models.GenerateContent(ctx, c.exerciseModel, contents, config)
	if err != nil {
		return nil, fmt.Errorf("gemini API error: %w", err)
	}

	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from Gemini")
	}

	text := result.Candidates[0].Content.Parts[0].Text
	var grade GradeResult
	if err := json.Unmarshal([]byte(text), &grade); err != nil {
		return nil, fmt.Errorf("failed to parse grade response: %w", err)
	}

	return &grade, nil
}

func (c *Client) generateCardImage(ctx context.Context, front, back, lang, mode string) ([]byte, string, error) {
	var prompt string
	if mode == "grammar" {
		prompt = fmt.Sprintf("Clean educational diagram showing the grammar concept: '%s' (answer: %s). Use a simple table or visual layout. Minimal style, white background, clear text labels in %s.", front, back, lang)
	} else {
		prompt = fmt.Sprintf("Simple, clean flashcard illustration for the %s word '%s' (meaning: %s). Minimal style, no text, white background.", lang, front, back)
	}

	result, err := c.client.Models.GenerateContent(
		ctx,
		"gemini-2.5-flash-image",
		genai.Text(prompt),
		&genai.GenerateContentConfig{
			ResponseModalities: []string{"IMAGE", "TEXT"},
		},
	)
	if err != nil {
		return nil, "", err
	}
	for _, part := range result.Candidates[0].Content.Parts {
		if part.InlineData != nil {
			return part.InlineData.Data, part.InlineData.MIMEType, nil
		}
	}
	return nil, "", fmt.Errorf("no image generated")
}
