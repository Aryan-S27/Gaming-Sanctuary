-- =========================================================
--  GAMING SANCTUARY — Supabase Database Setup
--  Run this entire file in your Supabase SQL Editor.
--  Project: https://supabase.com/dashboard/project/qvtbiezemtglatixymxp
-- =========================================================

-- =========================================================
--  STEP 0 — CLEANUP (safe to re-run; drops old schema)
-- =========================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS auth_role() CASCADE;

DROP TABLE IF EXISTS orders    CASCADE;
DROP TABLE IF EXISTS bookings  CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS rigs       CASCADE;
DROP TABLE IF EXISTS profiles   CASCADE;

DROP TYPE IF EXISTS menu_category CASCADE;
DROP TYPE IF EXISTS delivery_type  CASCADE;
DROP TYPE IF EXISTS order_status   CASCADE;
DROP TYPE IF EXISTS rig_status     CASCADE;
DROP TYPE IF EXISTS rig_type       CASCADE;

-- =========================================================
--  STEP 1 — SETUP
-- =========================================================

-- ---- Extensions ------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---- Enums -----------------------------------------------------
CREATE TYPE rig_type      AS ENUM ('PC', 'Console');
CREATE TYPE rig_status    AS ENUM ('available', 'occupied', 'maintenance');
CREATE TYPE order_status  AS ENUM ('pending', 'preparing', 'completed');
CREATE TYPE delivery_type AS ENUM ('rig_delivery', 'pickup');
CREATE TYPE menu_category AS ENUM ('drinks', 'food', 'snacks');

-- ---- Profiles (extends auth.users) -----------------------------
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin','customer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- Rigs ------------------------------------------------------
CREATE TABLE rigs (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  type         rig_type NOT NULL,
  specs        TEXT NOT NULL,
  status       rig_status NOT NULL DEFAULT 'available',
  price_per_hour NUMERIC(10,2) NOT NULL DEFAULT 150.00,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ---- Bookings --------------------------------------------------
CREATE TABLE bookings (
  id           SERIAL PRIMARY KEY,
  rig_id       INT NOT NULL REFERENCES rigs(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  notes        TEXT,            -- used for walk-in customer display name
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ---- Menu Items ------------------------------------------------
CREATE TABLE menu_items (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  price       NUMERIC(10,2) NOT NULL,
  category    menu_category NOT NULL,
  image_url   TEXT,
  available   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ---- Orders ----------------------------------------------------
CREATE TABLE orders (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  items         JSONB NOT NULL,   -- [{id, name, price, qty}]
  total         NUMERIC(10,2) NOT NULL,
  status        order_status NOT NULL DEFAULT 'pending',
  delivery_type delivery_type NOT NULL,
  rig_number    TEXT,             -- populated when delivery_type = 'rig_delivery'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
--  ROW LEVEL SECURITY
-- =========================================================

-- ---- profiles --------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "own profile write"
  ON profiles FOR ALL
  USING (auth.uid() = id);

-- ---- rigs ------------------------------------------------------
ALTER TABLE rigs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read rigs"
  ON rigs FOR SELECT USING (true);

CREATE POLICY "admin write rigs"
  ON rigs FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ---- bookings --------------------------------------------------
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own bookings select"
  ON bookings FOR SELECT
  USING (
    auth.uid() = user_id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "insert own booking"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own or admin"
  ON bookings FOR DELETE
  USING (
    auth.uid() = user_id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ---- menu_items ------------------------------------------------
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read menu"
  ON menu_items FOR SELECT USING (true);

CREATE POLICY "admin write menu"
  ON menu_items FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ---- orders ----------------------------------------------------
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own orders select"
  ON orders FOR SELECT
  USING (
    auth.uid() = user_id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "insert own order"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin update orders"
  ON orders FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- =========================================================
--  AUTH TRIGGER — auto-create profile on signup
-- =========================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =========================================================
--  SEED DATA
-- =========================================================

-- Rigs
INSERT INTO rigs (name, type, specs, status) VALUES
  ('Rig 01', 'PC',      'RTX 4090 | i9-13900K | 64GB DDR5 | 2TB NVMe',         'available'),
  ('Rig 02', 'PC',      'RTX 4080 | i7-13700K | 32GB DDR5 | 1TB NVMe',         'available'),
  ('Rig 03', 'PC',      'RTX 4070 Ti | Ryzen 9 7950X | 32GB DDR5 | 1TB NVMe',  'available'),
  ('Rig 04', 'Console', 'PS5 | 4K 144Hz OLED | DualSense Edge Controller',      'available'),
  ('Rig 05', 'Console', 'Xbox Series X | 4K 120Hz | Elite Series 2 Controller', 'maintenance');

-- Menu Items
INSERT INTO menu_items (name, description, price, category, available) VALUES
  ('Monster Energy',    'Ice-cold energy to fuel your session',          150, 'drinks', true),
  ('Red Bull',          'Original or sugar-free, your choice',           120, 'drinks', true),
  ('Gaming Burger',     'Double patty, cheese, jalapeños, game sauce',   280, 'food',   true),
  ('Loaded Fries',      'Crispy fries with cheese sauce & bacon bits',   180, 'snacks', true),
  ('Chicken Wings (6)', 'BBQ or buffalo glazed, with dipping sauce',     250, 'food',   true),
  ('Cold Brew Coffee',  'Smooth concentrate over ice',                   130, 'drinks', true),
  ('Nachos Supreme',    'Tortilla chips, salsa, sour cream, guac',       200, 'snacks', true),
  ('Instant Noodles',   'Spicy ramen, ready in 3 minutes',                90, 'food',   true);
