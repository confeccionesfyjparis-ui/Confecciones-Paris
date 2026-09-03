import { getGarments } from "@/lib/actions/garments";
import { RatesClient } from "./RatesClient";

export default async function RatesPage() {
  const garments = await getGarments();
  return <RatesClient initialGarments={garments} />;
}
