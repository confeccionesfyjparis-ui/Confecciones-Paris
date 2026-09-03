import { listActiveEmployeesForLogin } from "@/lib/actions/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const employees = await listActiveEmployeesForLogin();
  return <LoginForm employees={employees} />;
}
