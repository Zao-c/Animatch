DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Anime"
    WHERE "source" IS NOT NULL
      AND "source" NOT IN (
        'BANGUMI',
        'MANAMI',
        'CUSTOM_UPLOAD',
        'MANUAL',
        'DEMO',
        'TIERMAKER_IMPORT'
      )
  ) THEN
    RAISE EXCEPTION 'Anime.source contains values not supported by AnimeSourceType enum';
  END IF;
END $$;

CREATE TYPE "AnimeSourceType" AS ENUM (
  'BANGUMI',
  'MANAMI',
  'CUSTOM_UPLOAD',
  'MANUAL',
  'DEMO',
  'TIERMAKER_IMPORT'
);

ALTER TABLE "Anime"
  ALTER COLUMN "source" DROP DEFAULT,
  ALTER COLUMN "source" TYPE "AnimeSourceType" USING "source"::"AnimeSourceType",
  ALTER COLUMN "source" SET DEFAULT 'BANGUMI';
