import { getSettlements } from "@/lib/actions/settlements";
import { getEmployees } from "@/lib/actions/employees";
import { getPeriods, getOpenPeriod } from "@/lib/actions/periods";
import { getOpenPeriodNovedades } from "@/lib/actions/deductions";
import { SettlementsClient } from "./SettlementsClient";

export default async function SettlementsPage() {
  const [settlements, employees, periods, openPeriod, openNovedades] = await Promise.all([
    getSettlements(),
    getEmployees(),
    getPeriods(),
    getOpenPeriod(),
    getOpenPeriodNovedades(),
  ]);
  return (
    <SettlementsClient
      initialSettlements={settlements}
      employees={employees}
      periods={periods}
      openPeriod={openPeriod}
      initialOpenNovedades={openNovedades}
    />
  );
}
