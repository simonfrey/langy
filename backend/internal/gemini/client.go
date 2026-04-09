package gemini

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/XiaoConstantine/dspy-go/pkg/core"
	"github.com/XiaoConstantine/dspy-go/pkg/llms"
)

type Client struct {
	llm           core.LLM // gemini-2.5-pro for text/structured calls
	imageLLM      core.LLM // gemini-2.5-flash-image for card image generation
	model         string
	exerciseModel string
	gradeProgram  core.Program
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

func New(_ context.Context, apiKey string) (*Client, error) {
	textLLM, err := llms.NewGeminiLLM(apiKey, core.ModelGoogleGeminiPro)
	if err != nil {
		return nil, fmt.Errorf("dspy-go gemini text llm: %w", err)
	}
	imageLLM, err := llms.NewGeminiLLM(apiKey, core.ModelGoogleGeminiFlashImage)
	if err != nil {
		return nil, fmt.Errorf("dspy-go gemini image llm: %w", err)
	}
	return &Client{
		llm:           textLLM,
		imageLLM:      imageLLM,
		model:         string(core.ModelGoogleGeminiPro),
		exerciseModel: string(core.ModelGoogleGeminiPro),
		gradeProgram:  loadGradeProgram(textLLM, "prompts/optimized/grade.json"),
	}, nil
}

// jsonInstruction appends a footer instructing the model to emit raw JSON only.
func jsonInstruction(shape string) string {
	return "\n\nRespond ONLY with valid JSON matching this exact shape (no markdown code fences, no commentary):\n" + shape
}

// stripJSONFence removes optional ```json ... ``` markdown wrappers from a model response.
func stripJSONFence(s string) string {
	s = strings.TrimSpace(s)
	switch {
	case strings.HasPrefix(s, "```json"):
		s = strings.TrimPrefix(s, "```json")
	case strings.HasPrefix(s, "```"):
		s = strings.TrimPrefix(s, "```")
	default:
		return s
	}
	if idx := strings.LastIndex(s, "```"); idx != -1 {
		s = s[:idx]
	}
	return strings.TrimSpace(s)
}

// generateJSON runs a text-only prompt through the dspy-go LLM and decodes the
// response into out. The caller is responsible for instructing the model to
// produce the desired JSON shape.
func (c *Client) generateJSON(ctx context.Context, prompt string, out any) error {
	resp, err := c.llm.Generate(ctx, prompt)
	if err != nil {
		return fmt.Errorf("gemini generate: %w", err)
	}
	if err := json.Unmarshal([]byte(stripJSONFence(resp.Content)), out); err != nil {
		return fmt.Errorf("parse gemini json: %w", err)
	}
	return nil
}

// generateJSONWithContent runs a multimodal prompt (text + images) through the
// dspy-go LLM and decodes the response into out.
func (c *Client) generateJSONWithContent(ctx context.Context, blocks []core.ContentBlock, out any) error {
	resp, err := c.llm.GenerateWithContent(ctx, blocks)
	if err != nil {
		return fmt.Errorf("gemini generate with content: %w", err)
	}
	if err := json.Unmarshal([]byte(stripJSONFence(resp.Content)), out); err != nil {
		return fmt.Errorf("parse gemini json: %w", err)
	}
	return nil
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
	fullPrompt += jsonInstruction(`[{"front": "...", "back": "..."}, ...]`)

	slog.Info("calling gemini API", "model", c.model, "source_lang", sourceLang, "target_lang", targetLang, "image_count", len(images))

	var pairs []CardPair
	if hasImages {
		blocks := make([]core.ContentBlock, 0, 1+len(images))
		blocks = append(blocks, core.NewTextBlock(fullPrompt))
		for _, img := range images {
			blocks = append(blocks, core.NewImageBlock(img.Data, img.MimeType))
		}
		if err := c.generateJSONWithContent(ctx, blocks, &pairs); err != nil {
			return nil, err
		}
	} else {
		if err := c.generateJSON(ctx, fullPrompt, &pairs); err != nil {
			return nil, err
		}
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
	inputs := map[string]any{
		"exercise_type":  exerciseType,
		"prompt":         prompt,
		"correct_answer": correctAnswer,
		"user_answer":    userAnswer,
		"source_lang":    langName(sourceLang),
		"target_lang":    langName(targetLang),
	}

	outputs, err := c.gradeProgram.Execute(ctx, inputs)
	if err != nil {
		return nil, fmt.Errorf("grade exercise: %w", err)
	}

	resultStr, ok := outputs["result"].(string)
	if !ok {
		return nil, fmt.Errorf("grade exercise: unexpected output type")
	}

	var grade GradeResult
	if err := json.Unmarshal([]byte(stripJSONFence(resultStr)), &grade); err != nil {
		return nil, fmt.Errorf("parse grade result: %w", err)
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

	resp, err := c.imageLLM.GenerateWithContent(
		ctx,
		[]core.ContentBlock{core.NewTextBlock(prompt)},
		core.WithResponseModalities("image", "text"),
	)
	if err != nil {
		return nil, "", err
	}
	for _, block := range resp.ContentBlocks {
		if block.Type == core.FieldTypeImage && len(block.Data) > 0 {
			return block.Data, block.MimeType, nil
		}
	}
	return nil, "", fmt.Errorf("no image generated")
}
