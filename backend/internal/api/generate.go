package api

import (
	"context"
	"encoding/base64"
	"log/slog"

	"github.com/simonfrey/langy/internal/dedup"
	"github.com/simonfrey/langy/internal/gemini"
)

func (s *Server) GenerateCards(ctx context.Context, request GenerateCardsRequestObject) (GenerateCardsResponseObject, error) {
	userID := getUserID(ctx)
	req := request.Body

	deckID := uuidStr(req.DeckId)
	if req.SourceLang == "" || req.TargetLang == "" || deckID == "" {
		return GenerateCardsdefaultJSONResponse{Body: ErrorResponse{Error: "source_lang, target_lang, and deck_id required"}, StatusCode: 400}, nil
	}

	fromDeck := req.FromDeck != nil && *req.FromDeck
	prompt := ""
	if req.Prompt != nil {
		prompt = *req.Prompt
	}
	if !fromDeck && prompt == "" {
		return GenerateCardsdefaultJSONResponse{Body: ErrorResponse{Error: "prompt is required when not generating from deck"}, StatusCode: 400}, nil
	}

	deck, err := s.DB.GetDeck(ctx, userID, deckID)
	if err != nil || deck == nil {
		return GenerateCardsdefaultJSONResponse{Body: ErrorResponse{Error: "deck not found"}, StatusCode: 404}, nil
	}

	mode := ""
	if req.Mode != nil {
		mode = *req.Mode
	}

	if fromDeck {
		existingCards, err := s.DB.ListCardTexts(ctx, userID, deckID)
		if err != nil {
			return GenerateCardsdefaultJSONResponse{Body: ErrorResponse{Error: "failed to read existing cards"}, StatusCode: 500}, nil
		}
		if len(existingCards) == 0 {
			return GenerateCardsdefaultJSONResponse{Body: ErrorResponse{Error: "deck has no cards to generate from"}, StatusCode: 400}, nil
		}
		var examples string
		for _, ct := range existingCards {
			examples += ct.Front + " → " + ct.Back + "\n"
		}
		if mode == "grammar" {
			prompt = "Here are existing grammar flashcards in this deck:\n<existing_cards>\n" + examples + "</existing_cards>\nGenerate 10 more grammar flashcards covering complementary grammar topics (conjugations, cases, sentence structures, tenses, common patterns). Do NOT repeat any of the existing cards above."
		} else {
			prompt = "Here are existing flashcards in this deck:\n<existing_cards>\n" + examples + "</existing_cards>\nGenerate 10 more flashcards in the same theme/category/difficulty level. Do NOT repeat any of the existing cards above."
		}
	}

	// Load images from image_ids if provided
	var images []gemini.ImageData
	if req.ImageIds != nil {
		for _, imgID := range *req.ImageIds {
			img, err := s.DB.GetImageData(ctx, uuidStr(imgID))
			if err != nil || img == nil {
				continue
			}
			images = append(images, gemini.ImageData{Data: img.Data, MimeType: img.ContentType})
		}
	}

	generateImages := req.GenerateImages != nil && *req.GenerateImages

	pairs, err := s.Gemini.GenerateCards(ctx, prompt, req.SourceLang, req.TargetLang, images, generateImages, mode)
	if err != nil {
		slog.Error("failed to generate cards via gemini", "error", err, "user_id", userID)
		return GenerateCardsdefaultJSONResponse{Body: ErrorResponse{Error: "failed to generate cards"}, StatusCode: 500}, nil
	}

	// Filter out duplicates
	existingTexts, err := s.DB.ListCardTexts(ctx, userID, deckID)
	if err != nil {
		existingTexts = nil
	}

	var existingDedup []dedup.CardText
	for _, ct := range existingTexts {
		existingDedup = append(existingDedup, dedup.CardText{Front: ct.Front, Back: ct.Back})
	}
	var generatedDedup []dedup.CardText
	for _, p := range pairs {
		generatedDedup = append(generatedDedup, dedup.CardText{Front: p.Front, Back: p.Back})
	}

	filtered := dedup.FilterDuplicates(generatedDedup, existingDedup, 0.15)
	keptSet := make(map[dedup.CardText]bool, len(filtered))
	for _, f := range filtered {
		keptSet[f] = true
	}

	var filteredPairs []gemini.CardPair
	for _, p := range pairs {
		key := dedup.CardText{Front: p.Front, Back: p.Back}
		if keptSet[key] {
			filteredPairs = append(filteredPairs, p)
			delete(keptSet, key)
		}
	}
	pairs = filteredPairs

	result := make([]GeneratedCard, len(pairs))
	for i, p := range pairs {
		result[i] = GeneratedCard{Front: p.Front, Back: p.Back}
		if len(p.FrontImg) > 0 {
			b64 := base64.StdEncoding.EncodeToString(p.FrontImg)
			result[i].FrontImageBase64 = &b64
			result[i].FrontImageType = &p.ImgType
		}
	}

	slog.Info("generated cards (preview)", "user_id", userID, "deck_id", deckID, "count", len(result))
	return GenerateCards200JSONResponse(result), nil
}
