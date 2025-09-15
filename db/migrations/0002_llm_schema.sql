-- LLM schema migration: create new columns and drop legacy ones.
-- This assumes no data preservation is required.

-- 1) Create new columns if they don't already exist
alter table "trades"
  add column if not exists "timeframe" text,
  add column if not exists "position" text,
  add column if not exists "position_sizes" numeric(12,4)[],
  add column if not exists "total_position_size" numeric(12,4),
  add column if not exists "entry_prices" numeric(18,8)[],
  add column if not exists "stop_loss" numeric(18,8),
  add column if not exists "take_profit" numeric(18,8)[],
  add column if not exists "trade_direction" text,
  add column if not exists "additional_notes" text,
  add column if not exists "observation" text,
  add column if not exists "profitLoss" numeric(18,2),
  add column if not exists "pips" integer,
  add column if not exists "screenshot_url" text;

-- 2) Drop legacy columns from previous schema
alter table "trades"
  drop column if exists "direction",
  drop column if exists "entry",
  drop column if exists "stop",
  drop column if exists "size_risk_pct",
  drop column if exists "targets",
  drop column if exists "setup_tags",
  drop column if exists "thesis",
  drop column if exists "r_multiple",
  drop column if exists "screenshots",
  drop column if exists "rule_1",
  drop column if exists "rule_2",
  drop column if exists "rule_3",
  drop column if exists "lesson",
  drop column if exists "pl";
