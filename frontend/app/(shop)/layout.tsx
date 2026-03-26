import ShopFooter from '@/components/shop/ShopFooter';
import ShopNavbar from '@/components/shop/ShopNavbar';
import RoleGate from '@/components/auth/RoleGate';
import AIAssistantWidget from '@/components/support/AIAssistantWidget';

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGate requiredRole="user">
      <div className="page-shell">
        <ShopNavbar />
        <main className="px-6 pb-16 pt-8">{children}</main>
        <ShopFooter />
        <AIAssistantWidget />
      </div>
    </RoleGate>
  );
}

