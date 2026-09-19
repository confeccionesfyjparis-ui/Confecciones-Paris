import { listActiveEmployeesForLogin, listActiveViewersForLogin, listActivePackagersForLogin } from "@/lib/actions/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [employees, viewers, packagers] = await Promise.all([
    listActiveEmployeesForLogin(),
    listActiveViewersForLogin(),
    listActivePackagersForLogin(),
  ]);
  return <LoginForm employees={employees} viewers={viewers} packagers={packagers} />;
}
