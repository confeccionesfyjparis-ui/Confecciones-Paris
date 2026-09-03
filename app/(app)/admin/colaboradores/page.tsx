import { getEmployees } from "@/lib/actions/employees";
import { EmployeesClient } from "./EmployeesClient";

export default async function EmployeesPage() {
  const employees = await getEmployees();
  return <EmployeesClient initialEmployees={employees} />;
}
