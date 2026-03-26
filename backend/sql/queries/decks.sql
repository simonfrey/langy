-- name: ListDecks :many
SELECT id, user_id, name, source_lang, target_lang, created_at
FROM decks WHERE user_id = $1 ORDER BY created_at DESC;

-- name: CreateDeck :one
INSERT INTO decks (user_id, name, source_lang, target_lang) VALUES ($1, $2, $3, $4)
RETURNING id, user_id, name, source_lang, target_lang, created_at;

-- name: DeleteDeck :execrows
DELETE FROM decks WHERE id = $1 AND user_id = $2;

-- name: GetDeck :one
SELECT id, user_id, name, source_lang, target_lang, created_at
FROM decks WHERE id = $1 AND user_id = $2;
