import { listActiveEmployeesForLogin, listActiveViewersForLogin } from "@/lib/actions/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [employees, viewers] = await Promise.all([
    listActiveEmployeesForLogin(),
    listActiveViewersForLogin(),
  ]);
  return <LoginForm employees={employees} viewers={viewers} />;
}
