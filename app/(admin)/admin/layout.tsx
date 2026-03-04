import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--base)" }}
    >
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader session={session} />
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ background: "var(--base)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
