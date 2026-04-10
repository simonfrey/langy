package api

import (
	"context"
	"log/slog"
)

func (s *Server) ListDecks(ctx context.Context, _ ListDecksRequestObject) (ListDecksResponseObject, error) {
	userID := getUserID(ctx)
	decks, err := s.DB.ListDecks(ctx, userID)
	if err != nil {
		slog.Error("failed to list decks", "error", err, "user_id", userID)
		return ListDecksdefaultJSONResponse{Body: ErrorResponse{Error: "failed to list decks"}, StatusCode: 500}, nil
	}
	result := make([]Deck, len(decks))
	for i, d := range decks {
		result[i] = deckToAPI(d)
	}
	return ListDecks200JSONResponse(result), nil
}

func (s *Server) CreateDeck(ctx context.Context, request CreateDeckRequestObject) (CreateDeckResponseObject, error) {
	userID := getUserID(ctx)
	req := request.Body
	if req.Name == "" || req.SourceLang == "" || req.TargetLang == "" {
		return CreateDeckdefaultJSONResponse{Body: ErrorResponse{Error: "name, source_lang, and target_lang required"}, StatusCode: 400}, nil
	}
	if !IsValidPair(req.SourceLang, req.TargetLang) {
		return CreateDeckdefaultJSONResponse{Body: ErrorResponse{Error: "unsupported language pair"}, StatusCode: 400}, nil
	}

	deck, err := s.DB.CreateDeck(ctx, userID, req.Name, req.SourceLang, req.TargetLang)
	if err != nil {
		slog.Error("failed to create deck", "error", err, "user_id", userID)
		return CreateDeckdefaultJSONResponse{Body: ErrorResponse{Error: "failed to create deck"}, StatusCode: 500}, nil
	}
	return CreateDeck201JSONResponse(deckToAPI(*deck)), nil
}

func (s *Server) DeleteDeck(ctx context.Context, request DeleteDeckRequestObject) (DeleteDeckResponseObject, error) {
	userID := getUserID(ctx)
	if err := s.DB.DeleteDeck(ctx, userID, uuidStr(request.Id)); err != nil {
		slog.Error("failed to delete deck", "error", err, "user_id", userID)
		return DeleteDeckdefaultJSONResponse{Body: ErrorResponse{Error: "deck not found"}, StatusCode: 404}, nil
	}
	return DeleteDeck200JSONResponse{Status: "deleted"}, nil
}
