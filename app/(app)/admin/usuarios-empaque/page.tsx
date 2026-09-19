import { getPackagerUsers } from "@/lib/actions/users";
import { getPackagingSummary } from "@/lib/actions/packaging";
import { PackagersClient } from "./PackagersClient";

export default async function PackagersPage() {
  const [users, summary] = await Promise.all([getPackagerUsers(), getPackagingSummary()]);
  return <PackagersClient initialUsers={users} summary={summary} />;
}
