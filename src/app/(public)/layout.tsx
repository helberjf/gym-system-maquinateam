import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { StickyPublicCta } from '@/components/public/StickyPublicCta';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 overflow-x-clip pt-16 sm:pt-18">{children}</main>
      <Footer />
      <StickyPublicCta />
    </div>
  );
}
