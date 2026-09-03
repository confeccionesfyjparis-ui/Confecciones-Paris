import { getOrdersWithOperations } from "@/lib/actions/orders";
import { getGarments } from "@/lib/actions/garments";
import { OrdersClient } from "./OrdersClient";

export default async function OrdersPage() {
  const [orders, garments] = await Promise.all([getOrdersWithOperations(), getGarments()]);
  return <OrdersClient initialOrders={orders} garments={garments} />;
}
