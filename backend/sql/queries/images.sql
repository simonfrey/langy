-- name: CreateImage :one
INSERT INTO images (user_id, data, content_type)
VALUES ($1, $2, $3)
RETURNING id, user_id, content_type, created_at;

-- name: GetImage :one
SELECT id, user_id, data, content_type, created_at
FROM images WHERE id = $1;

-- name: DeleteOrphanedImages :exec
DELETE FROM images
WHERE id NOT IN (
	SELECT front_image_id FROM cards WHERE front_image_id IS NOT NULL
	UNION
	SELECT back_image_id FROM cards WHERE back_image_id IS NOT NULL
)
AND created_at < now() - interval '1 hour';
