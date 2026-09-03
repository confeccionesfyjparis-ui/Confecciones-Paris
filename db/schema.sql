-- ============================================================
-- Esquema de base de datos: Taller de confección
-- Control de producción por operación / pago por destajo
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Usuarios administradores ----------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Colaboradores ----------
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Prendas / referencias ----------
CREATE TABLE IF NOT EXISTS garments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  sale_price NUMERIC(12,2),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Catálogo de operaciones por prenda (con su tarifa vigente) ----------
CREATE TABLE IF NOT EXISTS operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garment_id UUID NOT NULL REFERENCES garments(id),
  name TEXT NOT NULL,
  rate NUMERIC(12,2) NOT NULL CHECK (rate > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(garment_id, name)
);

-- ---------- Historial de tarifas (trazabilidad de cambios) ----------
CREATE TABLE IF NOT EXISTS operation_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES operations(id),
  old_rate NUMERIC(12,2),
  new_rate NUMERIC(12,2) NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Historial de precio de venta ----------
CREATE TABLE IF NOT EXISTS garment_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garment_id UUID NOT NULL REFERENCES garments(id),
  old_price NUMERIC(12,2),
  new_price NUMERIC(12,2) NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Órdenes de producción ----------
CREATE TABLE IF NOT EXISTS production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT UNIQUE NOT NULL,
  garment_id UUID NOT NULL REFERENCES garments(id),
  client TEXT,
  color TEXT,
  size TEXT,
  initial_qty INT NOT NULL CHECK (initial_qty > 0),
  start_date DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente','en_produccion','terminada','cerrada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Saldo disponible por orden + operación (el corazón del inventario) ----------
CREATE TABLE IF NOT EXISTS order_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES production_orders(id),
  operation_id UUID NOT NULL REFERENCES operations(id),
  operation_name TEXT NOT NULL,   -- snapshot del nombre al crear la orden
  rate NUMERIC(12,2) NOT NULL,    -- snapshot de la tarifa al crear la orden
  total_qty INT NOT NULL CHECK (total_qty > 0),
  processed_qty INT NOT NULL DEFAULT 0 CHECK (processed_qty >= 0),
  CONSTRAINT processed_not_over_total CHECK (processed_qty <= total_qty),
  UNIQUE(order_id, operation_id)
);

-- ---------- Cortes de producción (viernes -> jueves) ----------
CREATE TABLE IF NOT EXISTS production_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto','cerrado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(start_date, end_date)
);

-- ---------- Registros de producción ----------
CREATE TABLE IF NOT EXISTS production_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  order_id UUID NOT NULL REFERENCES production_orders(id),
  order_operation_id UUID NOT NULL REFERENCES order_operations(id),
  operation_name TEXT NOT NULL,
  qty INT NOT NULL CHECK (qty > 0),
  rate NUMERIC(12,2) NOT NULL,
  total NUMERIC(14,2) NOT NULL,
  period_id UUID NOT NULL REFERENCES production_periods(id),
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo','liquidado','corregido')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_records_period ON production_records(period_id);
CREATE INDEX IF NOT EXISTS idx_records_employee ON production_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_records_order ON production_records(order_id);
CREATE INDEX IF NOT EXISTS idx_records_date ON production_records(registered_at);

-- ---------- Liquidaciones ----------
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES production_periods(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  total NUMERIC(14,2) NOT NULL,
  lines JSONB NOT NULL,
  sealed BOOLEAN NOT NULL DEFAULT false,
  sealed_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(period_id, employee_id)
);

-- ---------- Auditoría ----------
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL,   -- 'admin' | 'employee' | 'system'
  actor_name TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);
