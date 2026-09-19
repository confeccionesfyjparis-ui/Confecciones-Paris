import { getSettlements } from "@/lib/actions/settlements";
import { getEmployees } from "@/lib/actions/employees";
import { getPeriods } from "@/lib/actions/periods";
import { SettlementsClient } from "./SettlementsClient";

export default async function SettlementsPage() {
  const [settlements, employees, periods] = await Promise.all([
    getSettlements(),
    getEmployees(),
    getPeriods(),
  ]);
  return <SettlementsClient initialSettlements={settlements} employees={employees} periods={periods} />;
}
