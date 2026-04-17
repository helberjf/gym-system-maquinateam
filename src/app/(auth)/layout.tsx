import Link from "next/link";
import Image from "next/image";
import { BRAND } from "@/lib/constants/brand";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_24%),linear-gradient(180deg,#090909_0%,#050505_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.03),transparent_32%,transparent_68%,rgba(255,255,255,0.025))]" />

      <header className="relative border-b border-brand-gray-mid bg-brand-black/75 px-4 py-4 backdrop-blur-xl sm:px-6">
        <Link href="/" className="flex w-fit items-center gap-2.5 sm:gap-3">
          <Image
            src="/images/logo.jpg"
            alt={BRAND.name}
            width={40}
            height={40}
            className="size-9 shrink-0 rounded-full border border-brand-gray-mid object-cover sm:size-10"
          />
          <div>
            <span className="block text-xs font-bold uppercase tracking-[0.14em] text-white sm:text-sm sm:tracking-[0.18em]">
              {BRAND.name}
            </span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-brand-gray-light sm:text-[11px] sm:tracking-[0.24em]">
              Acesso seguro
            </span>
          </div>
        </Link>
      </header>

      <main className="relative flex flex-1 items-start justify-center px-4 py-8 sm:px-6 sm:py-10 lg:items-center">
        {children}
      </main>

      <footer className="relative py-4 text-center text-xs text-brand-gray-light">
        &copy; {new Date().getFullYear()} {BRAND.name}
      </footer>
    </div>
  );
}
