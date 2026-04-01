import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { BRAND } from "@/lib/constants/brand";
import { getOptionalSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";
import { StoreCartLink } from "@/components/store/StoreCartLink";
import { StoreWishlistLink } from "@/components/store/StoreWishlistLink";

export async function Navbar() {
  const session = await getOptionalSession();
  const isAuthenticated = Boolean(session?.user?.id);

  const links = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Produtos" },
    { href: "/planos", label: "Planos" },
    { href: "/contato", label: "Contato" },
    { href: "/faq", label: "FAQ" },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-brand-gray-mid bg-brand-black/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-18 sm:gap-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <Image
            src="/images/logo.jpg"
            alt={`${BRAND.name} logo`}
            width={46}
            height={46}
            className="size-10 shrink-0 rounded-full border border-brand-gray-mid object-cover sm:size-[46px]"
          />
          <div className="min-w-0">
            <span className="block truncate text-base font-bold uppercase tracking-[0.12em] text-white sm:text-xl sm:tracking-[0.14em]">
              {BRAND.name}
            </span>
            <span className="block truncate text-[10px] uppercase tracking-[0.18em] text-brand-gray-light sm:text-[11px] sm:tracking-[0.24em]">
              Premium fight club
            </span>
          </div>
        </Link>

        <ul className="hidden items-center gap-6 lg:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm font-medium text-brand-gray-light hover:text-white"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <StoreWishlistLink />
          </li>
          <li>
            <StoreCartLink />
          </li>
        </ul>

        <div className="hidden items-center gap-3 lg:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href={isAuthenticated ? "/dashboard" : "/login"}>
              {isAuthenticated ? "Dashboard" : "Login"}
            </Link>
          </Button>
          {!isAuthenticated ? (
            <Button asChild size="sm">
              <Link href="/cadastro">Cadastrar</Link>
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <StoreWishlistLink mobile />
          <StoreCartLink mobile />
          <details className="group relative">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-brand-gray-mid bg-brand-gray-dark text-white sm:h-11 sm:w-11">
              <Menu className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 mt-3 w-[min(18rem,calc(100vw-2rem))] rounded-3xl border border-brand-gray-mid bg-brand-black/95 p-4 shadow-2xl">
              <div className="space-y-2">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block rounded-2xl border border-transparent px-4 py-3 text-sm text-brand-gray-light hover:border-brand-gray-mid hover:bg-brand-gray-dark hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <Link
                  href={isAuthenticated ? "/dashboard" : "/login"}
                  className="rounded-2xl border border-brand-gray-mid px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  {isAuthenticated ? "Abrir dashboard" : "Entrar"}
                </Link>
                {!isAuthenticated ? (
                  <Link
                    href="/cadastro"
                    className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-black"
                  >
                    Criar conta
                  </Link>
                ) : null}
              </div>
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
