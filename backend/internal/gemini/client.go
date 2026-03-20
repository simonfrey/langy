package gemini

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"google.golang.org/genai"
)

type Client struct {
	client *genai.Client
	model  string
}

type CardPair struct {
	Front    string `json:"front"`
	Back     string `json:"back"`
	FrontImg []byte `json:"-"`
	BackImg  []byte `json:"-"`
	ImgType  string `json:"-"`
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
		client: client,
		model:  "gemini-2.0-flash",
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

func (c *Client) GenerateCards(ctx context.Context, prompt, sourceLang, targetLang string, images []ImageData, generateImages bool) ([]CardPair, error) {
	srcName := langName(sourceLang)
	tgtName := langName(targetLang)
	hasImages := len(images) > 0

	var fullPrompt string
	switch {
	case hasImages && generateImages:
		// Text + image input, with image output
		fullPrompt = fmt.Sprintf(`You are a vocabulary flashcard generator. Carefully analyze the attached photo(s) and identify all visible objects, actions, settings, signs, text, food, animals, and contextual details.

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
		// Text + image input, no image output
		fullPrompt = fmt.Sprintf(`You are a vocabulary flashcard generator. Carefully analyze the attached photo(s) and identify all visible objects, actions, settings, signs, text, food, animals, and contextual details.

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
		// Text-only input, with image output
		fullPrompt = fmt.Sprintf(`Generate flashcard pairs for learning %s from %s.
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
		// Text-only input, no image output
		fullPrompt = fmt.Sprintf(`Generate flashcard pairs for learning %s from %s.
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
		for i := range pairs {
			imgData, err := c.generateCardImage(ctx, pairs[i].Front, pairs[i].Back, sourceLang)
			if err != nil {
				slog.Warn("failed to generate card image", "error", err, "front", pairs[i].Front)
				continue
			}
			pairs[i].FrontImg = imgData
			pairs[i].ImgType = "image/png"
		}
	}

	return pairs, nil
}

func (c *Client) generateCardImage(ctx context.Context, front, back, lang string) ([]byte, error) {
	prompt := fmt.Sprintf("Simple, clean flashcard illustration for the %s word '%s' (meaning: %s). Minimal style, no text, white background.", lang, front, back)

	resp, err := c.client.Models.GenerateImages(
		ctx,
		"imagen-3.0-generate-002",
		prompt,
		&genai.GenerateImagesConfig{
			NumberOfImages: 1,
			OutputMIMEType: "image/png",
		},
	)
	if err != nil {
		return nil, err
	}
	if len(resp.GeneratedImages) == 0 {
		return nil, fmt.Errorf("no image generated")
	}
	return resp.GeneratedImages[0].Image.ImageBytes, nil
}
