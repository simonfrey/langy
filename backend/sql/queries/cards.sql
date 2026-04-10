-- name: ListCards :many
SELECT c.id, c.deck_id, c.front, c.back,
	c.front_image_id, c.back_image_id,
	c.ease_factor, c.interval_days, c.repetitions, c.next_review, c.created_at, c.updated_at
FROM cards c JOIN decks d ON c.deck_id = d.id
WHERE c.deck_id = $1 AND d.user_id = $2
ORDER BY c.created_at DESC;

-- name: ListCardTexts :many
SELECT c.front, c.back
FROM cards c JOIN decks d ON c.deck_id = d.id
WHERE c.deck_id = $1 AND d.user_id = $2;

-- name: CreateCard :one
INSERT INTO cards (deck_id, front, back, front_image_id, back_image_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, deck_id, front, back,
	front_image_id, back_image_id,
	ease_factor, interval_days, repetitions, next_review, created_at, updated_at;

-- name: GetCardForUser :one
SELECT c.id, c.deck_id, c.front, c.back,
	c.front_image_id, c.back_image_id,
	c.ease_factor, c.interval_days, c.repetitions, c.next_review, c.created_at, c.updated_at
FROM cards c JOIN decks d ON c.deck_id = d.id
WHERE c.id = $1 AND d.user_id = $2;

-- name: UpdateCardSRS :exec
UPDATE cards SET ease_factor = $1, interval_days = $2, repetitions = $3,
	next_review = $4, updated_at = now()
WHERE id = $5;

-- name: UpdateCard :execrows
UPDATE cards SET front = $1, back = $2, front_image_id = $3, back_image_id = $4, updated_at = now()
FROM decks WHERE cards.deck_id = decks.id AND cards.id = $5 AND decks.user_id = $6;

-- name: DeleteCard :execrows
DELETE FROM cards USING decks
WHERE cards.deck_id = decks.id AND cards.id = $1 AND decks.user_id = $2;

-- name: ListAllUserCards :many
SELECT c.id, c.deck_id, c.front, c.back,
	c.front_image_id, c.back_image_id,
	c.ease_factor, c.interval_days, c.repetitions, c.next_review, c.created_at, c.updated_at,
	d.source_lang, d.target_lang
FROM cards c JOIN decks d ON c.deck_id = d.id
WHERE d.user_id = $1
ORDER BY random();
