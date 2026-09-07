-- ============================================================
-- Migración: permite corregir un registro de producción a 0 unidades
-- (útil cuando el colaborador se equivocó por completo y quiere anularlo)
--
-- Pégalo en el SQL Editor de Supabase y dale "Run without RLS",
-- igual que hiciste con schema.sql y seed.sql.
--
-- NOTA: si ya habías corrido el archivo "migration_add_eliminado_status.sql"
-- que te di antes, no pasa nada, este es independiente y no lo pisa.
-- Si NO lo habías corrido, ignóralo — ya no hace falta, usamos este en su lugar.
-- ============================================================

ALTER TABLE production_records DROP CONSTRAINT production_records_qty_check;

ALTER TABLE production_records ADD CONSTRAINT production_records_qty_check
  CHECK (qty >= 0);
