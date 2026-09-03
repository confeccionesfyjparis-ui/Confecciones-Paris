# Taller de confección — Control de producción por operación

Sistema real (Next.js + PostgreSQL) para reemplazar el pago por salario fijo
por pago por operación/prenda producida, con control estricto de inventario,
cortes viernes→jueves, liquidaciones en PDF, y autenticación real por
colaborador.

## Qué incluye

- **Base de datos PostgreSQL** (`db/schema.sql`): 12 tablas — usuarios,
  colaboradores, prendas, operaciones, historial de tarifas, órdenes, saldo
  por orden+operación, períodos, registros de producción, liquidaciones,
  auditoría.
- **Inventario a prueba de concurrencia real**: el registro de producción usa
  `SELECT ... FOR UPDATE` dentro de una transacción, así que aunque 45
  colaboradores registren al mismo tiempo sobre la misma operación, el
  inventario nunca queda negativo y no se pierde ningún registro. Esto está
  probado con un script de concurrencia real contra Postgres
  (`scripts/concurrency-test.ts`).
- **Autenticación real**: sesión firmada (JWT en cookie httpOnly), PIN de
  colaborador y contraseña de administrador con hash bcrypt. La identidad
  siempre se resuelve en el servidor — nadie puede registrar producción a
  nombre de otra persona manipulando el navegador.
- **Liquidación en PDF** (media carta) generada en el servidor, con sellado
  automático la primera vez que se descarga.
- **Cálculo de utilidad** en el Dashboard: solo cuenta como "vendida" una
  prenda que ya pasó por TODAS sus operaciones (evita inflar ingresos).
- **Datos reales cargados**: las 4 prendas del Excel original con sus 54
  operaciones y tarifas exactas (`scripts/seed.ts`).

## 1. Requisitos

- Node.js 20 o superior
- Una base de datos PostgreSQL (16 o superior recomendado)

## 2. Instalación local

```bash
npm install
cp .env.example .env
```

Edita `.env` con los datos de tu base de datos:

```
DATABASE_URL=postgresql://usuario:password@host:5432/nombre_basedatos
SESSION_SECRET=genera-un-secreto-largo-y-aleatorio
```

Para generar un `SESSION_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Crear el esquema de base de datos

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

(O pega el contenido de `db/schema.sql` en la consola SQL de tu proveedor de
base de datos si no tienes `psql` instalado localmente — Neon, Supabase y
Railway todos traen un editor SQL en su panel web.)

## 4. Cargar los datos iniciales (seed)

```bash
SEED_ADMIN_USER=admin SEED_ADMIN_PASSWORD=tu-contraseña-segura npx tsx scripts/seed.ts
```

Esto crea:
- Un usuario administrador (usuario/contraseña que pongas en las variables
  de entorno; por defecto `admin` / `cambiar123` si no las defines — **cámbiala**).
- Las 4 prendas del Excel con sus 54 operaciones y tarifas.
- 4 colaboradores de ejemplo con PIN `1111`, `2222`, `3333`, `4444` —
  reemplázalos por tus colaboradores reales desde el panel admin
  ("Colaboradores" → "Agregar"), o edita el script antes de correrlo.

## 5. Correr en desarrollo

```bash
npm run dev
```

Abre `http://localhost:3000`.

## 6. Desplegar en producción

Necesitas dos cosas alojadas en internet: la base de datos y la aplicación
Next.js. Estas combinaciones son las más simples para un equipo pequeño:

**Base de datos (elige una, todas tienen plan gratuito para empezar):**
- Neon (neon.tech) — Postgres serverless, muy simple de conectar.
- Supabase (supabase.com) — Postgres + panel de administración visual.
- Railway (railway.app) — Postgres administrado, fácil de usar.

**Aplicación (elige una):**
- Vercel (vercel.com) — el más simple para Next.js. Conecta tu repositorio
  de GitHub, define las variables de entorno (`DATABASE_URL`,
  `SESSION_SECRET`) en el panel, y despliega. Detecta Next.js automáticamente.
- Railway (railway.app) — puede alojar la app y la base de datos en el
  mismo lugar.

Pasos generales:
1. Sube este proyecto a un repositorio de GitHub.
2. Crea la base de datos en tu proveedor elegido y copia su cadena de
   conexión (`DATABASE_URL`).
3. Corre `db/schema.sql` contra esa base de datos (paso 3 de arriba).
4. Corre `scripts/seed.ts` contra esa base de datos (paso 4 de arriba, con
   las variables de entorno apuntando a la base de datos de producción).
5. Conecta el repositorio a Vercel (o Railway), define las variables de
   entorno `DATABASE_URL` y `SESSION_SECRET`, y despliega.
6. Una vez desplegado, entra como administrador y reemplaza los
   colaboradores de ejemplo por los 45 reales.

Los colaboradores accederán desde su celular a la URL que te dé tu proveedor
de hosting (ej. tu-taller.vercel.app) — cada uno con su propio PIN, y todos
verán el mismo inventario en tiempo real, sin importar cuántos registren al
mismo tiempo.

## 7. Cambiar la contraseña de administrador

Genera un nuevo hash y actualízalo directamente en la base de datos:

```bash
node -e "console.log(require('bcryptjs').hashSync('tu-nueva-contraseña', 10))"
```

```sql
UPDATE users SET password_hash = 'el-hash-que-generaste' WHERE username = 'admin';
```

## 8. Estructura del proyecto

```
db/schema.sql                   Esquema completo de la base de datos
scripts/seed.ts                 Carga datos iniciales (prendas, admin, colaboradores demo)
scripts/concurrency-test.ts     Prueba real de concurrencia contra Postgres
lib/db.ts                       Conexión a Postgres + helper de transacciones
lib/auth.ts                     Sesión firmada (JWT), hash de contraseñas/PIN
lib/errors.ts                   Clases de error compartidas
lib/dates.ts                    Cálculo de cortes viernes→jueves
lib/audit.ts                    Helper de auditoría
lib/actions/                    Toda la lógica de negocio (Server Actions)
  auth.ts                       Login/logout
  production.ts                 Registro de producción (con bloqueo de fila)
  orders.ts                     Órdenes de producción
  garments.ts                   Prendas, operaciones, tarifas
  employees.ts                  Colaboradores
  periods.ts                    Períodos y liquidaciones
  settlements.ts                Liquidaciones
  dashboard.ts                  Datos agregados + utilidad
  audit.ts                      Consulta de auditoría
middleware.ts                   Protege /admin y /employee según el rol de sesión
app/login/                      Página de login
app/(app)/employee/             Interfaz de colaborador
app/(app)/admin/                Panel de administrador (7 pestañas)
app/api/settlements/[id]/pdf/   Generación del recibo PDF (media carta)
```

## 9. Qué probé antes de entregarte esto

- Esquema aplicado sin errores contra PostgreSQL real.
- Prueba de concurrencia: 45 registros simultáneos contra 100 unidades
  disponibles → exactamente 20 aceptados, 25 rechazados, inventario nunca
  negativo, cero registros perdidos.
- 17 flujos de punta a punta por HTTP real (login, creación de prenda/orden/
  colaborador, registro de producción válido e inválido, control de acceso
  por rol, cálculo de utilidad, cierre de período, generación de liquidación
  con monto verificado, generación de PDF con firma de archivo válida,
  protección de rutas por middleware).
- `npm run build` compila sin errores de TypeScript ni de Next.js.

## 10. Qué sigue siendo trabajo tuyo (o mío, si quieres ayuda después)

- Reemplazar los 4 colaboradores de ejemplo por los 45 reales.
- Revisar/ajustar el diseño visual si quieres algo distinto al estilo actual.
- Si más adelante quieres reportes exportables a Excel adicionales, un
  módulo de reabrir períodos cerrados con permisos especiales, o
  notificaciones, eso no está incluido todavía — dímelo y lo construimos.
