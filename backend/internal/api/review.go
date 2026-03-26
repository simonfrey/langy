package api

import (
	"context"
	"log/slog"
	"math/rand"
	"time"

	"github.com/simonfrey/langy/internal/db"
	"github.com/simonfrey/langy/internal/srs"
)

const minCards = 10

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

func (s *Server) GetDueCards(ctx context.Context, request GetDueCardsRequestObject) (GetDueCardsResponseObject, error) {
	userID := getUserID(ctx)
	var deckID string
	if request.Params.DeckId != nil {
		deckID = uuidStr(*request.Params.DeckId)
	}

	dueCards, err := s.DB.GetDueCards(ctx, userID, deckID)
	if err != nil {
		slog.Error("failed to get due cards", "error", err, "user_id", userID)
		return GetDueCardsdefaultJSONResponse{Body: ErrorResponse{Error: "failed to get due cards"}, StatusCode: 500}, nil
	}
	newCards, err := s.DB.GetNewCards(ctx, userID, deckID)
	if err != nil {
		slog.Error("failed to get new cards", "error", err, "user_id", userID)
		return GetDueCardsdefaultJSONResponse{Body: ErrorResponse{Error: "failed to get new cards"}, StatusCode: 500}, nil
	}

	cards := interleave(dueCards, newCards)

	if len(cards) < minCards {
		excludeIDs := make([]string, len(cards))
		for i, c := range cards {
			excludeIDs[i] = c.ID
		}
		upcoming, err := s.DB.GetUpcomingCards(ctx, userID, excludeIDs, minCards-len(cards), deckID)
		if err != nil {
			slog.Error("failed to get upcoming cards", "error", err, "user_id", userID)
		} else {
			cards = append(cards, upcoming...)
		}
	}

	rand.Shuffle(len(cards), func(i, j int) {
		cards[i], cards[j] = cards[j], cards[i]
	})

	result := make([]Card, len(cards))
	for i, c := range cards {
		result[i] = cardToAPI(c)
	}
	return GetDueCards200JSONResponse(result), nil
}

func (s *Server) SubmitReview(ctx context.Context, request SubmitReviewRequestObject) (SubmitReviewResponseObject, error) {
	userID := getUserID(ctx)
	req := request.Body
	cardID := uuidStr(req.CardId)
	if cardID == "" || req.Grade < 0 || req.Grade > 5 {
		return SubmitReviewdefaultJSONResponse{Body: ErrorResponse{Error: "card_id required and grade must be 0-5"}, StatusCode: 400}, nil
	}

	reviewedAt := time.Now()
	if req.ReviewedAt != nil {
		reviewedAt = *req.ReviewedAt
	}

	card, err := s.DB.GetCardForUser(ctx, userID, cardID)
	if err != nil {
		slog.Error("failed to get card for review", "error", err, "user_id", userID)
		return SubmitReviewdefaultJSONResponse{Body: ErrorResponse{Error: "internal error"}, StatusCode: 500}, nil
	}
	if card == nil {
		return SubmitReviewdefaultJSONResponse{Body: ErrorResponse{Error: "card not found"}, StatusCode: 404}, nil
	}

	result := srs.SM2(srs.SM2Input{
		Grade:        req.Grade,
		Repetitions:  card.Repetitions,
		EaseFactor:   card.EaseFactor,
		IntervalDays: card.IntervalDays,
	})

	if err := s.DB.UpdateCardSRS(ctx, card.ID, result.EaseFactor, result.IntervalDays, result.Repetitions, result.NextReview); err != nil {
		slog.Error("failed to update card SRS", "error", err)
		return SubmitReviewdefaultJSONResponse{Body: ErrorResponse{Error: "failed to update card"}, StatusCode: 500}, nil
	}

	if err := s.DB.CreateReviewLog(ctx, card.ID, userID, req.Grade, reviewedAt, req.ResponseTimeMs); err != nil {
		slog.Error("failed to create review log", "error", err)
		return SubmitReviewdefaultJSONResponse{Body: ErrorResponse{Error: "failed to log review"}, StatusCode: 500}, nil
	}

	card.EaseFactor = result.EaseFactor
	card.IntervalDays = result.IntervalDays
	card.Repetitions = result.Repetitions
	card.NextReview = result.NextReview

	return SubmitReview200JSONResponse(cardToAPI(*card)), nil
}
