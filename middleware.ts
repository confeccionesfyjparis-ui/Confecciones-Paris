import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "cambia-este-secreto-en-produccion"
);
const COOKIE_NAME = "taller_session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;

  let role: string | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      role = payload.role as string;
    } catch {
      role = null;
    }
  }

  const isAdminRoute = pathname.startsWith("/admin");
  const isEmployeeRoute = pathname.startsWith("/employee");
  const isViewerRoute = pathname.startsWith("/consulta");

  if ((isAdminRoute || isEmployeeRoute || isViewerRoute) && !role) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isAdminRoute && role !== "admin") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isEmployeeRoute && role !== "employee") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isViewerRoute && role !== "viewer") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/employee/:path*", "/consulta/:path*"],
};
