import { getSettlements } from "@/lib/actions/settlements";
import { SettlementsClient } from "./SettlementsClient";

export default async function SettlementsPage() {
  const settlements = await getSettlements();
  return <SettlementsClient initialSettlements={settlements} />;
}
