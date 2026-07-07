-- ============================================================
-- HMS Database Schema for Supabase (PostgreSQL 17)
-- Run this entire script in the Supabase SQL Editor
-- Project: Rashford Project (wmroidutfnedublujyfw)
-- ============================================================

-- Drop tables in reverse dependency order (clean slate)
DROP TABLE IF EXISTS pharmacy_stock CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS lab_orders CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS encounters CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS hms_users CASCADE;

-- ============================================================
-- TABLE 1: hms_users
-- RBAC user accounts (we use hms_users to avoid conflict with
-- Supabase's built-in auth.users table)
-- ============================================================
CREATE TABLE hms_users (
    user_id     SERIAL PRIMARY KEY,
    username    VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,   -- bcrypt hash
    role        VARCHAR(20) NOT NULL CHECK (role IN ('Admin','Doctor','Nurse','Pharmacist','LabTech','Accountant')),
    full_name   VARCHAR(100) NOT NULL DEFAULT '',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE 2: patients
-- Stores unique demographic profiles (3NF entity)
-- ============================================================
CREATE TABLE patients (
    patient_pin VARCHAR(20) PRIMARY KEY,          -- PT-YYYYMMDD-XXXX
    first_name  VARCHAR(50) NOT NULL,
    last_name   VARCHAR(50) NOT NULL,
    dob         DATE NOT NULL,
    gender      VARCHAR(10) NOT NULL CHECK (gender IN ('Male','Female','Other')),
    phone_num   VARCHAR(20),
    registered_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE 3: encounters
-- Each visit/triage+consultation cycle creates one row
-- ============================================================
CREATE TABLE encounters (
    encounter_id SERIAL PRIMARY KEY,
    patient_pin  VARCHAR(20) NOT NULL REFERENCES patients(patient_pin) ON DELETE CASCADE,
    doctor_id    INTEGER NOT NULL REFERENCES hms_users(user_id) ON DELETE RESTRICT,
    triage_vitals JSONB NOT NULL DEFAULT '{}',   -- {bp, temp, pulse, weight}
    clinical_notes TEXT,
    date_created TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_encounters_patient_pin ON encounters(patient_pin);
CREATE INDEX idx_encounters_doctor_id   ON encounters(doctor_id);

-- ============================================================
-- TABLE 4: prescriptions
-- Digital prescriptions linked to encounter visit
-- ============================================================
CREATE TABLE prescriptions (
    script_id     SERIAL PRIMARY KEY,
    encounter_id  INTEGER NOT NULL REFERENCES encounters(encounter_id) ON DELETE CASCADE,
    pharmacist_id INTEGER REFERENCES hms_users(user_id) ON DELETE SET NULL,
    medication_name VARCHAR(100) NOT NULL,
    dosage         VARCHAR(100) NOT NULL,
    quantity       INTEGER NOT NULL CHECK (quantity > 0),
    status_billing  VARCHAR(10) NOT NULL DEFAULT 'UNPAID' CHECK (status_billing IN ('UNPAID','PAID')),
    status_dispensed VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status_dispensed IN ('PENDING','DISPENSED')),
    created_at     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_prescriptions_encounter_id  ON prescriptions(encounter_id);
CREATE INDEX idx_prescriptions_pharmacist_id ON prescriptions(pharmacist_id);

-- ============================================================
-- TABLE 5: lab_orders
-- Lab diagnostic requests and signed-off result payloads
-- ============================================================
CREATE TABLE lab_orders (
    lab_order_id   SERIAL PRIMARY KEY,
    encounter_id   INTEGER NOT NULL REFERENCES encounters(encounter_id) ON DELETE CASCADE,
    tech_id        INTEGER REFERENCES hms_users(user_id) ON DELETE SET NULL,
    test_type      VARCHAR(100) NOT NULL,
    results_payload TEXT,
    status         VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED')),
    created_at     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_lab_orders_encounter_id ON lab_orders(encounter_id);
CREATE INDEX idx_lab_orders_tech_id      ON lab_orders(tech_id);

-- ============================================================
-- TABLE 6: invoices
-- Billing ledger – one consolidated invoice per patient visit
-- ============================================================
CREATE TABLE invoices (
    invoice_id     SERIAL PRIMARY KEY,
    patient_pin    VARCHAR(20) NOT NULL REFERENCES patients(patient_pin) ON DELETE CASCADE,
    accountant_id  INTEGER REFERENCES hms_users(user_id) ON DELETE SET NULL,
    total_amount   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(10) NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID','PAID')),
    items_snapshot JSONB,          -- snapshot of billed items at invoice creation
    date_created   TIMESTAMP DEFAULT NOW(),
    date_paid      TIMESTAMP
);
CREATE INDEX idx_invoices_patient_pin   ON invoices(patient_pin);
CREATE INDEX idx_invoices_accountant_id ON invoices(accountant_id);

-- ============================================================
-- TABLE 7: pharmacy_stock
-- Medication inventory ledger (auto-decremented on dispense)
-- ============================================================
CREATE TABLE pharmacy_stock (
    stock_id       SERIAL PRIMARY KEY,
    medication_name VARCHAR(100) UNIQUE NOT NULL,
    quantity       INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit_price_xaf DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    updated_at     TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default seed users
-- All passwords are literally "password123"
-- Bcrypt hash for "password123": $2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
-- Note: Since we're using JS client-side auth (no PHP bcrypt),
-- we will store plain-text placeholder and the JS layer will
-- compare using a simple stored hash or use Supabase Auth.
-- For the MVP demo, we store the plain password directly and
-- the JS will match it. In production, migrate to Supabase Auth.
INSERT INTO hms_users (username, password_hash, role, full_name) VALUES
('admin',      'password123', 'Admin',      'System Administrator'),
('dr_rashford','password123', 'Doctor',     'Dr. Marcus Rashford'),
('nurse_carol','password123', 'Nurse',      'Nurse Carol Nkeng'),
('ph_samuel',  'password123', 'Pharmacist', 'Samuel Eto''o'),
('tech_lab',   'password123', 'LabTech',    'Tech Lionel Feka'),
('acct_bill',  'password123', 'Accountant', 'Bill Kameni');

-- Default pharmacy stock items with XAF pricing
INSERT INTO pharmacy_stock (medication_name, quantity, unit_price_xaf) VALUES
('Amoxicillin 500mg',    150, 2500.00),
('Paracetamol 500mg',    300, 800.00),
('Ibuprofen 400mg',      200, 1200.00),
('Ciprofloxacin 500mg',  100, 3200.00),
('Metformin 850mg',      120, 1800.00),
('Artemether/Lumef.',    80,  4500.00),
('ORS Sachets (10pk)',   250, 600.00),
('Vitamin C 500mg',      180, 500.00);

-- ============================================================
-- DISABLE Row-Level Security for MVP development
-- (Enable and configure policies before production deployment)
-- ============================================================
ALTER TABLE hms_users       DISABLE ROW LEVEL SECURITY;
ALTER TABLE patients        DISABLE ROW LEVEL SECURITY;
ALTER TABLE encounters      DISABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions   DISABLE ROW LEVEL SECURITY;
ALTER TABLE lab_orders      DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices        DISABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_stock  DISABLE ROW LEVEL SECURITY;

-- GRANT anon and authenticated roles full access (MVP only)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
