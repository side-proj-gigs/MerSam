ALTER TABLE "users" ADD COLUMN "job_title" varchar(120);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "card_slug" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "card_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whatsapp" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location" varchar(160);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "specialities" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "card_views" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_card_slug_unique" ON "users" USING btree ("card_slug");