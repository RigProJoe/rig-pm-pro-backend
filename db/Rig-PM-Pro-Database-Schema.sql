-- Rig PM Pro database schema, draft 1
-- Prepared by: Database Architect (Claude, lead supervisor)
-- Status: DRAFT. Not yet reviewed by Quality Assurance. Not yet applied to any database.
-- Hosting: Render PostgreSQL (approved by Joe, October 17, 2026).
-- Open decisions are marked OPEN and listed at the end of this file.

-- Every customer record is tied to a company, and every query must filter by company_id.

CREATE TABLE companies (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'none'
                  CHECK (plan IN ('none', 'truck', 'truck_trailer')),      -- base plans
  billing_term    TEXT NOT NULL DEFAULT 'monthly'
                  CHECK (billing_term IN ('monthly', 'annual')),
  plan_status     TEXT NOT NULL DEFAULT 'trial'
                  CHECK (plan_status IN ('trial', 'active', 'past_due', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,       -- required; used for account notices and password reset
  username        TEXT,                       -- optional; sign-in accepts either email or username
  password_hash   TEXT NOT NULL,              -- sign-in by password (approved by Joe, October 17, 2026); store only a salted hash
  full_name       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Devices a user has verified. A new device must enter a PIN before it can sign in.
CREATE TABLE trusted_devices (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token_hash TEXT NOT NULL,            -- random token kept in the browser; store only a hash
  device_label      TEXT,                     -- e.g. "Phone" or "Laptop", set by the user
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at        TIMESTAMPTZ,
  UNIQUE (user_id, device_token_hash)
);

-- One-time PIN sent when a user signs in from a device that is not trusted.
CREATE TABLE device_verification_pins (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pin_hash      TEXT NOT NULL,                -- store only a hash of the PIN
  expires_at    TIMESTAMPTZ NOT NULL,         -- short window, e.g. 10 minutes
  attempts      INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),   -- lock after a few wrong tries
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usernames are unique regardless of capitalization. Sign-in looks up the typed value against email or username.
CREATE UNIQUE INDEX uq_users_username ON users (lower(username)) WHERE username IS NOT NULL;

-- Asset makes. Seeded from manufacturer data. Users may add custom makes (company_id set).
CREATE TABLE asset_makes (
  id              BIGSERIAL PRIMARY KEY,
  company_id      BIGINT REFERENCES companies(id) ON DELETE CASCADE,   -- NULL = shared list
  asset_type      TEXT NOT NULL CHECK (asset_type IN ('truck', 'trailer', 'apu', 'reefer')),
  name            TEXT NOT NULL,
  is_custom       BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (company_id, asset_type, name)
);

CREATE TABLE assets (
  id              BIGSERIAL PRIMARY KEY,
  company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_type      TEXT NOT NULL CHECK (asset_type IN ('truck', 'trailer', 'apu', 'reefer')),
  make_id         BIGINT REFERENCES asset_makes(id),
  model           TEXT,
  vin_last6       CHAR(6) CHECK (vin_last6 ~ '^[A-Za-z0-9]{6}$'),
  nickname        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Manufacturer PM intervals, with source. Served to the website from here; never hard-coded.
CREATE TABLE pm_items (
  id              BIGSERIAL PRIMARY KEY,
  asset_type      TEXT NOT NULL CHECK (asset_type IN ('truck', 'trailer', 'apu', 'reefer')),
  name            TEXT NOT NULL,                       -- e.g. "Engine oil and filter change"
  category_id     BIGINT REFERENCES expense_categories(id),   -- subcategory, e.g. APU > PM or Reefer > DPF
  UNIQUE (asset_type, name)
);

CREATE TABLE manufacturer_intervals (
  id                  BIGSERIAL PRIMARY KEY,
  pm_item_id          BIGINT NOT NULL REFERENCES pm_items(id) ON DELETE CASCADE,
  make_id             BIGINT REFERENCES asset_makes(id),        -- NULL = generic / applies to all makes of this type
  model               TEXT,                                     -- NULL = applies to all models of the make
  model_year_from     SMALLINT NOT NULL CHECK (model_year_from BETWEEN 2010 AND 2027),   -- intervals change between years
  model_year_to       SMALLINT NOT NULL CHECK (model_year_to BETWEEN 2010 AND 2027),
  CHECK (model_year_to >= model_year_from),
  duty_level          TEXT CHECK (duty_level IN ('normal', 'linehaul', 'regional', 'heavy', 'severe', 'vocational', 'any')) DEFAULT 'any',
                                                                -- manufacturers publish one interval per duty cycle; store each as its own row
  interval_unit       TEXT NOT NULL CHECK (interval_unit IN ('hours', 'miles')),
  interval_value      INTEGER NOT NULL CHECK (interval_value > 0),
  source_name         TEXT NOT NULL,                            -- manufacturer document
  source_url          TEXT,
  source_page         TEXT,
  reviewed_by         TEXT,                                     -- Quality Assurance reviewer
  reviewed_at         TIMESTAMPTZ
);

-- Which PM items a user chose to track for an asset, and the interval used for each.
-- Two sources (approved by Joe, October 17, 2026):
--   'manufacturer'  : interval comes from manufacturer_intervals. The user may shorten it, never exceed it, and must keep the same unit.
--   'user_entered'  : no manufacturer interval is available. The user sets the interval. Labeled "user entered, not manufacturer" on every PM screen.
-- The interval source is shown to the driver on every PM screen, reminder, and tax export row.
CREATE TABLE tracked_pm_items (
  id                    BIGSERIAL PRIMARY KEY,
  company_id            BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id              BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  pm_item_id            BIGINT NOT NULL REFERENCES pm_items(id),
  manufacturer_interval_id BIGINT REFERENCES manufacturer_intervals(id),   -- NULL when user entered the interval
  interval_source       TEXT NOT NULL CHECK (interval_source IN ('manufacturer', 'user_entered')),
  user_interval_value   INTEGER CHECK (user_interval_value > 0),   -- manufacturer: optional shortened value; user_entered: required
  user_interval_unit    TEXT CHECK (user_interval_unit IN ('hours', 'miles')),   -- must match the manufacturer unit when a manufacturer interval is used
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, pm_item_id),
  CHECK ((user_interval_value IS NULL) = (user_interval_unit IS NULL)),
  CHECK (
    (interval_source = 'manufacturer' AND manufacturer_interval_id IS NOT NULL)
    OR
    (interval_source = 'user_entered' AND manufacturer_interval_id IS NULL AND user_interval_value IS NOT NULL)
  )
);

CREATE OR REPLACE FUNCTION check_user_interval() RETURNS TRIGGER AS $$
DECLARE
  mfr_value INTEGER;
  mfr_unit  TEXT;
BEGIN
  -- User-entered intervals have no manufacturer ceiling to check against.
  IF NEW.interval_source = 'user_entered' OR NEW.user_interval_value IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT interval_value, interval_unit INTO mfr_value, mfr_unit
    FROM manufacturer_intervals WHERE id = NEW.manufacturer_interval_id;
  IF NEW.user_interval_unit <> mfr_unit THEN
    RAISE EXCEPTION 'User interval unit (%) must match manufacturer unit (%)', NEW.user_interval_unit, mfr_unit;
  END IF;
  IF NEW.user_interval_value > mfr_value THEN
    RAISE EXCEPTION 'User interval (%) cannot exceed manufacturer interval (%)', NEW.user_interval_value, mfr_value;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tracked_interval_limit
  BEFORE INSERT OR UPDATE ON tracked_pm_items
  FOR EACH ROW EXECUTE FUNCTION check_user_interval();

-- Completed PM entries. Show on the main PM screen and on each asset page.
CREATE TABLE pm_entries (
  id                  BIGSERIAL PRIMARY KEY,
  company_id          BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id            BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tracked_pm_item_id  BIGINT REFERENCES tracked_pm_items(id) ON DELETE SET NULL,
  completed_on        DATE NOT NULL,
  odometer_or_hours   INTEGER,
  cost_cents          INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Non-PM repairs logged as completed maintenance. Also counts as an expense.
CREATE TABLE repairs (
  id              BIGSERIAL PRIMARY KEY,
  company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id        BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  completed_on    DATE NOT NULL,
  description     TEXT NOT NULL,
  cost_cents      INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  expense_category_id BIGINT REFERENCES expense_categories(id),   -- set once categories are decided
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expense categories. OPEN: Joe decides the final list. Seeded here as placeholders only.
-- Maintenance only: no fuel, DEF, tolls, insurance, or other operating costs.
-- Top-level categories have parent_id NULL. Subcategories point at their parent (e.g. APU > PM).
CREATE TABLE expense_categories (
  id              BIGSERIAL PRIMARY KEY,
  company_id      BIGINT REFERENCES companies(id) ON DELETE CASCADE,   -- NULL = shared list
  parent_id       BIGINT REFERENCES expense_categories(id) ON DELETE CASCADE,   -- NULL = top-level category
  name            TEXT NOT NULL,
  is_placeholder  BOOLEAN NOT NULL DEFAULT true                         -- OPEN: replace after Joe decides
);
-- Names repeat under different parents (PM appears under APU and Reefer), so uniqueness includes the parent.
-- UNIQUE constraints ignore NULLs, so use partial indexes for shared and per-company rows.
CREATE UNIQUE INDEX uq_expense_categories_shared  ON expense_categories (COALESCE(parent_id, 0), name) WHERE company_id IS NULL;
CREATE UNIQUE INDEX uq_expense_categories_company ON expense_categories (company_id, COALESCE(parent_id, 0), name) WHERE company_id IS NOT NULL;

-- Proposed maintenance categories (Joe's list, October 17, 2026). Not yet seeded; OPEN until Joe confirms.
--   Tires; Oil and lube; Fluids (coolant, transmission, brake, power steering); Filters (air, fuel, cabin);
--   Brakes; Engine; Electrical and lights; Body and glass; Tow and roadside; Trailer
--   APU: PM, Belts, Parts
--   Reefer: PM, DPF, Belts and hoses, [more to be added by Joe]
--   Rule (Joe, October 17, 2026): every recommended PM service interval must be sourced from Thermo King and Carrier.
--   This covers all reefer subcategories (PM, DPF, belts and hoses, and any added later).
--   APU intervals (Joe, October 17, 2026): the dropdown offers Carrier and Thermo King intervals (sourced, stored in manufacturer_intervals).
--   An off-brand APU make is allowed, and the user enters their own intervals (interval_source = 'user_entered' in tracked_pm_items).
--   Fleet pricing starts at asset number 7 (six assets is the maximum on a plan).

CREATE TABLE expenses (
  id                  BIGSERIAL PRIMARY KEY,
  company_id          BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id            BIGINT REFERENCES assets(id) ON DELETE SET NULL,
  expense_category_id BIGINT REFERENCES expense_categories(id),
  spent_on            DATE NOT NULL,
  amount_cents        INTEGER NOT NULL CHECK (amount_cents >= 0),
  description         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Receipt files. The file itself lives in object storage; the database keeps the reference.
CREATE TABLE receipts (
  id              BIGSERIAL PRIMARY KEY,
  company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  expense_id      BIGINT REFERENCES expenses(id) ON DELETE CASCADE,
  pm_entry_id     BIGINT REFERENCES pm_entries(id) ON DELETE CASCADE,
  repair_id       BIGINT REFERENCES repairs(id) ON DELETE CASCADE,
  storage_key     TEXT NOT NULL,                       -- OPEN: storage provider not yet chosen
  original_name   TEXT,
  mime_type       TEXT,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(expense_id, pm_entry_id, repair_id) = 1)   -- each receipt attaches to exactly one record
);

-- Referral credits. Rules come from the Billing and Account role; amounts are not final.
CREATE TABLE referral_credits (
  id                  BIGSERIAL PRIMARY KEY,
  referring_company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  referred_company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  credit_cents         INTEGER NOT NULL CHECK (credit_cents >= 0),
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'void')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes for totals by month, quarter, year, and lifetime, and for sorting by asset type.
CREATE INDEX idx_pm_entries_asset_date ON pm_entries (company_id, asset_id, completed_on);
CREATE INDEX idx_repairs_asset_date    ON repairs (company_id, asset_id, completed_on);
CREATE INDEX idx_expenses_company_date ON expenses (company_id, spent_on);
CREATE INDEX idx_assets_company_type   ON assets (company_id, asset_type);

-- OPEN ITEMS (for Joe and for Quality Assurance)
-- 1. Expense categories: Joe decides the final list. Placeholders above.
-- 2. Receipt storage provider: needed to fill storage_key. Choose with Joe before upload work.
-- 3. Manufacturer intervals: no rows yet. The Research role must supply each one with its source before it is stored.
-- 4. Billing: plan and billing_term fields are in place; payment processor deferred until Joe hears back from Paddle.
-- 5. New-device PIN: where the PIN is delivered (email is assumed here) and how many tries before lockout (5 assumed). Confirm with Joe.
-- 6. Pricing on the website: the current page (Truck Only $5, Truck plus Trailer $9, additional assets $4 each,
--    up to six total assets, annual prepay $55, $100, and $44 per added asset) is the source. The Database Architect
--    skill text lists older pricing ($4 trailer add-on, $2 referral credits) and should be corrected before use.
