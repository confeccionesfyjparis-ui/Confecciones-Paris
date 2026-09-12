-- ============================================================
-- Migración: deducciones (novedades) por daños o préstamo
-- Pégalo en el SQL Editor de Supabase y dale Run.
-- ============================================================

ALTER TABLE settlements ADD COLUMN IF NOT EXISTS deductions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS net_total NUMERIC(14,2) NOT NULL DEFAULT 0;

-- para las liquidaciones que ya existan, el total neto empieza igual al total (sin deducciones)
UPDATE settlements SET net_total = total WHERE net_total = 0;

CREATE TABLE IF NOT EXISTS deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES production_periods(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  concept TEXT NOT NULL CHECK (concept IN ('Deducción por daños','Deducción por préstamo')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
