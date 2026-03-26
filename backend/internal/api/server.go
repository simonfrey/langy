package api

import (
	"context"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/simonfrey/langy/internal/db"
	"github.com/simonfrey/langy/internal/gemini"
	"github.com/simonfrey/langy/internal/middleware"
)

const maxCardTextLength = 10000

// Server implements StrictServerInterface.
type Server struct {
	DB     *db.DB
	Gemini *gemini.Client
}

var _ StrictServerInterface = (*Server)(nil)

// --- helpers ---

func toUUID(s string) openapi_types.UUID {
	var u openapi_types.UUID
	_ = u.UnmarshalText([]byte(s))
	return u
}

func uuidStr(u openapi_types.UUID) string {
	return u.String()
}

func ptrStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func cardToAPI(c db.Card) Card {
	return Card{
		Id:            toUUID(c.ID),
		DeckId:        toUUID(c.DeckID),
		Front:         c.Front,
		Back:          c.Back,
		FrontImageUrl: ptrStr(c.FrontImageURL),
		BackImageUrl:  ptrStr(c.BackImageURL),
		EaseFactor:    c.EaseFactor,
		IntervalDays:  c.IntervalDays,
		Repetitions:   c.Repetitions,
		NextReview:    c.NextReview,
		CreatedAt:     c.CreatedAt,
		UpdatedAt:     c.UpdatedAt,
	}
}

func deckToAPI(d db.Deck) Deck {
	return Deck{
		Id:         toUUID(d.ID),
		UserId:     toUUID(d.UserID),
		Name:       d.Name,
		SourceLang: d.SourceLang,
		TargetLang: d.TargetLang,
		CreatedAt:  d.CreatedAt,
	}
}

func userToAPI(u *db.User) User {
	return User{
		Id:        toUUID(u.ID),
		Email:     u.Email,
		CreatedAt: u.CreatedAt,
	}
}

func getUserID(ctx context.Context) string {
	return middleware.GetUserID(ctx)
}
