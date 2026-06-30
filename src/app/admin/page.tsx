import dynamic from "next/dynamic";

// Disable SSR for the admin dashboard so browser-extension attribute
// injection (bis_skin_checked, etc.) never causes a hydration mismatch.
const AdminDashboard = dynamic(() => import("./AdminDashboard"), { ssr: false });

export default function AdminPage() {
  return <AdminDashboard />;
}
