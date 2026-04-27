import Link from "next/link";
import Image from "next/image";
import { BRAND } from "@/lib/constants/brand";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-brand-gray-mid bg-brand-black">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3 sm:gap-4">
              <Image
                src="/images/logo.jpg"
                alt={BRAND.name}
                width={52}
                height={52}
                className="size-11 shrink-0 rounded-full border border-brand-gray-mid object-cover sm:size-[52px]"
              />
              <div>
                <p className="text-lg font-bold uppercase tracking-[0.12em] text-white sm:text-xl sm:tracking-[0.14em]">
                  {BRAND.name}
                </p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-brand-gray-light sm:text-xs sm:tracking-[0.24em]">
                  Fight club
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-md text-sm text-brand-gray-light">
              {BRAND.slogan} Estrutura focada em tecnica, condicionamento e uma
              experiencia premium em preto e branco.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white">
              Navegacao
            </h2>
            <div className="mt-4 space-y-3 text-sm text-brand-gray-light">
              <Link href="/" className="block hover:text-white">
                Home
              </Link>
              <Link href="/products" className="block hover:text-white">
                Produtos
              </Link>
              <Link href="/planos" className="block hover:text-white">
                Planos
              </Link>
              <Link href="/blog" className="block hover:text-white">
                Blog
              </Link>
              <Link href="/contato" className="block hover:text-white">
                Contato
              </Link>
              <Link href="/faq" className="block hover:text-white">
                FAQ
              </Link>
              <Link href="/politica-de-privacidade" className="block hover:text-white">
                Politica de Privacidade
              </Link>
              <Link href="/termos-de-uso" className="block hover:text-white">
                Termos de Uso
              </Link>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white">
              Acesso
            </h2>
            <div className="mt-4 space-y-3 text-sm text-brand-gray-light">
              <Link href="/login" className="block hover:text-white">
                Login
              </Link>
              <Link href="/cadastro" className="block hover:text-white">
                Cadastro
              </Link>
              <Link href="/dashboard" className="block hover:text-white">
                Dashboard
              </Link>
              <Link href="/carrinho" className="block hover:text-white">
                Carrinho
              </Link>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white">
              Contato
            </h2>
            <div className="mt-4 space-y-3 text-sm text-brand-gray-light">
              <p>{BRAND.contact.phone}</p>
              <p>{BRAND.contact.email}</p>
              <a
                href={BRAND.contact.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-white"
              >
                {BRAND.contact.instagram}
              </a>
              <a
                href={BRAND.contact.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-white"
              >
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-brand-gray-mid pt-6 text-xs text-brand-gray-light md:flex-row md:items-center md:justify-between">
          <p>
            {new Date().getFullYear()} {BRAND.name}. Todos os direitos reservados.
          </p>
          <div className="flex flex-col gap-2 md:items-end">
            <p>
              {BRAND.address.full} - {BRAND.hours.label}
            </p>
            <Link href="/politica-de-privacidade" className="hover:text-white">
              Politica de Privacidade
            </Link>
            <span className="mx-1 text-brand-gray-mid">|</span>
            <Link href="/termos-de-uso" className="hover:text-white">
              Termos de Uso
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
