import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const COOKIE_NAME = "taller_session";
const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "cambia-este-secreto-en-produccion"
);

export type SessionPayload = {
  sub: string; // id del usuario o colaborador
  role: "admin" | "employee" | "viewer" | "empaque";
  name: string;
};

/**
 * Crea la cookie de sesión firmada. El id y el rol quedan sellados dentro
 * del token: el navegador nunca puede "elegir" ser otra persona, porque
 * cualquier alteración del token invalida la firma.
 */
export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(SECRET);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * Lee y verifica la sesión actual. Esta es la ÚNICA fuente de verdad sobre
 * "quién soy" en el servidor — nunca se confía en un employeeId que venga
 * del formulario o del cliente.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      sub: payload.sub as string,
      role: payload.role as "admin" | "employee" | "viewer" | "empaque",
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    throw new Error("No autorizado: se requiere sesión de administrador.");
  }
  return session;
}

export async function requireEmployee(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || session.role !== "employee") {
    throw new Error("No autorizado: se requiere sesión de colaborador.");
  }
  return session;
}

export async function requireViewer(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || session.role !== "viewer") {
    throw new Error("No autorizado: se requiere sesión de usuario de consulta.");
  }
  return session;
}

export async function requireAdminOrViewer(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "viewer")) {
    throw new Error("No autorizado.");
  }
  return session;
}

export async function requirePackager(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || session.role !== "empaque") {
    throw new Error("No autorizado: se requiere sesión de empaque.");
  }
  return session;
}

export async function hashSecret(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifySecret(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
