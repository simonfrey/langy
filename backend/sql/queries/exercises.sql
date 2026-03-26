-- name: SaveExercise :one
INSERT INTO exercises (user_id, session_id, source_card_id, type, level, instruction, prompt, correct_answer, hint, source_sentence, options, data)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING id, user_id, session_id, source_card_id, type, level, instruction, prompt, correct_answer, hint, source_sentence, options, data, completed, user_answer, correct, feedback, next_review, created_at;

-- name: UpdateExerciseResultCorrect :execrows
UPDATE exercises SET completed = true, user_answer = $1, correct = $2, feedback = $3
FROM cards c JOIN decks dk ON c.deck_id = dk.id
WHERE exercises.source_card_id = c.id AND dk.user_id = $4 AND exercises.id = $5;

-- name: UpdateExerciseResultIncorrect :execrows
UPDATE exercises SET completed = true, user_answer = $1, correct = $2, feedback = $3, next_review = now() + interval '2 days'
FROM cards c JOIN decks dk ON c.deck_id = dk.id
WHERE exercises.source_card_id = c.id AND dk.user_id = $4 AND exercises.id = $5;

-- name: GetDueExercises :many
SELECT e.id, e.user_id, e.session_id, e.source_card_id, e.type, e.level, e.instruction, e.prompt, e.correct_answer, e.hint, e.source_sentence, e.options, e.data, e.completed, e.user_answer, e.correct, e.feedback, e.next_review, e.created_at
FROM exercises e
WHERE e.user_id = $1 AND e.correct = false AND e.next_review <= now()
ORDER BY e.next_review ASC;

-- name: GetUncompletedExercises :many
SELECT e.id, e.user_id, e.session_id, e.source_card_id, e.type, e.level, e.instruction, e.prompt, e.correct_answer, e.hint, e.source_sentence, e.options, e.data, e.completed, e.user_answer, e.correct, e.feedback, e.next_review, e.created_at
FROM exercises e
WHERE e.user_id = $1 AND e.completed = false
ORDER BY e.created_at ASC;

-- name: GetCardsNeedingExercises :many
SELECT dk.user_id, c.id AS card_id, c.front, c.back, c.repetitions, c.interval_days, dk.source_lang, dk.target_lang
FROM cards c
JOIN decks dk ON c.deck_id = dk.id
WHERE NOT EXISTS (
	SELECT 1 FROM exercises e WHERE e.source_card_id = c.id AND e.completed = false
)
ORDER BY random()
LIMIT $1;
