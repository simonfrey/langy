package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/simonfrey/langy/internal/db"
	"github.com/simonfrey/langy/internal/middleware"
	"github.com/simonfrey/langy/internal/srs"
)

type ReviewHandler struct {
	DB *db.DB
}

type reviewRequest struct {
	CardID     string    `json:"card_id"`
	Grade      int       `json:"grade"`
	ReviewedAt time.Time `json:"reviewed_at"`
}

func (h *ReviewHandler) GetDueCards(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	cards, err := h.DB.GetDueCards(r.Context(), userID)
	if err != nil {
		slog.Error("failed to get due cards", "error", err, "user_id", userID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get due cards"})
		return
	}
	if cards == nil {
		cards = []db.Card{}
	}
	writeJSON(w, http.StatusOK, cards)
}

func (h *ReviewHandler) SubmitReview(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req reviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if req.CardID == "" || req.Grade < 0 || req.Grade > 5 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "card_id required and grade must be 0-5"})
		return
	}
	if req.ReviewedAt.IsZero() {
		req.ReviewedAt = time.Now()
	}

	card, err := h.DB.GetCardForUser(r.Context(), userID, req.CardID)
	if err != nil {
		slog.Error("failed to get card for review", "error", err, "user_id", userID, "card_id", req.CardID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	if card == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "card not found"})
		return
	}

	result := srs.SM2(srs.SM2Input{
		Grade:        req.Grade,
		Repetitions:  card.Repetitions,
		EaseFactor:   card.EaseFactor,
		IntervalDays: card.IntervalDays,
	})

	if err := h.DB.UpdateCardSRS(r.Context(), card.ID, result.EaseFactor, result.IntervalDays, result.Repetitions, result.NextReview); err != nil {
		slog.Error("failed to update card SRS", "error", err, "user_id", userID, "card_id", card.ID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update card"})
		return
	}

	if err := h.DB.CreateReviewLog(r.Context(), card.ID, userID, req.Grade, req.ReviewedAt); err != nil {
		slog.Error("failed to create review log", "error", err, "user_id", userID, "card_id", card.ID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to log review"})
		return
	}

	card.EaseFactor = result.EaseFactor
	card.IntervalDays = result.IntervalDays
	card.Repetitions = result.Repetitions
	card.NextReview = result.NextReview

	writeJSON(w, http.StatusOK, card)
}
