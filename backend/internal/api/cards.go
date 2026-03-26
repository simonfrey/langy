package api

import (
	"context"
	"log/slog"
)

func (s *Server) ListCards(ctx context.Context, request ListCardsRequestObject) (ListCardsResponseObject, error) {
	userID := getUserID(ctx)
	cards, err := s.DB.ListCards(ctx, userID, uuidStr(request.DeckId))
	if err != nil {
		slog.Error("failed to list cards", "error", err, "user_id", userID)
		return ListCardsdefaultJSONResponse{Body: ErrorResponse{Error: "failed to list cards"}, StatusCode: 500}, nil
	}
	result := make([]Card, len(cards))
	for i, c := range cards {
		result[i] = cardToAPI(c)
	}
	return ListCards200JSONResponse(result), nil
}

func (s *Server) CreateCard(ctx context.Context, request CreateCardRequestObject) (CreateCardResponseObject, error) {
	userID := getUserID(ctx)
	req := request.Body
	if req.Front == "" || req.Back == "" {
		return CreateCarddefaultJSONResponse{Body: ErrorResponse{Error: "front and back required"}, StatusCode: 400}, nil
	}
	if len(req.Front) > maxCardTextLength || len(req.Back) > maxCardTextLength {
		return CreateCarddefaultJSONResponse{Body: ErrorResponse{Error: "card text too long"}, StatusCode: 400}, nil
	}

	var frontImgID, backImgID string
	if req.FrontImageId != nil {
		frontImgID = uuidStr(*req.FrontImageId)
	}
	if req.BackImageId != nil {
		backImgID = uuidStr(*req.BackImageId)
	}

	card, err := s.DB.CreateCardWithImages(ctx, userID, uuidStr(request.DeckId), req.Front, req.Back, frontImgID, backImgID)
	if err != nil {
		slog.Error("failed to create card", "error", err, "user_id", userID)
		return CreateCarddefaultJSONResponse{Body: ErrorResponse{Error: "failed to create card"}, StatusCode: 500}, nil
	}
	return CreateCard201JSONResponse(cardToAPI(*card)), nil
}

func (s *Server) UpdateCard(ctx context.Context, request UpdateCardRequestObject) (UpdateCardResponseObject, error) {
	userID := getUserID(ctx)
	req := request.Body
	if req.Front == "" || req.Back == "" {
		return UpdateCarddefaultJSONResponse{Body: ErrorResponse{Error: "front and back required"}, StatusCode: 400}, nil
	}
	if len(req.Front) > maxCardTextLength || len(req.Back) > maxCardTextLength {
		return UpdateCarddefaultJSONResponse{Body: ErrorResponse{Error: "card text too long"}, StatusCode: 400}, nil
	}

	var frontImgID, backImgID string
	if req.FrontImageId != nil {
		frontImgID = uuidStr(*req.FrontImageId)
	}
	if req.BackImageId != nil {
		backImgID = uuidStr(*req.BackImageId)
	}

	if err := s.DB.UpdateCardFields(ctx, userID, uuidStr(request.Id), req.Front, req.Back, frontImgID, backImgID); err != nil {
		slog.Error("failed to update card", "error", err, "user_id", userID)
		return UpdateCarddefaultJSONResponse{Body: ErrorResponse{Error: "card not found"}, StatusCode: 404}, nil
	}
	return UpdateCard200JSONResponse{Status: "updated"}, nil
}

func (s *Server) DeleteCard(ctx context.Context, request DeleteCardRequestObject) (DeleteCardResponseObject, error) {
	userID := getUserID(ctx)
	if err := s.DB.DeleteCard(ctx, userID, uuidStr(request.Id)); err != nil {
		slog.Error("failed to delete card", "error", err, "user_id", userID)
		return DeleteCarddefaultJSONResponse{Body: ErrorResponse{Error: "card not found"}, StatusCode: 404}, nil
	}
	return DeleteCard200JSONResponse{Status: "deleted"}, nil
}
