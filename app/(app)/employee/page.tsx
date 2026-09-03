import { getSession } from "@/lib/auth";
import { getMyOpenOrders, getMyProductionThisPeriod } from "@/lib/actions/production";
import { getOpenPeriod } from "@/lib/actions/periods";
import { EmployeeApp } from "./EmployeeApp";

export default async function EmployeePage() {
  const session = await getSession();
  const [orders, myRecords, period] = await Promise.all([
    getMyOpenOrders(),
    getMyProductionThisPeriod(),
    getOpenPeriod(),
  ]);

  return (
    <EmployeeApp
      employeeName={session?.name || ""}
      orders={orders}
      initialRecords={myRecords}
      period={period}
    />
  );
}
