-- ============================================================
-- Reabre el período 25 sept – 1 oct 2026 que se cerró por error.
-- Devuelve toda la producción a estado "activo" (como si nunca se
-- hubiera cerrado) y elimina las liquidaciones generadas, incluida
-- la de Maria Avancines que ya tenía el PDF descargado.
--
-- Pégalo en el SQL Editor de Supabase y dale Run.
-- Si algo sale mal (por ejemplo si ya hay otro período abierto),
-- el bloque se detiene y no cambia nada — es seguro de intentar.
-- ============================================================

DO $$
DECLARE
  v_period_id UUID;
  v_other_open_count INT;
  v_records_reverted INT;
  v_settlements_deleted INT;
BEGIN
  SELECT id INTO v_period_id FROM production_periods
    WHERE start_date = '2026-09-25' AND end_date = '2026-10-01';

  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el período 25 sept – 1 oct 2026. Revisa las fechas.';
  END IF;

  SELECT COUNT(*) INTO v_other_open_count FROM production_periods
    WHERE status = 'abierto' AND id != v_period_id;

  IF v_other_open_count > 0 THEN
    RAISE EXCEPTION 'Ya hay otro período abierto distinto a este. Ciérralo primero desde la app antes de reabrir este.';
  END IF;

  UPDATE production_records SET status = 'activo'
    WHERE period_id = v_period_id AND status = 'liquidado';
  GET DIAGNOSTICS v_records_reverted = ROW_COUNT;

  DELETE FROM settlements WHERE period_id = v_period_id;
  GET DIAGNOSTICS v_settlements_deleted = ROW_COUNT;

  UPDATE production_periods SET status = 'abierto' WHERE id = v_period_id;

  RAISE NOTICE 'Listo: % registros de producción devueltos a activo, % liquidaciones eliminadas.',
    v_records_reverted, v_settlements_deleted;
END $$;

-- Verificación: debería aparecer como "abierto"
SELECT start_date, end_date, status FROM production_periods
  WHERE start_date = '2026-09-25' AND end_date = '2026-10-01';
