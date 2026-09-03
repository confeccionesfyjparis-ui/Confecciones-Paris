import { getPeriods } from "@/lib/actions/periods";
import { PeriodsClient } from "./PeriodsClient";

export default async function PeriodsPage() {
  const periods = await getPeriods();
  return <PeriodsClient initialPeriods={periods} />;
}
