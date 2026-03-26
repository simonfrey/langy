package db

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DB wraps sqlc-generated Queries with connection management and domain-type conversions.
type DB struct {
	*Queries
	Pool *pgxpool.Pool
}

func NewDB(ctx context.Context, databaseURL string) (*DB, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return &DB{Queries: New(pool), Pool: pool}, nil
}

func (d *DB) Close() {
	d.Pool.Close()
}

// --- Types with JSON tags (sqlc-generated models use pgtype and lack JSON tags) ---

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

type Deck struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	Name       string    `json:"name"`
	SourceLang string    `json:"source_lang"`
	TargetLang string    `json:"target_lang"`
	CreatedAt  time.Time `json:"created_at"`
}

type Card struct {
	ID             string    `json:"id"`
	DeckID         string    `json:"deck_id"`
	Front          string    `json:"front"`
	Back           string    `json:"back"`
	FrontImage     []byte    `json:"-"`
	FrontImageType *string   `json:"-"`
	BackImage      []byte    `json:"-"`
	BackImageType  *string   `json:"-"`
	EaseFactor     float64   `json:"ease_factor"`
	IntervalDays   int       `json:"interval_days"`
	Repetitions    int       `json:"repetitions"`
	NextReview     time.Time `json:"next_review"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	FrontImageURL  string    `json:"front_image_url,omitempty"`
	BackImageURL   string    `json:"back_image_url,omitempty"`
}

func (c *Card) PopulateImageURLs() {
	if len(c.FrontImage) > 0 {
		c.FrontImageURL = "/api/cards/" + c.ID + "/front-image"
	}
	if len(c.BackImage) > 0 {
		c.BackImageURL = "/api/cards/" + c.ID + "/back-image"
	}
}

type CardText struct {
	Front string
	Back  string
}

type CardImageData struct {
	FrontImage     []byte
	FrontImageType string
	BackImage      []byte
	BackImageType  string
}

type CardPairInput struct {
	Front          string
	Back           string
	FrontImage     []byte
	FrontImageType string
}

type Exercise struct {
	ID             string          `json:"id"`
	UserID         string          `json:"user_id"`
	SessionID      string          `json:"session_id"`
	SourceCardID   string          `json:"source_card_id"`
	Type           string          `json:"type"`
	Level          int             `json:"level"`
	Instruction    string          `json:"instruction"`
	Prompt         string          `json:"prompt"`
	CorrectAnswer  string          `json:"correct_answer"`
	Hint           *string         `json:"hint,omitempty"`
	SourceSentence *string         `json:"source_sentence,omitempty"`
	Options        []byte          `json:"options,omitempty"`
	Data           json.RawMessage `json:"data,omitempty"`
	Completed      bool            `json:"completed"`
	UserAnswer     *string         `json:"user_answer,omitempty"`
	Correct        *bool           `json:"correct,omitempty"`
	Feedback       *string         `json:"feedback,omitempty"`
	NextReview     *time.Time      `json:"next_review,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}

type CardNeedingExercise struct {
	UserID       string
	CardID       string
	Front        string
	Back         string
	Repetitions  int
	IntervalDays int
	SourceLang   string
	TargetLang   string
}

// --- UUID/time helpers ---

func ParseUUID(s string) pgtype.UUID {
	var u pgtype.UUID
	_ = u.Scan(s)
	return u
}

func uuidToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
}

func toTimestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

func fromTimestamptz(t pgtype.Timestamptz) time.Time {
	if !t.Valid {
		return time.Time{}
	}
	return t.Time
}

func ptrFromTimestamptz(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	return &t.Time
}

func derefFloat32(p *float32, def float64) float64 {
	if p == nil {
		return def
	}
	return float64(*p)
}

func derefInt32(p *int32, def int) int {
	if p == nil {
		return def
	}
	return int(*p)
}

func derefBool(p *bool) bool {
	if p == nil {
		return false
	}
	return *p
}

func float32Ptr(f float64) *float32 {
	v := float32(f)
	return &v
}

func int32Ptr(i int) *int32 {
	v := int32(i)
	return &v
}

// --- Row converters ---

func cardFromRow(id, deckID pgtype.UUID, front, back string, frontImage []byte, frontImageType *string, backImage []byte, backImageType *string, easeFactor *float32, intervalDays, repetitions *int32, nextReview, createdAt, updatedAt pgtype.Timestamptz) Card {
	c := Card{
		ID:             uuidToString(id),
		DeckID:         uuidToString(deckID),
		Front:          front,
		Back:           back,
		FrontImage:     frontImage,
		FrontImageType: frontImageType,
		BackImage:      backImage,
		BackImageType:  backImageType,
		EaseFactor:     derefFloat32(easeFactor, 2.5),
		IntervalDays:   derefInt32(intervalDays, 0),
		Repetitions:    derefInt32(repetitions, 0),
		NextReview:     fromTimestamptz(nextReview),
		CreatedAt:      fromTimestamptz(createdAt),
		UpdatedAt:      fromTimestamptz(updatedAt),
	}
	c.PopulateImageURLs()
	return c
}

func cardFromCreateRow(r CreateCardRow) Card {
	return cardFromRow(r.ID, r.DeckID, r.Front, r.Back, r.FrontImage, r.FrontImageType, r.BackImage, r.BackImageType, r.EaseFactor, r.IntervalDays, r.Repetitions, r.NextReview, r.CreatedAt, r.UpdatedAt)
}

func cardFromCreateFrontRow(r CreateCardWithFrontImageRow) Card {
	return cardFromRow(r.ID, r.DeckID, r.Front, r.Back, r.FrontImage, r.FrontImageType, r.BackImage, r.BackImageType, r.EaseFactor, r.IntervalDays, r.Repetitions, r.NextReview, r.CreatedAt, r.UpdatedAt)
}

func cardFromCreateAllRow(r CreateCardWithAllImagesRow) Card {
	return cardFromRow(r.ID, r.DeckID, r.Front, r.Back, r.FrontImage, r.FrontImageType, r.BackImage, r.BackImageType, r.EaseFactor, r.IntervalDays, r.Repetitions, r.NextReview, r.CreatedAt, r.UpdatedAt)
}

func cardFromGetRow(r GetCardForUserRow) Card {
	return cardFromRow(r.ID, r.DeckID, r.Front, r.Back, r.FrontImage, r.FrontImageType, r.BackImage, r.BackImageType, r.EaseFactor, r.IntervalDays, r.Repetitions, r.NextReview, r.CreatedAt, r.UpdatedAt)
}

func cardFromListRow(r ListCardsRow) Card {
	return cardFromRow(r.ID, r.DeckID, r.Front, r.Back, r.FrontImage, r.FrontImageType, r.BackImage, r.BackImageType, r.EaseFactor, r.IntervalDays, r.Repetitions, r.NextReview, r.CreatedAt, r.UpdatedAt)
}

func cardFromDueRow(r GetDueCardsRow) Card {
	return cardFromRow(r.ID, r.DeckID, r.Front, r.Back, r.FrontImage, r.FrontImageType, r.BackImage, r.BackImageType, r.EaseFactor, r.IntervalDays, r.Repetitions, r.NextReview, r.CreatedAt, r.UpdatedAt)
}

func cardFromNewRow(r GetNewCardsRow) Card {
	return cardFromRow(r.ID, r.DeckID, r.Front, r.Back, r.FrontImage, r.FrontImageType, r.BackImage, r.BackImageType, r.EaseFactor, r.IntervalDays, r.Repetitions, r.NextReview, r.CreatedAt, r.UpdatedAt)
}

func cardFromUpcomingRow(r GetUpcomingCardsRow) Card {
	return cardFromRow(r.ID, r.DeckID, r.Front, r.Back, r.FrontImage, r.FrontImageType, r.BackImage, r.BackImageType, r.EaseFactor, r.IntervalDays, r.Repetitions, r.NextReview, r.CreatedAt, r.UpdatedAt)
}

func exerciseFromSaveRow(r SaveExerciseRow) Exercise {
	return Exercise{
		ID:             uuidToString(r.ID),
		UserID:         uuidToString(r.UserID),
		SessionID:      uuidToString(r.SessionID),
		SourceCardID:   uuidToString(r.SourceCardID),
		Type:           r.Type,
		Level:          int(r.Level),
		Instruction:    r.Instruction,
		Prompt:         r.Prompt,
		CorrectAnswer:  r.CorrectAnswer,
		Hint:           r.Hint,
		SourceSentence: r.SourceSentence,
		Options:        r.Options,
		Data:           r.Data,
		Completed:      derefBool(r.Completed),
		UserAnswer:     r.UserAnswer,
		Correct:        r.Correct,
		Feedback:       r.Feedback,
		NextReview:     ptrFromTimestamptz(r.NextReview),
		CreatedAt:      fromTimestamptz(r.CreatedAt),
	}
}

func exerciseFromDueRow(r GetDueExercisesRow) Exercise {
	return Exercise{
		ID:             uuidToString(r.ID),
		UserID:         uuidToString(r.UserID),
		SessionID:      uuidToString(r.SessionID),
		SourceCardID:   uuidToString(r.SourceCardID),
		Type:           r.Type,
		Level:          int(r.Level),
		Instruction:    r.Instruction,
		Prompt:         r.Prompt,
		CorrectAnswer:  r.CorrectAnswer,
		Hint:           r.Hint,
		SourceSentence: r.SourceSentence,
		Options:        r.Options,
		Data:           r.Data,
		Completed:      derefBool(r.Completed),
		UserAnswer:     r.UserAnswer,
		Correct:        r.Correct,
		Feedback:       r.Feedback,
		NextReview:     ptrFromTimestamptz(r.NextReview),
		CreatedAt:      fromTimestamptz(r.CreatedAt),
	}
}

func exerciseFromUncompletedRow(r GetUncompletedExercisesRow) Exercise {
	return Exercise{
		ID:             uuidToString(r.ID),
		UserID:         uuidToString(r.UserID),
		SessionID:      uuidToString(r.SessionID),
		SourceCardID:   uuidToString(r.SourceCardID),
		Type:           r.Type,
		Level:          int(r.Level),
		Instruction:    r.Instruction,
		Prompt:         r.Prompt,
		CorrectAnswer:  r.CorrectAnswer,
		Hint:           r.Hint,
		SourceSentence: r.SourceSentence,
		Options:        r.Options,
		Data:           r.Data,
		Completed:      derefBool(r.Completed),
		UserAnswer:     r.UserAnswer,
		Correct:        r.Correct,
		Feedback:       r.Feedback,
		NextReview:     ptrFromTimestamptz(r.NextReview),
		CreatedAt:      fromTimestamptz(r.CreatedAt),
	}
}

// --- Wrapper methods ---

func (d *DB) CreateUser(ctx context.Context, email, passwordHash string) (*User, error) {
	u, err := d.Queries.CreateUser(ctx, CreateUserParams{Email: email, PasswordHash: passwordHash})
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return &User{ID: uuidToString(u.ID), Email: u.Email, PasswordHash: u.PasswordHash, CreatedAt: fromTimestamptz(u.CreatedAt)}, nil
}

func (d *DB) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	u, err := d.Queries.GetUserByEmail(ctx, email)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get user by email: %w", err)
	}
	return &User{ID: uuidToString(u.ID), Email: u.Email, PasswordHash: u.PasswordHash, CreatedAt: fromTimestamptz(u.CreatedAt)}, nil
}

func (d *DB) ListDecks(ctx context.Context, userID string) ([]Deck, error) {
	rows, err := d.Queries.ListDecks(ctx, ParseUUID(userID))
	if err != nil {
		return nil, fmt.Errorf("list decks: %w", err)
	}
	decks := make([]Deck, len(rows))
	for i, r := range rows {
		decks[i] = Deck{ID: uuidToString(r.ID), UserID: uuidToString(r.UserID), Name: r.Name, SourceLang: r.SourceLang, TargetLang: r.TargetLang, CreatedAt: fromTimestamptz(r.CreatedAt)}
	}
	return decks, nil
}

func (d *DB) CreateDeck(ctx context.Context, userID, name, sourceLang, targetLang string) (*Deck, error) {
	r, err := d.Queries.CreateDeck(ctx, CreateDeckParams{UserID: ParseUUID(userID), Name: name, SourceLang: sourceLang, TargetLang: targetLang})
	if err != nil {
		return nil, fmt.Errorf("create deck: %w", err)
	}
	return &Deck{ID: uuidToString(r.ID), UserID: uuidToString(r.UserID), Name: r.Name, SourceLang: r.SourceLang, TargetLang: r.TargetLang, CreatedAt: fromTimestamptz(r.CreatedAt)}, nil
}

func (d *DB) DeleteDeck(ctx context.Context, userID, deckID string) error {
	n, err := d.Queries.DeleteDeck(ctx, DeleteDeckParams{ID: ParseUUID(deckID), UserID: ParseUUID(userID)})
	if err != nil {
		return fmt.Errorf("delete deck: %w", err)
	}
	if n == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (d *DB) GetDeck(ctx context.Context, userID, deckID string) (*Deck, error) {
	r, err := d.Queries.GetDeck(ctx, GetDeckParams{ID: ParseUUID(deckID), UserID: ParseUUID(userID)})
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get deck: %w", err)
	}
	return &Deck{ID: uuidToString(r.ID), UserID: uuidToString(r.UserID), Name: r.Name, SourceLang: r.SourceLang, TargetLang: r.TargetLang, CreatedAt: fromTimestamptz(r.CreatedAt)}, nil
}

func (d *DB) ListCards(ctx context.Context, userID, deckID string) ([]Card, error) {
	rows, err := d.Queries.ListCards(ctx, ListCardsParams{DeckID: ParseUUID(deckID), UserID: ParseUUID(userID)})
	if err != nil {
		return nil, fmt.Errorf("list cards: %w", err)
	}
	cards := make([]Card, len(rows))
	for i, r := range rows {
		cards[i] = cardFromListRow(r)
	}
	return cards, nil
}

func (d *DB) ListCardTexts(ctx context.Context, userID, deckID string) ([]CardText, error) {
	rows, err := d.Queries.ListCardTexts(ctx, ListCardTextsParams{DeckID: ParseUUID(deckID), UserID: ParseUUID(userID)})
	if err != nil {
		return nil, fmt.Errorf("list card texts: %w", err)
	}
	texts := make([]CardText, len(rows))
	for i, r := range rows {
		texts[i] = CardText(r)
	}
	return texts, nil
}

func (d *DB) CreateCard(ctx context.Context, userID, deckID, front, back string, images *CardImageData) (*Card, error) {
	dk, err := d.GetDeck(ctx, userID, deckID)
	if err != nil {
		return nil, fmt.Errorf("create card get deck: %w", err)
	}
	if dk == nil {
		return nil, pgx.ErrNoRows
	}

	dkUUID := ParseUUID(deckID)

	if images != nil && len(images.FrontImage) > 0 && len(images.BackImage) > 0 {
		frontImgType := &images.FrontImageType
		backImgType := &images.BackImageType
		r, err := d.CreateCardWithAllImages(ctx, CreateCardWithAllImagesParams{
			DeckID: dkUUID, Front: front, Back: back,
			FrontImage: images.FrontImage, FrontImageType: frontImgType,
			BackImage: images.BackImage, BackImageType: backImgType,
		})
		if err != nil {
			return nil, fmt.Errorf("create card: %w", err)
		}
		c := cardFromCreateAllRow(r)
		return &c, nil
	}
	if images != nil && len(images.FrontImage) > 0 {
		frontImgType := &images.FrontImageType
		r, err := d.CreateCardWithFrontImage(ctx, CreateCardWithFrontImageParams{
			DeckID: dkUUID, Front: front, Back: back,
			FrontImage: images.FrontImage, FrontImageType: frontImgType,
		})
		if err != nil {
			return nil, fmt.Errorf("create card: %w", err)
		}
		c := cardFromCreateFrontRow(r)
		return &c, nil
	}

	r, err := d.Queries.CreateCard(ctx, CreateCardParams{DeckID: dkUUID, Front: front, Back: back})
	if err != nil {
		return nil, fmt.Errorf("create card: %w", err)
	}
	c := cardFromCreateRow(r)
	return &c, nil
}

func (d *DB) CreateCards(ctx context.Context, userID, deckID string, pairs []CardPairInput) ([]Card, error) {
	dk, err := d.GetDeck(ctx, userID, deckID)
	if err != nil {
		return nil, fmt.Errorf("create cards get deck: %w", err)
	}
	if dk == nil {
		return nil, pgx.ErrNoRows
	}

	dkUUID := ParseUUID(deckID)
	var cards []Card
	for _, p := range pairs {
		var c Card
		if len(p.FrontImage) > 0 {
			imgType := p.FrontImageType
			r, err := d.CreateCardWithFrontImage(ctx, CreateCardWithFrontImageParams{
				DeckID: dkUUID, Front: p.Front, Back: p.Back,
				FrontImage: p.FrontImage, FrontImageType: &imgType,
			})
			if err != nil {
				return nil, fmt.Errorf("create cards insert: %w", err)
			}
			c = cardFromCreateFrontRow(r)
		} else {
			r, err := d.Queries.CreateCard(ctx, CreateCardParams{DeckID: dkUUID, Front: p.Front, Back: p.Back})
			if err != nil {
				return nil, fmt.Errorf("create cards insert: %w", err)
			}
			c = cardFromCreateRow(r)
		}
		cards = append(cards, c)
	}
	return cards, nil
}

func (d *DB) GetCardForUser(ctx context.Context, userID, cardID string) (*Card, error) {
	r, err := d.Queries.GetCardForUser(ctx, GetCardForUserParams{ID: ParseUUID(cardID), UserID: ParseUUID(userID)})
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get card for user: %w", err)
	}
	c := cardFromGetRow(r)
	return &c, nil
}

func (d *DB) UpdateCardSRS(ctx context.Context, cardID string, easeFactor float64, intervalDays, repetitions int, nextReview time.Time) error {
	return d.Queries.UpdateCardSRS(ctx, UpdateCardSRSParams{
		EaseFactor:   float32Ptr(easeFactor),
		IntervalDays: int32Ptr(intervalDays),
		Repetitions:  int32Ptr(repetitions),
		NextReview:   toTimestamptz(nextReview),
		ID:           ParseUUID(cardID),
	})
}

func (d *DB) UpdateCard(ctx context.Context, userID, cardID, front, back string, images *CardImageData) error {
	cardUUID := ParseUUID(cardID)
	userUUID := ParseUUID(userID)

	var n int64
	var err error

	if images != nil && images.FrontImage != nil && images.BackImage != nil {
		n, err = d.UpdateCardWithBothImages(ctx, UpdateCardWithBothImagesParams{
			Front: front, Back: back,
			FrontImage: images.FrontImage, FrontImageType: &images.FrontImageType,
			BackImage: images.BackImage, BackImageType: &images.BackImageType,
			ID: cardUUID, UserID: userUUID,
		})
	} else if images != nil && images.FrontImage != nil {
		n, err = d.UpdateCardWithFrontImage(ctx, UpdateCardWithFrontImageParams{
			Front: front, Back: back,
			FrontImage: images.FrontImage, FrontImageType: &images.FrontImageType,
			ID: cardUUID, UserID: userUUID,
		})
	} else if images != nil && images.BackImage != nil {
		n, err = d.UpdateCardWithBackImage(ctx, UpdateCardWithBackImageParams{
			Front: front, Back: back,
			BackImage: images.BackImage, BackImageType: &images.BackImageType,
			ID: cardUUID, UserID: userUUID,
		})
	} else {
		n, err = d.UpdateCardText(ctx, UpdateCardTextParams{
			Front: front, Back: back, ID: cardUUID, UserID: userUUID,
		})
	}
	if err != nil {
		return fmt.Errorf("update card: %w", err)
	}
	if n == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (d *DB) DeleteCard(ctx context.Context, userID, cardID string) error {
	n, err := d.Queries.DeleteCard(ctx, DeleteCardParams{ID: ParseUUID(cardID), UserID: ParseUUID(userID)})
	if err != nil {
		return fmt.Errorf("delete card: %w", err)
	}
	if n == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (d *DB) GetDueCards(ctx context.Context, userID string, deckID string) ([]Card, error) {
	var deckUUID pgtype.UUID
	if deckID != "" {
		deckUUID = ParseUUID(deckID)
	}
	rows, err := d.Queries.GetDueCards(ctx, GetDueCardsParams{UserID: ParseUUID(userID), DeckID: deckUUID})
	if err != nil {
		return nil, fmt.Errorf("get due cards: %w", err)
	}
	cards := make([]Card, len(rows))
	for i, r := range rows {
		cards[i] = cardFromDueRow(r)
	}
	return cards, nil
}

func (d *DB) GetNewCards(ctx context.Context, userID string, deckID string) ([]Card, error) {
	var deckUUID pgtype.UUID
	if deckID != "" {
		deckUUID = ParseUUID(deckID)
	}
	rows, err := d.Queries.GetNewCards(ctx, GetNewCardsParams{UserID: ParseUUID(userID), DeckID: deckUUID})
	if err != nil {
		return nil, fmt.Errorf("get new cards: %w", err)
	}
	cards := make([]Card, len(rows))
	for i, r := range rows {
		cards[i] = cardFromNewRow(r)
	}
	return cards, nil
}

func (d *DB) GetUpcomingCards(ctx context.Context, userID string, excludeIDs []string, limit int, deckID string) ([]Card, error) {
	excludeUUIDs := make([]pgtype.UUID, len(excludeIDs))
	for i, id := range excludeIDs {
		excludeUUIDs[i] = ParseUUID(id)
	}
	var deckUUID pgtype.UUID
	if deckID != "" {
		deckUUID = ParseUUID(deckID)
	}
	rows, err := d.Queries.GetUpcomingCards(ctx, GetUpcomingCardsParams{
		UserID: ParseUUID(userID), Column2: excludeUUIDs, Limit: int32(limit), DeckID: deckUUID,
	})
	if err != nil {
		return nil, fmt.Errorf("get upcoming cards: %w", err)
	}
	cards := make([]Card, len(rows))
	for i, r := range rows {
		cards[i] = cardFromUpcomingRow(r)
	}
	return cards, nil
}

func (d *DB) CreateReviewLog(ctx context.Context, cardID, userID string, grade int, reviewedAt time.Time, responseTimeMs *int) error {
	var rtMs *int32
	if responseTimeMs != nil {
		v := int32(*responseTimeMs)
		rtMs = &v
	}
	return d.Queries.CreateReviewLog(ctx, CreateReviewLogParams{
		CardID: ParseUUID(cardID), UserID: ParseUUID(userID),
		Grade: int32(grade), ReviewedAt: toTimestamptz(reviewedAt), ResponseTimeMs: rtMs,
	})
}

func (d *DB) SaveExercises(ctx context.Context, userID string, exercises []Exercise) ([]Exercise, error) {
	saved := make([]Exercise, 0, len(exercises))
	for _, ex := range exercises {
		r, err := d.SaveExercise(ctx, SaveExerciseParams{
			UserID:         ParseUUID(userID),
			SessionID:      ParseUUID(ex.SessionID),
			SourceCardID:   ParseUUID(ex.SourceCardID),
			Type:           ex.Type,
			Level:          int32(ex.Level),
			Instruction:    ex.Instruction,
			Prompt:         ex.Prompt,
			CorrectAnswer:  ex.CorrectAnswer,
			Hint:           ex.Hint,
			SourceSentence: ex.SourceSentence,
			Options:        ex.Options,
			Data:           ex.Data,
		})
		if err != nil {
			return nil, fmt.Errorf("save exercise: %w", err)
		}
		saved = append(saved, exerciseFromSaveRow(r))
	}
	return saved, nil
}

func (d *DB) UpdateExerciseResult(ctx context.Context, userID, exerciseID, userAnswer string, correct bool, feedback string) error {
	userUUID := ParseUUID(userID)
	exUUID := ParseUUID(exerciseID)
	ua := &userAnswer
	c := &correct
	fb := &feedback

	var n int64
	var err error
	if correct {
		n, err = d.UpdateExerciseResultCorrect(ctx, UpdateExerciseResultCorrectParams{
			UserAnswer: ua, Correct: c, Feedback: fb, UserID: userUUID, ID: exUUID,
		})
	} else {
		n, err = d.UpdateExerciseResultIncorrect(ctx, UpdateExerciseResultIncorrectParams{
			UserAnswer: ua, Correct: c, Feedback: fb, UserID: userUUID, ID: exUUID,
		})
	}
	if err != nil {
		return fmt.Errorf("update exercise result: %w", err)
	}
	if n == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (d *DB) GetDueExercises(ctx context.Context, userID string) ([]Exercise, error) {
	rows, err := d.Queries.GetDueExercises(ctx, ParseUUID(userID))
	if err != nil {
		return nil, fmt.Errorf("get due exercises: %w", err)
	}
	exercises := make([]Exercise, len(rows))
	for i, r := range rows {
		exercises[i] = exerciseFromDueRow(r)
	}
	return exercises, nil
}

func (d *DB) GetUncompletedExercises(ctx context.Context, userID string) ([]Exercise, error) {
	rows, err := d.Queries.GetUncompletedExercises(ctx, ParseUUID(userID))
	if err != nil {
		return nil, fmt.Errorf("get uncompleted exercises: %w", err)
	}
	exercises := make([]Exercise, len(rows))
	for i, r := range rows {
		exercises[i] = exerciseFromUncompletedRow(r)
	}
	return exercises, nil
}

func (d *DB) GetCardsNeedingExercises(ctx context.Context, limit int) ([]CardNeedingExercise, error) {
	rows, err := d.Queries.GetCardsNeedingExercises(ctx, int32(limit))
	if err != nil {
		return nil, fmt.Errorf("get cards needing exercises: %w", err)
	}
	cards := make([]CardNeedingExercise, len(rows))
	for i, r := range rows {
		cards[i] = CardNeedingExercise{
			UserID:       uuidToString(r.UserID),
			CardID:       uuidToString(r.CardID),
			Front:        r.Front,
			Back:         r.Back,
			Repetitions:  derefInt32(r.Repetitions, 0),
			IntervalDays: derefInt32(r.IntervalDays, 0),
			SourceLang:   r.SourceLang,
			TargetLang:   r.TargetLang,
		}
	}
	return cards, nil
}
