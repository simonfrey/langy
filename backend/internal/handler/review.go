package handler

import (
	"encoding/json"
	"log/slog"
	"math/rand"
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

const minCards = 10

func (h *ReviewHandler) GetDueCards(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	dueCards, err := h.DB.GetDueCards(r.Context(), userID)
	if err != nil {
		slog.Error("failed to get due cards", "error", err, "user_id", userID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get due cards"})
		return
	}
	newCards, err := h.DB.GetNewCards(r.Context(), userID)
	if err != nil {
		slog.Error("failed to get new cards", "error", err, "user_id", userID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get new cards"})
		return
	}

	cards := interleave(dueCards, newCards)

	// If we have fewer than minCards, fill with soonest upcoming reviewed cards
	if len(cards) < minCards {
		excludeIDs := make([]string, len(cards))
		for i, c := range cards {
			excludeIDs[i] = c.ID
		}
		upcoming, err := h.DB.GetUpcomingCards(r.Context(), userID, excludeIDs, minCards-len(cards))
		if err != nil {
			slog.Error("failed to get upcoming cards", "error", err, "user_id", userID)
		} else {
			cards = append(cards, upcoming...)
		}
	}

	if cards == nil {
		cards = []db.Card{}
	}

	rand.Shuffle(len(cards), func(i, j int) {
		cards[i], cards[j] = cards[j], cards[i]
	})

	writeJSON(w, http.StatusOK, cards)
}

// interleave evenly mixes two slices, spreading the shorter one across the longer.
func interleave(a, b []db.Card) []db.Card {
	if len(a) == 0 {
		return b
	}
	if len(b) == 0 {
		return a
	}
	total := len(a) + len(b)
	result := make([]db.Card, 0, total)
	ai, bi := 0, 0
	for ai+bi < total {
		// Pick from a if a's proportion is behind or equal
		if ai < len(a) && (bi >= len(b) || float64(ai+1)/float64(len(a)) <= float64(bi+1)/float64(len(b))) {
			result = append(result, a[ai])
			ai++
		} else {
			result = append(result, b[bi])
			bi++
		}
	}
	return result
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
