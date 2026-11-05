CREATE TYPE "public"."email_kind" AS ENUM('enquiry_confirmation', 'lead_notification', 'invoice', 'work_report', 'proposal', 'test');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'sent', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "email_kind" NOT NULL,
	"status" "email_status" NOT NULL,
	"recipient" varchar(254) NOT NULL,
	"subject" varchar(400) NOT NULL,
	"entity_type" varchar(40),
	"entity_id" uuid,
	"provider_id" varchar(120),
	"error" text,
	"sent_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"section" varchar(160),
	"title" varchar(240) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"unit_of_measure" varchar(32) DEFAULT 'Item' NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1' NOT NULL,
	"unit_price_minor" integer DEFAULT 0 NOT NULL,
	"line_total_minor" integer DEFAULT 0 NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_number" varchar(32) NOT NULL,
	"client_id" uuid,
	"lead_id" uuid,
	"client_name" varchar(200) NOT NULL,
	"client_company" varchar(200),
	"client_email" varchar(254),
	"client_phone" varchar(32),
	"client_address" text,
	"title" varchar(240) NOT NULL,
	"salutation" varchar(160) DEFAULT 'Dear Sir or Madam' NOT NULL,
	"introduction" text DEFAULT '' NOT NULL,
	"scope_intro" text DEFAULT '' NOT NULL,
	"closing" text DEFAULT '' NOT NULL,
	"terms_text" text DEFAULT '' NOT NULL,
	"payment_terms" text DEFAULT '' NOT NULL,
	"notes" text,
	"prepared_by" varchar(160) DEFAULT 'MerSam' NOT NULL,
	"prepared_by_role" varchar(160),
	"currency" varchar(3) DEFAULT 'GHS' NOT NULL,
	"discount_kind" "discount_kind" DEFAULT 'none' NOT NULL,
	"discount_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"subtotal_minor" integer DEFAULT 0 NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"vat_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer DEFAULT 0 NOT NULL,
	"issued_on" date NOT NULL,
	"valid_until" date,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "email_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "email_from_name" varchar(160);--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "email_from_address" varchar(254);--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "email_reply_to" varchar(254);--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "email_bcc" varchar(254);--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "email_signature" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "send_enquiry_confirmation" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_log_entity_idx" ON "email_log" USING btree ("entity_type","entity_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "email_log_created_idx" ON "email_log" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "proposal_items_proposal_idx" ON "proposal_items" USING btree ("proposal_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_number_unique" ON "proposals" USING btree ("proposal_number");--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "proposals" USING btree ("status","issued_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "proposals_client_idx" ON "proposals" USING btree ("client_id");