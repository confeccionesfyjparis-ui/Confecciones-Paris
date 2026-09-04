-- ============================================================
-- Carga inicial: admin, prendas del Excel, colaboradores de ejemplo
-- Pégalo completo en el SQL Editor de Supabase y dale RUN,
-- igual como hiciste con schema.sql.
-- ============================================================

-- 1) Usuario administrador
-- IMPORTANTE: cambia 'cambiar123' por la contraseña que TÚ quieras usar
-- antes de darle Run. Es lo único que debes editar en este archivo.
INSERT INTO users (username, password_hash, role)
VALUES ('admin', crypt('cambiar123', gen_salt('bf')), 'admin')
ON CONFLICT (username) DO NOTHING;

-- 2) Prendas y operaciones (datos reales del Excel "Precios finales.xlsx")
DO $$
DECLARE
  g_id UUID;
BEGIN
  -- Jogger Dama
  INSERT INTO garments (name) VALUES ('Jogger Dama')
    ON CONFLICT (name) DO NOTHING;
  SELECT id INTO g_id FROM garments WHERE name = 'Jogger Dama';
  INSERT INTO operations (garment_id, name, rate) VALUES
    (g_id, 'Embolsillar delantero completo', 340),
    (g_id, 'Filetear bolsillo X 2', 80),
    (g_id, 'Cerrar tiro delantero', 60),
    (g_id, 'Cerrar tiro trasero con marquilla', 80),
    (g_id, 'Cerrar costados y entre pierna', 250),
    (g_id, 'Fijar bolsillo', 50),
    (g_id, 'Unir pretina X2', 90),
    (g_id, 'Unir elastico pretina', 40),
    (g_id, 'Unir elastico de bota X 2', 80),
    (g_id, 'Armar pretina', 140),
    (g_id, 'Acentar pretinas', 65),
    (g_id, 'Pegar pretinas', 180),
    (g_id, 'Hacer ruedos con elastico', 130),
    (g_id, 'Unir y hacer tiras', 80)
  ON CONFLICT (garment_id, name) DO NOTHING;

  -- Jogger Vena
  INSERT INTO garments (name) VALUES ('Jogger Vena')
    ON CONFLICT (name) DO NOTHING;
  SELECT id INTO g_id FROM garments WHERE name = 'Jogger Vena';
  INSERT INTO operations (garment_id, name, rate) VALUES
    (g_id, 'Hacer vena X 2', 150),
    (g_id, 'Embolsillar delantero completo', 340),
    (g_id, 'Filetear bolsillo X 2', 80),
    (g_id, 'Cerrar tiro delantero', 60),
    (g_id, 'Cerrar tiro trasero con marquilla', 80),
    (g_id, 'Cerrar costados y entre pierna', 250),
    (g_id, 'Fijar bolsillo', 50),
    (g_id, 'Unir pretina X2', 90),
    (g_id, 'Unir elastico pretina', 40),
    (g_id, 'Armar pretinas', 140),
    (g_id, 'Acentar pretinas', 65),
    (g_id, 'Pegar pretinas', 180),
    (g_id, 'Hacer ruedos', 100),
    (g_id, 'Unir y hacer tiras', 80)
  ON CONFLICT (garment_id, name) DO NOTHING;

  -- Capri Dama
  INSERT INTO garments (name) VALUES ('Capri Dama')
    ON CONFLICT (name) DO NOTHING;
  SELECT id INTO g_id FROM garments WHERE name = 'Capri Dama';
  INSERT INTO operations (garment_id, name, rate) VALUES
    (g_id, 'Embolsillar delantero completo', 320),
    (g_id, 'Filetear bolsillo X 2', 75),
    (g_id, 'Cerrar tiro delantero', 55),
    (g_id, 'Cerrar tiro trasero con marquilla', 75),
    (g_id, 'Cerrar costados y entre pierna', 220),
    (g_id, 'Fijar bolsillo', 50),
    (g_id, 'Unir pretina', 40),
    (g_id, 'Unir elastico pretina', 35),
    (g_id, 'Armar pretina', 120),
    (g_id, 'Acentar pretinas', 60),
    (g_id, 'Pegar pretinas', 150),
    (g_id, 'Hacer ruedos dobles', 130),
    (g_id, 'Unir y hacer tiras', 70)
  ON CONFLICT (garment_id, name) DO NOTHING;

  -- Short Dama
  INSERT INTO garments (name) VALUES ('Short Dama')
    ON CONFLICT (name) DO NOTHING;
  SELECT id INTO g_id FROM garments WHERE name = 'Short Dama';
  INSERT INTO operations (garment_id, name, rate) VALUES
    (g_id, 'Embolsillar delantero completo', 320),
    (g_id, 'Filetear bolsillo X 2', 75),
    (g_id, 'Cerrar tiro delantero', 55),
    (g_id, 'Cerrar tiro trasero con marquilla', 75),
    (g_id, 'Cerrar costados y entre pierna', 220),
    (g_id, 'Fijar bolsillo', 50),
    (g_id, 'Unir pretina', 40),
    (g_id, 'Unir elastico pretina', 35),
    (g_id, 'Armar pretina', 120),
    (g_id, 'Acentar pretinas', 60),
    (g_id, 'Pegar pretinas', 150),
    (g_id, 'Hacer ruedos', 90),
    (g_id, 'Unir y hacer tiras', 70)
  ON CONFLICT (garment_id, name) DO NOTHING;
END $$;

-- 3) Colaboradores de ejemplo (reemplázalos por los reales desde el panel admin)
INSERT INTO employees (name, pin_hash, active) VALUES
  ('Maria Restrepo', crypt('1111', gen_salt('bf')), true),
  ('Luz Elena Zapata', crypt('2222', gen_salt('bf')), true),
  ('Carlos Mario Velez', crypt('3333', gen_salt('bf')), true),
  ('Diana Marcela Rios', crypt('4444', gen_salt('bf')), true)
ON CONFLICT DO NOTHING;

-- Verificación rápida: deberías ver 1 admin, 4 prendas y 4 colaboradores
SELECT
  (SELECT count(*) FROM users) AS usuarios_admin,
  (SELECT count(*) FROM garments) AS prendas,
  (SELECT count(*) FROM operations) AS operaciones,
  (SELECT count(*) FROM employees) AS colaboradores;
