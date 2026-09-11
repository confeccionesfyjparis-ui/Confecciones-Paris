-- ============================================================
-- Crea los 3 usuarios de consulta (Denilson, Jeferson, Oscar)
-- Pégalo en el SQL Editor de Supabase y dale Run.
--
-- Cada uno queda con esta contraseña inicial (compártesela a cada uno,
-- y si prefieres cambiarla después, puedes hacerlo desde la pestaña
-- "Usuarios de consulta" en el panel admin con el botón "Cambiar contraseña"):
--
--   denilson / GKubx7s7
--   jeferson / fjaERxHh
--   oscar    / JVM4VMDn
-- ============================================================

INSERT INTO users (username, password_hash, role, active) VALUES
  ('denilson', crypt('GKubx7s7', gen_salt('bf')), 'viewer', true),
  ('jeferson', crypt('fjaERxHh', gen_salt('bf')), 'viewer', true),
  ('oscar',    crypt('JVM4VMDn', gen_salt('bf')), 'viewer', true)
ON CONFLICT (username) DO NOTHING;

-- Verificación: deberías ver las 3 filas
SELECT username, role, active FROM users WHERE role = 'viewer';
