-- ============================================================
-- Migración: agrega la fecha de cierre de una orden de producción
-- Pégalo en el SQL Editor de Supabase y dale Run.
-- ============================================================

ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
