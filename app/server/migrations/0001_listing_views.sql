CREATE TABLE listing_views (
  category TEXT NOT NULL CHECK (category IN ('apps', 'extensions', 'skills')),
  slug TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (category, slug)
) WITHOUT ROWID;
