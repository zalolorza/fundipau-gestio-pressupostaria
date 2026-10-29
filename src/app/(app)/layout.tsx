import { AgentProvider } from "@/components/agent/agent-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { isAdminRole, requireSession } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "17rem" } as React.CSSProperties}
    >
      <AgentProvider>
        <AppSidebar
          user={{
            name: session.user.name,
            email: session.user.email,
            isAdmin: isAdminRole(session.user.role),
          }}
        />
        <SidebarInset>{children}</SidebarInset>
      </AgentProvider>
    </SidebarProvider>
  );
}
