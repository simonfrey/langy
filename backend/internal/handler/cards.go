package handler

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/simonfrey/langy/internal/db"
	"github.com/simonfrey/langy/internal/middleware"
)

type CardsHandler struct {
	DB *db.DB
}

type createDeckRequest struct {
	Name       string `json:"name"`
	SourceLang string `json:"source_lang"`
	TargetLang string `json:"target_lang"`
}

type createCardRequest struct {
	Front          string `json:"front"`
	Back           string `json:"back"`
	FrontImageB64  string `json:"front_image_base64,omitempty"`
	FrontImageType string `json:"front_image_type,omitempty"`
}

func (h *CardsHandler) ListDecks(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	decks, err := h.DB.ListDecks(r.Context(), userID)
	if err != nil {
		slog.Error("failed to list decks", "error", err, "user_id", userID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list decks"})
		return
	}
	if decks == nil {
		decks = []db.Deck{}
	}
	writeJSON(w, http.StatusOK, decks)
}

func (h *CardsHandler) CreateDeck(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	var req createDeckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if req.Name == "" || req.SourceLang == "" || req.TargetLang == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name, source_lang, and target_lang required"})
		return
	}

	deck, err := h.DB.CreateDeck(r.Context(), userID, req.Name, req.SourceLang, req.TargetLang)
	if err != nil {
		slog.Error("failed to create deck", "error", err, "user_id", userID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create deck"})
		return
	}
	writeJSON(w, http.StatusCreated, deck)
}

func (h *CardsHandler) DeleteDeck(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	deckID := chi.URLParam(r, "id")

	if err := h.DB.DeleteDeck(r.Context(), userID, deckID); err != nil {
		slog.Error("failed to delete deck", "error", err, "user_id", userID, "deck_id", deckID)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "deck not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *CardsHandler) ListCards(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	deckID := chi.URLParam(r, "id")

	cards, err := h.DB.ListCards(r.Context(), userID, deckID)
	if err != nil {
		slog.Error("failed to list cards", "error", err, "user_id", userID, "deck_id", deckID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list cards"})
		return
	}
	if cards == nil {
		cards = []db.Card{}
	}
	writeJSON(w, http.StatusOK, cards)
}

func (h *CardsHandler) CreateCard(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	deckID := chi.URLParam(r, "id")

	var front, back string
	var images *db.CardImageData

	contentType := r.Header.Get("Content-Type")
	if len(contentType) >= 19 && contentType[:19] == "multipart/form-data" {
		if err := r.ParseMultipartForm(20 << 20); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid multipart form"})
			return
		}
		front = r.FormValue("front")
		back = r.FormValue("back")

		images = &db.CardImageData{}
		if file, header, err := r.FormFile("front_image"); err == nil {
			defer file.Close()
			images.FrontImage, _ = io.ReadAll(file)
			images.FrontImageType = header.Header.Get("Content-Type")
		}
		if file, header, err := r.FormFile("back_image"); err == nil {
			defer file.Close()
			images.BackImage, _ = io.ReadAll(file)
			images.BackImageType = header.Header.Get("Content-Type")
		}
		if len(images.FrontImage) == 0 && len(images.BackImage) == 0 {
			images = nil
		}
	} else {
		var req createCardRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		front = req.Front
		back = req.Back
		if req.FrontImageB64 != "" {
			imgData, err := base64.StdEncoding.DecodeString(req.FrontImageB64)
			if err == nil && len(imgData) > 0 {
				images = &db.CardImageData{
					FrontImage:     imgData,
					FrontImageType: req.FrontImageType,
				}
			}
		}
	}

	if front == "" || back == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "front and back required"})
		return
	}

	card, err := h.DB.CreateCard(r.Context(), userID, deckID, front, back, images)
	if err != nil {
		slog.Error("failed to create card", "error", err, "user_id", userID, "deck_id", deckID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create card"})
		return
	}
	writeJSON(w, http.StatusCreated, card)
}

type updateCardRequest struct {
	Front string `json:"front"`
	Back  string `json:"back"`
}

func (h *CardsHandler) UpdateCard(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	cardID := chi.URLParam(r, "id")

	var req updateCardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if req.Front == "" || req.Back == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "front and back required"})
		return
	}

	if err := h.DB.UpdateCard(r.Context(), userID, cardID, req.Front, req.Back); err != nil {
		slog.Error("failed to update card", "error", err, "user_id", userID, "card_id", cardID)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "card not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *CardsHandler) DeleteCard(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	cardID := chi.URLParam(r, "id")

	if err := h.DB.DeleteCard(r.Context(), userID, cardID); err != nil {
		slog.Error("failed to delete card", "error", err, "user_id", userID, "card_id", cardID)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "card not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *CardsHandler) GetCardImage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	cardID := chi.URLParam(r, "id")
	side := chi.URLParam(r, "side")

	card, err := h.DB.GetCardForUser(r.Context(), userID, cardID)
	if err != nil || card == nil {
		http.NotFound(w, r)
		return
	}

	var data []byte
	var contentType string
	switch side {
	case "front-image":
		data = card.FrontImage
		if card.FrontImageType != nil {
			contentType = *card.FrontImageType
		}
	case "back-image":
		data = card.BackImage
		if card.BackImageType != nil {
			contentType = *card.BackImageType
		}
	default:
		http.NotFound(w, r)
		return
	}

	if len(data) == 0 {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Write(data)
}
