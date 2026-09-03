import "dotenv/config";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const GARMENTS = [
  {
    name: "Jogger Dama",
    operations: [
      ["Embolsillar delantero completo", 340],
      ["Filetear bolsillo X 2", 80],
      ["Cerrar tiro delantero", 60],
      ["Cerrar tiro trasero con marquilla", 80],
      ["Cerrar costados y entre pierna", 250],
      ["Fijar bolsillo", 50],
      ["Unir pretina X2", 90],
      ["Unir elastico pretina", 40],
      ["Unir elastico de bota X 2", 80],
      ["Armar pretina", 140],
      ["Acentar pretinas", 65],
      ["Pegar pretinas", 180],
      ["Hacer ruedos con elastico", 130],
      ["Unir y hacer tiras", 80],
    ],
  },
  {
    name: "Jogger Vena",
    operations: [
      ["Hacer vena X 2", 150],
      ["Embolsillar delantero completo", 340],
      ["Filetear bolsillo X 2", 80],
      ["Cerrar tiro delantero", 60],
      ["Cerrar tiro trasero con marquilla", 80],
      ["Cerrar costados y entre pierna", 250],
      ["Fijar bolsillo", 50],
      ["Unir pretina X2", 90],
      ["Unir elastico pretina", 40],
      ["Armar pretinas", 140],
      ["Acentar pretinas", 65],
      ["Pegar pretinas", 180],
      ["Hacer ruedos", 100],
      ["Unir y hacer tiras", 80],
    ],
  },
  {
    name: "Capri Dama",
    operations: [
      ["Embolsillar delantero completo", 320],
      ["Filetear bolsillo X 2", 75],
      ["Cerrar tiro delantero", 55],
      ["Cerrar tiro trasero con marquilla", 75],
      ["Cerrar costados y entre pierna", 220],
      ["Fijar bolsillo", 50],
      ["Unir pretina", 40],
      ["Unir elastico pretina", 35],
      ["Armar pretina", 120],
      ["Acentar pretinas", 60],
      ["Pegar pretinas", 150],
      ["Hacer ruedos dobles", 130],
      ["Unir y hacer tiras", 70],
    ],
  },
  {
    name: "Short Dama",
    operations: [
      ["Embolsillar delantero completo", 320],
      ["Filetear bolsillo X 2", 75],
      ["Cerrar tiro delantero", 55],
      ["Cerrar tiro trasero con marquilla", 75],
      ["Cerrar costados y entre pierna", 220],
      ["Fijar bolsillo", 50],
      ["Unir pretina", 40],
      ["Unir elastico pretina", 35],
      ["Armar pretina", 120],
      ["Acentar pretinas", 60],
      ["Pegar pretinas", 150],
      ["Hacer ruedos", 90],
      ["Unir y hacer tiras", 70],
    ],
  },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // --- Admin ---
    const adminUser = process.env.SEED_ADMIN_USER || "admin";
    const adminPass = process.env.SEED_ADMIN_PASSWORD || "cambiar123";
    const adminHash = await bcrypt.hash(adminPass, 10);
    await client.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1,$2,'admin')
       ON CONFLICT (username) DO NOTHING`,
      [adminUser, adminHash]
    );
    console.log(`Admin creado -> usuario: ${adminUser} / contraseña: ${adminPass}`);

    // --- Prendas y operaciones ---
    for (const g of GARMENTS) {
      const existing = await client.query(`SELECT id FROM garments WHERE name = $1`, [g.name]);
      let garmentId: string;
      if ((existing.rowCount ?? 0) > 0) {
        garmentId = existing.rows[0].id;
      } else {
        const res = await client.query(
          `INSERT INTO garments (name) VALUES ($1) RETURNING id`,
          [g.name]
        );
        garmentId = res.rows[0].id;
      }
      for (const [name, rate] of g.operations) {
        await client.query(
          `INSERT INTO operations (garment_id, name, rate) VALUES ($1,$2,$3)
           ON CONFLICT (garment_id, name) DO NOTHING`,
          [garmentId, name, rate]
        );
      }
      console.log(`Prenda cargada: ${g.name} (${g.operations.length} operaciones)`);
    }

    // --- Colaboradores de ejemplo (reemplázalos por los reales desde el panel admin) ---
    const demoEmployees = [
      { name: "Maria Restrepo", pin: "1111" },
      { name: "Luz Elena Zapata", pin: "2222" },
      { name: "Carlos Mario Velez", pin: "3333" },
      { name: "Diana Marcela Rios", pin: "4444" },
    ];
    for (const e of demoEmployees) {
      const exists = await client.query(`SELECT id FROM employees WHERE name = $1`, [e.name]);
      if ((exists.rowCount ?? 0) === 0) {
        const pinHash = await bcrypt.hash(e.pin, 10);
        await client.query(
          `INSERT INTO employees (name, pin_hash, active) VALUES ($1,$2,true)`,
          [e.name, pinHash]
        );
        console.log(`Colaborador de ejemplo creado: ${e.name} / PIN ${e.pin}`);
      }
    }

    await client.query("COMMIT");
    console.log("\nSeed completo.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
