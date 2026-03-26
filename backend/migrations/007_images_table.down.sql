-- Re-add image columns to cards
ALTER TABLE cards ADD COLUMN front_image BYTEA;
ALTER TABLE cards ADD COLUMN front_image_type TEXT;
ALTER TABLE cards ADD COLUMN back_image BYTEA;
ALTER TABLE cards ADD COLUMN back_image_type TEXT;

-- Copy data back from images table
UPDATE cards SET
    front_image = i.data,
    front_image_type = i.content_type
FROM images i WHERE cards.front_image_id = i.id;

UPDATE cards SET
    back_image = i.data,
    back_image_type = i.content_type
FROM images i WHERE cards.back_image_id = i.id;

-- Drop FK columns
ALTER TABLE cards DROP COLUMN front_image_id;
ALTER TABLE cards DROP COLUMN back_image_id;

-- Drop images table
DROP TABLE images;
