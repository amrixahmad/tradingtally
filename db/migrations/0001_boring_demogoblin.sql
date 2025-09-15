CREATE TYPE "public"."direction" AS ENUM('long', 'short');--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"direction" "direction" NOT NULL,
	"entry" numeric(18, 8) NOT NULL,
	"stop" numeric(18, 8) NOT NULL,
	"size_risk_pct" numeric(10, 4) NOT NULL,
	"targets" text,
	"setup_tags" text[] DEFAULT '{}',
	"thesis" text,
	"pl" numeric(18, 2),
	"pips" integer,
	"r_multiple" numeric(10, 4),
	"screenshots" text[] DEFAULT '{}',
	"rule_1" boolean,
	"rule_2" boolean,
	"rule_3" boolean,
	"lesson" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
