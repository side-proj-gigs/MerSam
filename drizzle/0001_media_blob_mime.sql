ALTER TABLE "media_blobs" DROP CONSTRAINT "media_blobs_id_media_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "media_blobs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "media_blobs" ADD COLUMN "mime_type" varchar(120) DEFAULT 'application/octet-stream' NOT NULL;