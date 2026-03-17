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
	imageNote := ""
	if len(images) > 0 {
		imageNote = "\nI have also attached images for additional context. Use the content of these images to inform the flashcard generation."
	}

	srcName := langName(sourceLang)
	tgtName := langName(targetLang)

	fullPrompt := fmt.Sprintf(`Generate flashcard pairs for learning %s from %s.
The "front" field should contain the %s word/phrase.
The "back" field should contain the %s translation, plus a brief pronunciation hint if applicable.
Topic/Request: %s%s

Guidelines:
- Include natural, commonly-used expressions
- For languages with different scripts (e.g. Japanese, Chinese, Arabic), include romanization in the back field
- Vary difficulty levels within the set
- If the request implies a specific number of items, generate exactly that many. Otherwise, generate around 10.`, tgtName, srcName, tgtName, srcName, prompt, imageNote)

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
