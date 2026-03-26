-- name: GetDueCards :many
SELECT c.id, c.deck_id, c.front, c.back,
	c.front_image, c.front_image_type, c.back_image, c.back_image_type,
	c.ease_factor, c.interval_days, c.repetitions, c.next_review, c.created_at, c.updated_at
FROM cards c JOIN decks d ON c.deck_id = d.id
WHERE d.user_id = $1 AND c.next_review <= now() AND c.repetitions > 0
	AND (sqlc.narg('deck_id')::uuid IS NULL OR c.deck_id = sqlc.narg('deck_id')::uuid)
ORDER BY c.next_review ASC;

-- name: GetNewCards :many
SELECT c.id, c.deck_id, c.front, c.back,
	c.front_image, c.front_image_type, c.back_image, c.back_image_type,
	c.ease_factor, c.interval_days, c.repetitions, c.next_review, c.created_at, c.updated_at
FROM cards c JOIN decks d ON c.deck_id = d.id
WHERE d.user_id = $1 AND c.repetitions = 0
	AND (sqlc.narg('deck_id')::uuid IS NULL OR c.deck_id = sqlc.narg('deck_id')::uuid)
ORDER BY c.created_at ASC;

-- name: GetUpcomingCards :many
SELECT c.id, c.deck_id, c.front, c.back,
	c.front_image, c.front_image_type, c.back_image, c.back_image_type,
	c.ease_factor, c.interval_days, c.repetitions, c.next_review, c.created_at, c.updated_at
FROM cards c JOIN decks d ON c.deck_id = d.id
WHERE d.user_id = $1 AND c.repetitions > 0 AND c.next_review > now()
	AND c.id != ALL($2::uuid[])
	AND (sqlc.narg('deck_id')::uuid IS NULL OR c.deck_id = sqlc.narg('deck_id')::uuid)
ORDER BY c.next_review ASC
LIMIT $3;

-- name: CreateReviewLog :exec
INSERT INTO review_logs (card_id, user_id, grade, reviewed_at, response_time_ms)
VALUES ($1, $2, $3, $4, $5);
