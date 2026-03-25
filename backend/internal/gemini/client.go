package gemini

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/XiaoConstantine/dspy-go/pkg/core"
	_ "github.com/XiaoConstantine/dspy-go/pkg/llms"
	"github.com/XiaoConstantine/dspy-go/pkg/modules"
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
	ID             string          `json:"id"`
	Type           string          `json:"type"`
	Level          int             `json:"level"`
	Instruction    string          `json:"instruction"`
	Prompt         string          `json:"prompt"`
	CorrectAnswer  string          `json:"correct_answer"`
	Hint           string          `json:"hint,omitempty"`
	SourceSentence string          `json:"source_sentence,omitempty"`
	Options        []string        `json:"options,omitempty"`
	Data           json.RawMessage `json:"data,omitempty"`
	SourceCardID   string          `json:"source_card_id"`
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

	if err := core.ConfigureDefaultLLM(apiKey, core.ModelGoogleGeminiPro); err != nil {
		return nil, fmt.Errorf("failed to configure dspy-go LLM: %w", err)
	}

	return &Client{
		client:        client,
		model:         "gemini-2.5-pro",
		exerciseModel: "gemini-2.5-pro",
	}, nil
}

// dspyGenerate runs a text-only prompt through dspy-go's Predict module.
func (c *Client) dspyGenerate(ctx context.Context, instruction, prompt string) (string, error) {
	sig := core.NewSignature(
		[]core.InputField{{Field: core.NewField("prompt")}},
		[]core.OutputField{{Field: core.NewField("result")}},
	).WithInstruction(instruction)

	predict := modules.NewPredict(sig).WithTextOutput()
	result, err := predict.Process(ctx, map[string]interface{}{
		"prompt": prompt,
	})
	if err != nil {
		return "", fmt.Errorf("dspy-go error: %w", err)
	}

	text, ok := result["result"].(string)
	if !ok {
		return "", fmt.Errorf("dspy-go returned unexpected type for result")
	}

	// Strip markdown code fences if present
	text = strings.TrimSpace(text)
	if strings.HasPrefix(text, "```") {
		lines := strings.Split(text, "\n")
		if len(lines) >= 2 {
			lines = lines[1:]
		}
		if len(lines) > 0 && strings.HasPrefix(strings.TrimSpace(lines[len(lines)-1]), "```") {
			lines = lines[:len(lines)-1]
		}
		text = strings.Join(lines, "\n")
	}

	return text, nil
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

	var text string

	if hasImages {
		// Multimodal path: use genai directly (dspy-go doesn't support image inputs)
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

		slog.Info("calling gemini API (multimodal)", "model", c.model, "source_lang", sourceLang, "target_lang", targetLang, "image_count", len(images))
		contents := []*genai.Content{{Parts: parts}}
		result, err := c.client.Models.GenerateContent(ctx, c.model, contents, config)
		if err != nil {
			return nil, fmt.Errorf("gemini API error: %w", err)
		}

		if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
			return nil, fmt.Errorf("empty response from Gemini")
		}

		text = result.Candidates[0].Content.Parts[0].Text
	} else {
		// Text-only path: use dspy-go
		slog.Info("calling dspy-go for card generation", "source_lang", sourceLang, "target_lang", targetLang)
		instruction := "Generate flashcard pairs as a JSON array. Each object must have \"front\" and \"back\" string fields. Return ONLY valid JSON, no extra text."
		var err error
		text, err = c.dspyGenerate(ctx, instruction, fullPrompt)
		if err != nil {
			return nil, fmt.Errorf("dspy-go card generation error: %w", err)
		}
	}

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

	instruction := `Grade the exercise and return a JSON object with fields: "correct" (boolean), "feedback" (string), and optionally "corrected_answer" (string). Return ONLY valid JSON, no extra text.`
	text, err := c.dspyGenerate(ctx, instruction, gradePrompt)
	if err != nil {
		return nil, fmt.Errorf("dspy-go grading error: %w", err)
	}
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
