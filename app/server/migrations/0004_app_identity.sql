-- Index the canonical JSON value rather than storing a second, mutable copy.
-- Missing IDs on older listings remain valid until metadata is reviewed again.
CREATE UNIQUE INDEX listings_app_id
  ON listings (json_extract(payload, '$.appId')) WHERE category = 'apps';

CREATE TRIGGER listings_app_id_insert BEFORE INSERT ON listings
WHEN NEW.category = 'apps' AND json_type(NEW.payload, '$.appId') IS NOT NULL
  AND (json_type(NEW.payload, '$.appId') != 'text'
    OR length(json_extract(NEW.payload, '$.appId')) NOT BETWEEN 1 AND 255
    OR json_extract(NEW.payload, '$.appId') GLOB '*[^A-Za-z0-9_.-]*')
BEGIN
  SELECT RAISE(ABORT, 'App ID must be a non-empty identifier of at most 255 characters');
END;

CREATE TRIGGER listings_app_id_update BEFORE UPDATE ON listings
WHEN NEW.category = 'apps' AND json_type(NEW.payload, '$.appId') IS NOT NULL
  AND (json_type(NEW.payload, '$.appId') != 'text'
    OR length(json_extract(NEW.payload, '$.appId')) NOT BETWEEN 1 AND 255
    OR json_extract(NEW.payload, '$.appId') GLOB '*[^A-Za-z0-9_.-]*')
BEGIN
  SELECT RAISE(ABORT, 'App ID must be a non-empty identifier of at most 255 characters');
END;

CREATE TRIGGER listings_app_id_immutable BEFORE UPDATE ON listings
WHEN OLD.category = 'apps' AND json_type(OLD.payload, '$.appId') = 'text'
  AND (NEW.category != 'apps'
    OR json_extract(NEW.payload, '$.appId') IS NOT json_extract(OLD.payload, '$.appId'))
BEGIN
  SELECT RAISE(ABORT, 'A recorded app ID cannot be changed or removed');
END;
