ALTER TABLE cards
    ADD COLUMN front_image BYTEA,
    ADD COLUMN front_image_type TEXT,
    ADD COLUMN back_image BYTEA,
    ADD COLUMN back_image_type TEXT;
