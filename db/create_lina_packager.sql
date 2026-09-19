-- ============================================================
-- Crea el usuario de empaque para Lina Ortiz.
-- Pégalo en el SQL Editor de Supabase y dale Run.
--
-- Usuario: lina.ortiz
-- Contraseña inicial: 5pBvRtWn
-- (puedes cambiarla luego desde "Usuarios de empaque" en el panel admin)
-- ============================================================

INSERT INTO users (username, password_hash, role, active) VALUES
  ('lina.ortiz', crypt('5pBvRtWn', gen_salt('bf')), 'empaque', true)
ON CONFLICT (username) DO NOTHING;

SELECT username, role, active FROM users WHERE username = 'lina.ortiz';
