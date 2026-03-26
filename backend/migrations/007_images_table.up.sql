-- Create images table
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    data BYTEA NOT NULL,
    content_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add image ID columns to cards
ALTER TABLE cards ADD COLUMN front_image_id UUID REFERENCES images(id);
ALTER TABLE cards ADD COLUMN back_image_id UUID REFERENCES images(id);

-- Copy existing card images into images table and link them
DO $$
DECLARE
    r RECORD;
    new_id UUID;
BEGIN
    -- Copy front images
    FOR r IN SELECT c.id AS card_id, c.front_image, c.front_image_type, d.user_id
             FROM cards c JOIN decks d ON c.deck_id = d.id
             WHERE c.front_image IS NOT NULL
    LOOP
        INSERT INTO images (user_id, data, content_type)
        VALUES (r.user_id, r.front_image, COALESCE(r.front_image_type, 'image/jpeg'))
        RETURNING id INTO new_id;
        UPDATE cards SET front_image_id = new_id WHERE id = r.card_id;
    END LOOP;

    -- Copy back images
    FOR r IN SELECT c.id AS card_id, c.back_image, c.back_image_type, d.user_id
             FROM cards c JOIN decks d ON c.deck_id = d.id
             WHERE c.back_image IS NOT NULL
    LOOP
        INSERT INTO images (user_id, data, content_type)
        VALUES (r.user_id, r.back_image, COALESCE(r.back_image_type, 'image/jpeg'))
        RETURNING id INTO new_id;
        UPDATE cards SET back_image_id = new_id WHERE id = r.card_id;
    END LOOP;
END $$;

-- Drop old image columns
ALTER TABLE cards DROP COLUMN front_image;
ALTER TABLE cards DROP COLUMN front_image_type;
ALTER TABLE cards DROP COLUMN back_image;
ALTER TABLE cards DROP COLUMN back_image_type;
