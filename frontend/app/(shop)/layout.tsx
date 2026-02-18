import { StoreProvider } from '@/store/StoreContext';
import ShopFooter from '@/components/shop/ShopFooter';
import ShopNavbar from '@/components/shop/ShopNavbar';

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StoreProvider>
      <div className="page-shell">
        <ShopNavbar />
        <main className="px-6 pb-16 pt-8">{children}</main>
        <ShopFooter />
      </div>
    </StoreProvider>
  );
}
