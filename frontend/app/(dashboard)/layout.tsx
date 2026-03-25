import RoleGate from '@/components/auth/RoleGate';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import DashboardTopbar from '@/components/dashboard/DashboardTopbar';
import AIAssistantWidget from '@/components/support/AIAssistantWidget';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGate requiredRole="admin">
      <div className="min-h-screen flex bg-canvas">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardTopbar />
          <main className="flex-1 px-6 pb-12 pt-6">{children}</main>
        </div>
        <AIAssistantWidget />
      </div>
    </RoleGate>
  );
}

