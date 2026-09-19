-- ============================================================
-- Migración: liquidaciones manuales + novedades ampliadas + empaque
-- Pégalo en el SQL Editor de Supabase y dale Run.
-- ============================================================

ALTER TABLE settlements ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE deductions DROP CONSTRAINT IF EXISTS deductions_concept_check;
ALTER TABLE deductions ADD CONSTRAINT deductions_concept_check
  CHECK (concept IN ('Deducción por daños','Deducción por préstamo','Pago por prestación de servicios'));

CREATE TABLE IF NOT EXISTS packaging_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES production_orders(id),
  qty INT NOT NULL CHECK (qty > 0),
  registered_by TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
