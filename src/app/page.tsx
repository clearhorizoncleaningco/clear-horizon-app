import { redirect } from "next/navigation";

// Root simply routes into the app. The proxy sends unauthenticated users to
// /login before this renders; authenticated users land on the dashboard.
export default function Home() {
  redirect("/dashboard");
}
