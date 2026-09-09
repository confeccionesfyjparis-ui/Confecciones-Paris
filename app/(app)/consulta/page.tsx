import { getSession, requireViewer } from "@/lib/auth";
import { getOrdersWithOperations } from "@/lib/actions/orders";
import { getInventoryAlerts } from "@/lib/actions/dashboard";
import { logout } from "@/lib/actions/auth";
import { ConsultaClient } from "./ConsultaClient";

export default async function ConsultaPage() {
  await requireViewer();
  const session = await getSession();
  const [orders, alerts] = await Promise.all([getOrdersWithOperations(), getInventoryAlerts()]);

  return <ConsultaClient userName={session?.name || ""} orders={orders} alerts={alerts} />;
}
