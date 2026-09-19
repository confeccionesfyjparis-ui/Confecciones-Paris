-- ============================================================
-- Agrega la referencia/prenda a las líneas de las liquidaciones que
-- ya estaban cerradas ANTES del arreglo (por eso no mostraban la
-- referencia debajo de cada operación).
--
-- Es seguro: solo reescribe el detalle (lines) de cada liquidación,
-- reconstruido a partir de los registros de producción reales de ese
-- período+colaborador. NUNCA toca total, net_total, deducciones ni el
-- estado de sellado. Si por algún motivo la suma reconstruida no
-- coincide EXACTO con el total ya guardado, esa liquidación se deja
-- intacta y se avisa con NOTICE para revisarla a mano — no se arriesga
-- a cambiar un monto.
--
-- Pégalo en el SQL Editor de Supabase y dale Run.
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  new_lines JSONB;
  new_total NUMERIC;
  updated_count INT := 0;
  skipped_count INT := 0;
BEGIN
  FOR rec IN SELECT id, period_id, employee_id, total FROM settlements WHERE is_manual = false
  LOOP
    SELECT jsonb_agg(
             jsonb_build_object(
               'operationName', operation_name,
               'garmentName', garment_name,
               'orderNumber', order_number,
               'rate', rate,
               'qty', qty,
               'total', line_total
             ) ORDER BY order_number, garment_name, operation_name
           ),
           SUM(line_total)
    INTO new_lines, new_total
    FROM (
      SELECT g.name AS garment_name, po.number AS order_number, pr.operation_name, pr.rate,
             SUM(pr.qty) AS qty, SUM(pr.total) AS line_total
      FROM production_records pr
      JOIN production_orders po ON po.id = pr.order_id
      JOIN garments g ON g.id = po.garment_id
      WHERE pr.period_id = rec.period_id
        AND pr.employee_id = rec.employee_id
        AND pr.status IN ('liquidado','activo')
      GROUP BY g.name, po.number, pr.operation_name, pr.rate
      HAVING SUM(pr.qty) > 0
    ) grouped;

    IF new_lines IS NOT NULL AND new_total = rec.total THEN
      UPDATE settlements SET lines = new_lines WHERE id = rec.id;
      updated_count := updated_count + 1;
    ELSE
      skipped_count := skipped_count + 1;
      RAISE NOTICE 'Liquidación % NO se tocó (no coincidió el total: guardado %, reconstruido %). Revisar a mano.',
        rec.id, rec.total, COALESCE(new_total, 0);
    END IF;
  END LOOP;

  RAISE NOTICE 'Listo: % liquidaciones actualizadas con la referencia, % omitidas por seguridad.', updated_count, skipped_count;
END $$;
