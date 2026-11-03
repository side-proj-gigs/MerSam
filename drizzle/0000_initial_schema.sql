CREATE TYPE "public"."client_type" AS ENUM('individual', 'business', 'institution', 'community');--> statement-breakpoint
CREATE TYPE "public"."discount_kind" AS ENUM('none', 'fixed', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('website', 'whatsapp', 'phone', 'referral', 'walk_in', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'quoted', 'won', 'lost', 'archived');--> statement-breakpoint
CREATE TYPE "public"."media_source" AS ENUM('upload', 'external');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'mobile_money', 'bank_transfer', 'cheque', 'card', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_state" AS ENUM('fully_paid', 'part_payment', 'unpaid');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('completed', 'ongoing');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('viewer', 'staff', 'admin', 'owner');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('flexible', 'this_week', 'urgent', 'emergency');--> statement-breakpoint
CREATE TYPE "public"."work_report_status" AS ENUM('draft', 'issued', 'archived');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(64) NOT NULL,
	"entity" varchar(64) NOT NULL,
	"entity_id" varchar(64),
	"summary" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(32) NOT NULL,
	"name" varchar(200) NOT NULL,
	"contact_person" varchar(160),
	"email" varchar(254),
	"phone" varchar(32) NOT NULL,
	"alt_phone" varchar(32),
	"address" text DEFAULT '' NOT NULL,
	"city" varchar(120) DEFAULT '' NOT NULL,
	"region" varchar(120) DEFAULT '' NOT NULL,
	"client_type" "client_type" DEFAULT 'individual' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" varchar(96) DEFAULT 'General' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" varchar(128) NOT NULL,
	"scope" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'in_flight' NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"unit_of_measure" varchar(32) DEFAULT 'Pcs' NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1' NOT NULL,
	"unit_price_minor" integer DEFAULT 0 NOT NULL,
	"line_total_minor" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar(32) NOT NULL,
	"customer_reference" varchar(48) DEFAULT '' NOT NULL,
	"client_id" uuid,
	"job_id" uuid,
	"customer_name" varchar(200) NOT NULL,
	"customer_address" text,
	"customer_phone" varchar(32),
	"customer_email" varchar(254),
	"currency" varchar(3) DEFAULT 'GHS' NOT NULL,
	"issued_on" date NOT NULL,
	"due_on" date,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"discount_kind" "discount_kind" DEFAULT 'none' NOT NULL,
	"discount_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"terms_text" text DEFAULT '' NOT NULL,
	"payment_details" text DEFAULT '' NOT NULL,
	"notes" text,
	"subtotal_minor" integer DEFAULT 0 NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"vat_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer DEFAULT 0 NOT NULL,
	"amount_paid_minor" integer DEFAULT 0 NOT NULL,
	"balance_minor" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(32) NOT NULL,
	"client_id" uuid NOT NULL,
	"service_id" uuid,
	"lead_id" uuid,
	"title" varchar(240) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"site_address" text DEFAULT '' NOT NULL,
	"status" "job_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"started_on" date,
	"completed_on" date,
	"assigned_to" uuid,
	"photo_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(32) NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"email" varchar(254),
	"phone" varchar(32) NOT NULL,
	"location" varchar(200) DEFAULT '' NOT NULL,
	"service_id" uuid,
	"service_name" varchar(160),
	"message" text NOT NULL,
	"urgency" "urgency" DEFAULT 'flexible' NOT NULL,
	"budget_hint" varchar(120),
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"source" "lead_source" DEFAULT 'website' NOT NULL,
	"assigned_to" uuid,
	"client_id" uuid,
	"converted_at" timestamp with time zone,
	"last_contacted_at" timestamp with time zone,
	"internal_notes" text,
	"dedupe_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"alt_text" varchar(300) DEFAULT '' NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"byte_size" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"folder" varchar(96) DEFAULT 'general' NOT NULL,
	"storage_key" text,
	"uploaded_by" uuid,
	"source" "media_source" DEFAULT 'upload' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_blobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid,
	"job_id" uuid,
	"client_id" uuid,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'GHS' NOT NULL,
	"method" "payment_method" DEFAULT 'cash' NOT NULL,
	"reference" varchar(120),
	"paid_on" date NOT NULL,
	"note" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(96) NOT NULL,
	"title" varchar(200) NOT NULL,
	"client" varchar(160) DEFAULT '' NOT NULL,
	"location" varchar(160) DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"service_id" uuid,
	"cover_image_url" text DEFAULT '' NOT NULL,
	"gallery_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_on" date,
	"status" "project_status" DEFAULT 'completed' NOT NULL,
	"stats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" varchar(160) PRIMARY KEY NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(96) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon_key" varchar(48) DEFAULT 'droplet' NOT NULL,
	"accent_color" varchar(16) DEFAULT '#C9A227' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid,
	"slug" varchar(96) NOT NULL,
	"name" varchar(160) NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"icon_key" varchar(48) DEFAULT 'droplet' NOT NULL,
	"hero_image_url" text DEFAULT '' NOT NULL,
	"gallery_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deliverables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starting_price_minor" integer,
	"price_note" varchar(200) DEFAULT '' NOT NULL,
	"turnaround" varchar(120) DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"seo_title" varchar(200),
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" varchar(16) PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"company_name" varchar(160) NOT NULL,
	"legal_name" varchar(200) NOT NULL,
	"tagline" text NOT NULL,
	"about" text NOT NULL,
	"mission" text NOT NULL,
	"logo_url" text NOT NULL,
	"primary_phone" varchar(32) NOT NULL,
	"secondary_phone" varchar(32),
	"whatsapp_number" varchar(32),
	"primary_email" varchar(254) NOT NULL,
	"support_email" varchar(254),
	"address_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"city" varchar(120) NOT NULL,
	"region" varchar(120) NOT NULL,
	"country" varchar(120) NOT NULL,
	"map_embed_url" text,
	"business_hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"socials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"offices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hero_slides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"emergency_banner_text" text,
	"emergency_banner_enabled" boolean DEFAULT false NOT NULL,
	"default_vat_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"default_currency" varchar(3) DEFAULT 'GHS' NOT NULL,
	"default_invoice_terms" text NOT NULL,
	"default_payment_details" text NOT NULL,
	"bank_name" varchar(160),
	"bank_account_name" varchar(160),
	"bank_account_number" varchar(64),
	"momo_number" varchar(32),
	"momo_account_name" varchar(160),
	"seo_title" varchar(200) NOT NULL,
	"seo_description" text NOT NULL,
	"seo_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"og_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_name" varchar(160) NOT NULL,
	"author_role" varchar(160) DEFAULT '' NOT NULL,
	"location" varchar(160) DEFAULT '' NOT NULL,
	"quote" text NOT NULL,
	"rating" smallint DEFAULT 5 NOT NULL,
	"avatar_url" text,
	"service_id" uuid,
	"is_published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"name" varchar(160) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'staff' NOT NULL,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"token_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_report_cost_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount_minor" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_number" varchar(32) NOT NULL,
	"job_id" uuid,
	"client_id" uuid,
	"invoice_id" uuid,
	"client_name" varchar(200) NOT NULL,
	"service_category" varchar(160) DEFAULT '' NOT NULL,
	"title" varchar(240) DEFAULT 'Work Completion and Payment Report' NOT NULL,
	"date_of_work" date NOT NULL,
	"report_date" date NOT NULL,
	"currency" varchar(3) DEFAULT 'GHS' NOT NULL,
	"introduction" text DEFAULT '' NOT NULL,
	"work_performed" text DEFAULT '' NOT NULL,
	"completion_note" text DEFAULT '' NOT NULL,
	"payment_note" text DEFAULT '' NOT NULL,
	"appreciation" text DEFAULT '' NOT NULL,
	"prepared_by" varchar(160) DEFAULT 'MerSam' NOT NULL,
	"authorised_representative" varchar(160),
	"signature_image_url" text,
	"photo_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_cost_minor" integer DEFAULT 0 NOT NULL,
	"total_paid_minor" integer DEFAULT 0 NOT NULL,
	"outstanding_minor" integer DEFAULT 0 NOT NULL,
	"payment_state" "payment_state" DEFAULT 'unpaid' NOT NULL,
	"status" "work_report_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_blobs" ADD CONSTRAINT "media_blobs_id_media_assets_id_fk" FOREIGN KEY ("id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_report_cost_lines" ADD CONSTRAINT "work_report_cost_lines_report_id_work_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."work_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_reports" ADD CONSTRAINT "work_reports_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_reports" ADD CONSTRAINT "work_reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_reports" ADD CONSTRAINT "work_reports_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_reports" ADD CONSTRAINT "work_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "clients_reference_unique" ON "clients" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "clients_phone_idx" ON "clients" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "clients_name_idx" ON "clients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "faqs_published_idx" ON "faqs" USING btree ("is_published","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_key_scope_unique" ON "idempotency_keys" USING btree ("key","scope");--> statement-breakpoint
CREATE INDEX "idempotency_created_idx" ON "idempotency_keys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "invoice_lines" USING btree ("invoice_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_unique" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status","issued_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "invoices_client_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_issued_idx" ON "invoices" USING btree ("issued_on" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_reference_unique" ON "jobs" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "jobs_client_idx" ON "jobs" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_reference_unique" ON "leads" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "leads_dedupe_idx" ON "leads" USING btree ("dedupe_hash","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "media_folder_idx" ON "media_assets" USING btree ("folder","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_paid_on_idx" ON "payments" USING btree ("paid_on" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_unique" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "projects_published_idx" ON "projects" USING btree ("is_published","sort_order");--> statement-breakpoint
CREATE INDEX "rate_limit_window_idx" ON "rate_limit_buckets" USING btree ("window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "service_categories_slug_unique" ON "service_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "services_slug_unique" ON "services" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "services_active_idx" ON "services" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "services_category_idx" ON "services" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "testimonials_published_idx" ON "testimonials" USING btree ("is_published","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "work_report_lines_report_idx" ON "work_report_cost_lines" USING btree ("report_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "work_reports_number_unique" ON "work_reports" USING btree ("report_number");--> statement-breakpoint
CREATE INDEX "work_reports_status_idx" ON "work_reports" USING btree ("status","report_date" DESC NULLS LAST);