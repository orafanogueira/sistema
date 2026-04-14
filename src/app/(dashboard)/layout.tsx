import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle();
  const { data: membership } = await supabase
    .from("memberships").select("tenant:tenants(name,slug)").eq("user_id", user.id).eq("is_active", true).maybeSingle();

  const tenantName = (membership?.tenant as { name?: string } | null)?.name || "Sem tenant";
  const userName = profile?.full_name || user.email?.split("@")[0] || "Usuario";

  return (
    <div className="min-h-screen">
      <Sidebar tenantName={tenantName} />
      <div className="pl-64">
        <Topbar userName={userName} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
