package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool *pgxpool.Pool
}

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

type ReviewLog struct {
	ID         string    `json:"id"`
	CardID     string    `json:"card_id"`
	UserID     string    `json:"user_id"`
	Grade      int       `json:"grade"`
	ReviewedAt time.Time `json:"reviewed_at"`
	CreatedAt  time.Time `json:"created_at"`
}

func New(ctx context.Context, databaseURL string) (*DB, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return &DB{Pool: pool}, nil
}

func (d *DB) Close() {
	d.Pool.Close()
}

// Users

func (d *DB) CreateUser(ctx context.Context, email, passwordHash string) (*User, error) {
	var u User
	err := d.Pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash) VALUES ($1, $2)
		 RETURNING id, email, password_hash, created_at`, email, passwordHash,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return &u, nil
}

func (d *DB) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := d.Pool.QueryRow(ctx,
		`SELECT id, email, password_hash, created_at FROM users WHERE email = $1`, email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get user by email: %w", err)
	}
	return &u, nil
}

// Decks

func (d *DB) ListDecks(ctx context.Context, userID string) ([]Deck, error) {
	rows, err := d.Pool.Query(ctx,
		`SELECT id, user_id, name, source_lang, target_lang, created_at
		 FROM decks WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("list decks: %w", err)
	}
	defer rows.Close()

	var decks []Deck
	for rows.Next() {
		var dk Deck
		if err := rows.Scan(&dk.ID, &dk.UserID, &dk.Name, &dk.SourceLang, &dk.TargetLang, &dk.CreatedAt); err != nil {
			return nil, fmt.Errorf("list decks scan: %w", err)
		}
		decks = append(decks, dk)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list decks rows: %w", err)
	}
	return decks, nil
}

func (d *DB) CreateDeck(ctx context.Context, userID, name, sourceLang, targetLang string) (*Deck, error) {
	var dk Deck
	err := d.Pool.QueryRow(ctx,
		`INSERT INTO decks (user_id, name, source_lang, target_lang) VALUES ($1, $2, $3, $4)
		 RETURNING id, user_id, name, source_lang, target_lang, created_at`,
		userID, name, sourceLang, targetLang,
	).Scan(&dk.ID, &dk.UserID, &dk.Name, &dk.SourceLang, &dk.TargetLang, &dk.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create deck: %w", err)
	}
	return &dk, nil
}

func (d *DB) DeleteDeck(ctx context.Context, userID, deckID string) error {
	tag, err := d.Pool.Exec(ctx,
		`DELETE FROM decks WHERE id = $1 AND user_id = $2`, deckID, userID)
	if err != nil {
		return fmt.Errorf("delete deck: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (d *DB) GetDeck(ctx context.Context, userID, deckID string) (*Deck, error) {
	var dk Deck
	err := d.Pool.QueryRow(ctx,
		`SELECT id, user_id, name, source_lang, target_lang, created_at
		 FROM decks WHERE id = $1 AND user_id = $2`, deckID, userID,
	).Scan(&dk.ID, &dk.UserID, &dk.Name, &dk.SourceLang, &dk.TargetLang, &dk.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get deck: %w", err)
	}
	return &dk, nil
}

// Cards

func scanCard(row interface{ Scan(dest ...any) error }) (Card, error) {
	var c Card
	err := row.Scan(&c.ID, &c.DeckID, &c.Front, &c.Back,
		&c.FrontImage, &c.FrontImageType, &c.BackImage, &c.BackImageType,
		&c.EaseFactor, &c.IntervalDays, &c.Repetitions, &c.NextReview, &c.CreatedAt, &c.UpdatedAt)
	if err == nil {
		c.PopulateImageURLs()
	}
	return c, err
}

const cardSelectColumns = `c.id, c.deck_id, c.front, c.back,
	c.front_image, c.front_image_type, c.back_image, c.back_image_type,
	c.ease_factor, c.interval_days, c.repetitions, c.next_review, c.created_at, c.updated_at`

const cardReturningColumns = `id, deck_id, front, back,
	front_image, front_image_type, back_image, back_image_type,
	ease_factor, interval_days, repetitions, next_review, created_at, updated_at`

func (d *DB) ListCards(ctx context.Context, userID, deckID string) ([]Card, error) {
	rows, err := d.Pool.Query(ctx,
		`SELECT `+cardSelectColumns+`
		 FROM cards c JOIN decks d ON c.deck_id = d.id
		 WHERE c.deck_id = $1 AND d.user_id = $2
		 ORDER BY c.created_at DESC`, deckID, userID)
	if err != nil {
		return nil, fmt.Errorf("list cards: %w", err)
	}
	defer rows.Close()

	var cards []Card
	for rows.Next() {
		c, err := scanCard(rows)
		if err != nil {
			return nil, fmt.Errorf("list cards scan: %w", err)
		}
		cards = append(cards, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list cards rows: %w", err)
	}
	return cards, nil
}

type CardImageData struct {
	FrontImage     []byte
	FrontImageType string
	BackImage      []byte
	BackImageType  string
}

func (d *DB) CreateCard(ctx context.Context, userID, deckID, front, back string, images *CardImageData) (*Card, error) {
	dk, err := d.GetDeck(ctx, userID, deckID)
	if err != nil {
		return nil, fmt.Errorf("create card get deck: %w", err)
	}
	if dk == nil {
		return nil, pgx.ErrNoRows
	}

	var frontImg []byte
	var frontImgType, backImgType *string
	var backImg []byte
	if images != nil {
		frontImg = images.FrontImage
		backImg = images.BackImage
		if images.FrontImageType != "" {
			frontImgType = &images.FrontImageType
		}
		if images.BackImageType != "" {
			backImgType = &images.BackImageType
		}
	}

	c, err := scanCard(d.Pool.QueryRow(ctx,
		`INSERT INTO cards (deck_id, front, back, front_image, front_image_type, back_image, back_image_type)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING `+cardReturningColumns,
		deckID, front, back, frontImg, frontImgType, backImg, backImgType,
	))
	if err != nil {
		return nil, fmt.Errorf("create card: %w", err)
	}
	return &c, nil
}

type CardPairInput struct {
	Front          string
	Back           string
	FrontImage     []byte
	FrontImageType string
}

func (d *DB) CreateCards(ctx context.Context, userID, deckID string, pairs []CardPairInput) ([]Card, error) {
	dk, err := d.GetDeck(ctx, userID, deckID)
	if err != nil {
		return nil, fmt.Errorf("create cards get deck: %w", err)
	}
	if dk == nil {
		return nil, pgx.ErrNoRows
	}

	var cards []Card
	for _, p := range pairs {
		var c Card
		var scanErr error
		if len(p.FrontImage) > 0 {
			c, scanErr = scanCard(d.Pool.QueryRow(ctx,
				`INSERT INTO cards (deck_id, front, back, front_image, front_image_type) VALUES ($1, $2, $3, $4, $5)
				 RETURNING `+cardReturningColumns,
				deckID, p.Front, p.Back, p.FrontImage, p.FrontImageType,
			))
		} else {
			c, scanErr = scanCard(d.Pool.QueryRow(ctx,
				`INSERT INTO cards (deck_id, front, back) VALUES ($1, $2, $3)
				 RETURNING `+cardReturningColumns,
				deckID, p.Front, p.Back,
			))
		}
		if scanErr != nil {
			return nil, fmt.Errorf("create cards insert: %w", scanErr)
		}
		cards = append(cards, c)
	}
	return cards, nil
}

// Reviews

func (d *DB) GetDueCards(ctx context.Context, userID string) ([]Card, error) {
	rows, err := d.Pool.Query(ctx,
		`SELECT `+cardSelectColumns+`
		 FROM cards c JOIN decks d ON c.deck_id = d.id
		 WHERE d.user_id = $1 AND c.next_review <= now() AND c.repetitions > 0
		 ORDER BY c.next_review ASC`, userID)
	if err != nil {
		return nil, fmt.Errorf("get due cards: %w", err)
	}
	defer rows.Close()

	var cards []Card
	for rows.Next() {
		c, err := scanCard(rows)
		if err != nil {
			return nil, fmt.Errorf("get due cards scan: %w", err)
		}
		cards = append(cards, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("get due cards rows: %w", err)
	}
	return cards, nil
}

func (d *DB) GetNewCards(ctx context.Context, userID string) ([]Card, error) {
	rows, err := d.Pool.Query(ctx,
		`SELECT `+cardSelectColumns+`
		 FROM cards c JOIN decks d ON c.deck_id = d.id
		 WHERE d.user_id = $1 AND c.repetitions = 0
		 ORDER BY c.created_at ASC`, userID)
	if err != nil {
		return nil, fmt.Errorf("get new cards: %w", err)
	}
	defer rows.Close()

	var cards []Card
	for rows.Next() {
		c, err := scanCard(rows)
		if err != nil {
			return nil, fmt.Errorf("get new cards scan: %w", err)
		}
		cards = append(cards, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("get new cards rows: %w", err)
	}
	return cards, nil
}

func (d *DB) GetUpcomingCards(ctx context.Context, userID string, excludeIDs []string, limit int) ([]Card, error) {
	rows, err := d.Pool.Query(ctx,
		`SELECT `+cardSelectColumns+`
		 FROM cards c JOIN decks d ON c.deck_id = d.id
		 WHERE d.user_id = $1 AND c.repetitions > 0 AND c.next_review > now()
		   AND c.id != ALL($2)
		 ORDER BY c.next_review ASC
		 LIMIT $3`, userID, excludeIDs, limit)
	if err != nil {
		return nil, fmt.Errorf("get upcoming cards: %w", err)
	}
	defer rows.Close()

	var cards []Card
	for rows.Next() {
		c, err := scanCard(rows)
		if err != nil {
			return nil, fmt.Errorf("get upcoming cards scan: %w", err)
		}
		cards = append(cards, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("get upcoming cards rows: %w", err)
	}
	return cards, nil
}

func (d *DB) GetCardForUser(ctx context.Context, userID, cardID string) (*Card, error) {
	c, err := scanCard(d.Pool.QueryRow(ctx,
		`SELECT `+cardSelectColumns+`
		 FROM cards c JOIN decks d ON c.deck_id = d.id
		 WHERE c.id = $1 AND d.user_id = $2`, cardID, userID,
	))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get card for user: %w", err)
	}
	return &c, nil
}

func (d *DB) UpdateCardSRS(ctx context.Context, cardID string, easeFactor float64, intervalDays, repetitions int, nextReview time.Time) error {
	_, err := d.Pool.Exec(ctx,
		`UPDATE cards SET ease_factor = $1, interval_days = $2, repetitions = $3,
		        next_review = $4, updated_at = now()
		 WHERE id = $5`, easeFactor, intervalDays, repetitions, nextReview, cardID)
	if err != nil {
		return fmt.Errorf("update card SRS: %w", err)
	}
	return nil
}

func (d *DB) UpdateCard(ctx context.Context, userID, cardID, front, back string) error {
	tag, err := d.Pool.Exec(ctx,
		`UPDATE cards SET front = $1, back = $2, updated_at = now()
		 FROM decks WHERE cards.deck_id = decks.id AND cards.id = $3 AND decks.user_id = $4`,
		front, back, cardID, userID)
	if err != nil {
		return fmt.Errorf("update card: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (d *DB) DeleteCard(ctx context.Context, userID, cardID string) error {
	tag, err := d.Pool.Exec(ctx,
		`DELETE FROM cards USING decks
		 WHERE cards.deck_id = decks.id AND cards.id = $1 AND decks.user_id = $2`,
		cardID, userID)
	if err != nil {
		return fmt.Errorf("delete card: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (d *DB) CreateReviewLog(ctx context.Context, cardID, userID string, grade int, reviewedAt time.Time) error {
	_, err := d.Pool.Exec(ctx,
		`INSERT INTO review_logs (card_id, user_id, grade, reviewed_at) VALUES ($1, $2, $3, $4)`,
		cardID, userID, grade, reviewedAt)
	if err != nil {
		return fmt.Errorf("create review log: %w", err)
	}
	return nil
}
