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

type SyncHandler struct {
	DB *db.DB
}

type syncAction struct {
	CardID     string    `json:"card_id"`
	Grade      int       `json:"grade"`
	ReviewedAt time.Time `json:"reviewed_at"`
}

type syncRequest struct {
	Actions []syncAction `json:"actions"`
}

type syncResult struct {
	Processed int      `json:"processed"`
	Errors    []string `json:"errors,omitempty"`
}

func (h *SyncHandler) Sync(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req syncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	var result syncResult
	for _, action := range req.Actions {
		if action.ReviewedAt.IsZero() {
			action.ReviewedAt = time.Now()
		}

		card, err := h.DB.GetCardForUser(r.Context(), userID, action.CardID)
		if err != nil {
			slog.Warn("sync: failed to get card", "error", err, "user_id", userID, "card_id", action.CardID)
			result.Errors = append(result.Errors, "card not found: "+action.CardID)
			continue
		}
		if card == nil {
			result.Errors = append(result.Errors, "card not found: "+action.CardID)
			continue
		}

		sm2Result := srs.SM2(srs.SM2Input{
			Grade:        action.Grade,
			Repetitions:  card.Repetitions,
			EaseFactor:   card.EaseFactor,
			IntervalDays: card.IntervalDays,
		})

		if err := h.DB.UpdateCardSRS(r.Context(), card.ID, sm2Result.EaseFactor, sm2Result.IntervalDays, sm2Result.Repetitions, sm2Result.NextReview); err != nil {
			slog.Error("sync: failed to update card SRS", "error", err, "user_id", userID, "card_id", action.CardID)
			result.Errors = append(result.Errors, "failed to update card: "+action.CardID)
			continue
		}

		if err := h.DB.CreateReviewLog(r.Context(), card.ID, userID, action.Grade, action.ReviewedAt); err != nil {
			slog.Error("sync: failed to create review log", "error", err, "user_id", userID, "card_id", action.CardID)
			result.Errors = append(result.Errors, "failed to log review: "+action.CardID)
			continue
		}

		result.Processed++
	}

	slog.Info("sync completed", "user_id", userID, "processed", result.Processed, "errors", len(result.Errors))
	writeJSON(w, http.StatusOK, result)
}
