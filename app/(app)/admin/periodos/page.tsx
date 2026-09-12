import { getPeriods } from "@/lib/actions/periods";
import { getOpenPeriodDeductions } from "@/lib/actions/deductions";
import { getEmployees } from "@/lib/actions/employees";
import { PeriodsClient } from "./PeriodsClient";

export default async function PeriodsPage() {
  const [periods, deductions, employees] = await Promise.all([
    getPeriods(),
    getOpenPeriodDeductions(),
    getEmployees(),
  ]);
  return <PeriodsClient initialPeriods={periods} initialDeductions={deductions} employees={employees} />;
}
