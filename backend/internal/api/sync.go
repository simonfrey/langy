package api

import (
	"context"
	"log/slog"
	"time"

	"github.com/simonfrey/langy/internal/srs"
)

func (s *Server) Sync(ctx context.Context, request SyncRequestObject) (SyncResponseObject, error) {
	userID := getUserID(ctx)
	req := request.Body

	var syncResult SyncResult
	var syncErrors []string
	for _, action := range req.Actions {
		reviewedAt := time.Now()
		if action.ReviewedAt != nil {
			reviewedAt = *action.ReviewedAt
		}

		actionCardID := uuidStr(action.CardId)
		card, err := s.DB.GetCardForUser(ctx, userID, actionCardID)
		if err != nil || card == nil {
			syncErrors = append(syncErrors, "card not found: "+actionCardID)
			continue
		}

		sm2Result := srs.SM2(srs.SM2Input{
			Grade:        action.Grade,
			Repetitions:  card.Repetitions,
			EaseFactor:   card.EaseFactor,
			IntervalDays: card.IntervalDays,
		})

		if err := s.DB.UpdateCardSRS(ctx, card.ID, sm2Result.EaseFactor, sm2Result.IntervalDays, sm2Result.Repetitions, sm2Result.NextReview); err != nil {
			syncErrors = append(syncErrors, "failed to update card: "+actionCardID)
			continue
		}

		if err := s.DB.CreateReviewLog(ctx, card.ID, userID, action.Grade, reviewedAt, action.ResponseTimeMs); err != nil {
			syncErrors = append(syncErrors, "failed to log review: "+actionCardID)
			continue
		}

		syncResult.Processed++
	}
	if len(syncErrors) > 0 {
		syncResult.Errors = &syncErrors
	}

	slog.Info("sync completed", "user_id", userID, "processed", syncResult.Processed, "errors", len(syncErrors))
	return Sync200JSONResponse(syncResult), nil
}
