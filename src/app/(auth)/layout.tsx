import Link from "next/link";
import Image from "next/image";
import { BRAND } from "@/lib/constants/brand";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-black">
      <header className="border-b border-brand-gray-mid bg-brand-black/85 px-4 py-4 backdrop-blur sm:px-6">
        <Link href="/home" className="flex w-fit items-center gap-2.5 sm:gap-3">
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

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </main>

      <footer className="py-4 text-center text-xs text-brand-gray-light">
        &copy; {new Date().getFullYear()} {BRAND.name}
      </footer>
    </div>
  );
}
