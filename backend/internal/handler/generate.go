package handler

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"

	"github.com/simonfrey/langy/internal/db"
	"github.com/simonfrey/langy/internal/dedup"
	"github.com/simonfrey/langy/internal/gemini"
	"github.com/simonfrey/langy/internal/middleware"
)

type GenerateHandler struct {
	DB     *db.DB
	Gemini *gemini.Client
}

type generateRequest struct {
	Prompt         string `json:"prompt"`
	SourceLang     string `json:"source_lang"`
	TargetLang     string `json:"target_lang"`
	DeckID         string `json:"deck_id"`
	GenerateImages bool   `json:"generate_images"`
}

func (h *GenerateHandler) Generate(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var prompt, sourceLang, targetLang, deckID string
	var generateImages bool
	var images []gemini.ImageData

	contentType := r.Header.Get("Content-Type")
	if len(contentType) >= 19 && contentType[:19] == "multipart/form-data" {
		if err := r.ParseMultipartForm(40 << 20); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid multipart form"})
			return
		}
		prompt = r.FormValue("prompt")
		sourceLang = r.FormValue("source_lang")
		targetLang = r.FormValue("target_lang")
		deckID = r.FormValue("deck_id")
		generateImages = r.FormValue("generate_images") == "true"

		for _, fh := range r.MultipartForm.File["images"] {
			f, err := fh.Open()
			if err != nil {
				continue
			}
			data, err := io.ReadAll(f)
			f.Close()
			if err != nil {
				continue
			}
			images = append(images, gemini.ImageData{
				Data:     data,
				MimeType: fh.Header.Get("Content-Type"),
			})
		}
	} else {
		var req generateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		prompt = req.Prompt
		sourceLang = req.SourceLang
		targetLang = req.TargetLang
		deckID = req.DeckID
		generateImages = req.GenerateImages
	}

	if prompt == "" || sourceLang == "" || targetLang == "" || deckID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "prompt, source_lang, target_lang, and deck_id required"})
		return
	}

	deck, err := h.DB.GetDeck(r.Context(), userID, deckID)
	if err != nil {
		slog.Error("failed to get deck for generate", "error", err, "user_id", userID, "deck_id", deckID)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "deck not found"})
		return
	}
	if deck == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "deck not found"})
		return
	}

	pairs, err := h.Gemini.GenerateCards(r.Context(), prompt, sourceLang, targetLang, images, generateImages)
	if err != nil {
		slog.Error("failed to generate cards via gemini", "error", err, "user_id", userID, "deck_id", deckID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to generate cards: " + err.Error()})
		return
	}

	// Filter out duplicates against existing cards in the deck
	existingTexts, err := h.DB.ListCardTexts(r.Context(), userID, deckID)
	if err != nil {
		slog.Error("failed to list card texts for dedup", "error", err, "user_id", userID, "deck_id", deckID)
		// Non-fatal: proceed without dedup
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

	// Build a set of kept cards for fast lookup
	keptSet := make(map[dedup.CardText]bool, len(filtered))
	for _, f := range filtered {
		keptSet[f] = true
	}

	// Filter original pairs to preserve image data
	var filteredPairs []gemini.CardPair
	for _, p := range pairs {
		if keptSet[dedup.CardText{Front: p.Front, Back: p.Back}] {
			filteredPairs = append(filteredPairs, p)
			delete(keptSet, dedup.CardText{Front: p.Front, Back: p.Back})
		}
	}
	pairs = filteredPairs

	type generatedCard struct {
		Front          string `json:"front"`
		Back           string `json:"back"`
		FrontImageB64  string `json:"front_image_base64,omitempty"`
		FrontImageType string `json:"front_image_type,omitempty"`
	}

	result := make([]generatedCard, len(pairs))
	for i, p := range pairs {
		result[i] = generatedCard{
			Front: p.Front,
			Back:  p.Back,
		}
		if len(p.FrontImg) > 0 {
			result[i].FrontImageB64 = base64.StdEncoding.EncodeToString(p.FrontImg)
			result[i].FrontImageType = p.ImgType
		}
	}

	slog.Info("generated cards (preview)", "user_id", userID, "deck_id", deckID, "count", len(result))
	writeJSON(w, http.StatusOK, result)
}
