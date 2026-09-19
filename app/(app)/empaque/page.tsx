import { getSession, requirePackager } from "@/lib/auth";
import { getOrdersForPackaging, getMyPackagingHistory } from "@/lib/actions/packaging";
import { PackagingClient } from "./PackagingClient";

export default async function PackagingPage() {
  await requirePackager();
  const session = await getSession();
  const [orders, history] = await Promise.all([getOrdersForPackaging(), getMyPackagingHistory()]);

  return <PackagingClient userName={session?.name || ""} orders={orders} initialHistory={history} />;
}
