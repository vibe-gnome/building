CREATE TABLE listings (
  category TEXT NOT NULL CHECK (category IN ('apps', 'extensions', 'skills')),
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'unpublished')),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  source_issue INTEGER,
  revision TEXT NOT NULL,
  submission_fingerprint TEXT NOT NULL DEFAULT 'initial-import',
  reviewed_by TEXT NOT NULL DEFAULT 'repository-import',
  evidence TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(evidence)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (CASE category WHEN 'extensions'
    THEN json_extract(payload, '$.slug') IS slug AND json_type(payload, '$.metadata.uuid') IS 'text'
    ELSE json_extract(payload, '$.id') IS slug END),
  PRIMARY KEY (category, slug)
) WITHOUT ROWID;

CREATE UNIQUE INDEX listings_extension_uuid
  ON listings (json_extract(payload, '$.metadata.uuid')) WHERE category = 'extensions';
CREATE UNIQUE INDEX listings_source_issue
  ON listings (source_issue) WHERE source_issue IS NOT NULL;
CREATE INDEX listings_published ON listings (category, status, slug);

CREATE TABLE listing_reviews (
  revision TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  slug TEXT NOT NULL,
  source_issue INTEGER,
  submission_fingerprint TEXT NOT NULL,
  reviewed_by TEXT NOT NULL,
  reviewed_at TEXT NOT NULL,
  evidence TEXT NOT NULL CHECK (json_valid(evidence)),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  FOREIGN KEY (category, slug) REFERENCES listings (category, slug)
);

-- Recording the accepted version and its evidence is atomic with publication.
CREATE TRIGGER listings_review_insert AFTER INSERT ON listings BEGIN
  INSERT INTO listing_reviews VALUES (
    NEW.category || ':' || NEW.slug || ':' || NEW.revision,
    NEW.category, NEW.slug, NEW.source_issue, NEW.submission_fingerprint,
    NEW.reviewed_by, NEW.updated_at, NEW.evidence, NEW.payload
  );
END;
CREATE TRIGGER listings_review_update AFTER UPDATE ON listings BEGIN
  INSERT INTO listing_reviews VALUES (
    NEW.category || ':' || NEW.slug || ':' || NEW.revision,
    NEW.category, NEW.slug, NEW.source_issue, NEW.submission_fingerprint,
    NEW.reviewed_by, NEW.updated_at, NEW.evidence, NEW.payload
  );
END;
