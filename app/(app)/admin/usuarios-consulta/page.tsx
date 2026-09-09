import { getViewerUsers } from "@/lib/actions/users";
import { ViewersClient } from "./ViewersClient";

export default async function ViewersPage() {
  const users = await getViewerUsers();
  return <ViewersClient initialUsers={users} />;
}
