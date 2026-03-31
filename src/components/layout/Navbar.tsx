import Link from 'next/link';
import Image from 'next/image';
import { BRAND } from '@/lib/constants/brand';

const navLinks = [
  { href: '/home', label: 'Início' },
  { href: '/home#planos', label: 'Planos' },
  { href: '/home#contatos', label: 'Contatos' },
  { href: '/faq', label: 'FAQ' },
  { href: '/login', label: 'Área do Aluno' },
];

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-brand-black/90 backdrop-blur-sm border-b border-brand-gray-mid">
      <nav className="container mx-auto flex items-center justify-between h-16 px-4">
        {/* Logo + Brand */}
        <Link href="/home" className="flex items-center gap-3">
          <Image
            src="/images/logo.jpg"
            alt={`${BRAND.name} logo`}
            width={44}
            height={44}
            className="rounded-full object-cover"
          />
          <div className="hidden sm:block">
            <span className="block font-bold text-brand-white leading-tight">
              {BRAND.name}
            </span>
            <span className="block text-xs text-brand-red leading-tight">
              {BRAND.slogan}
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-brand-gray-light hover:text-brand-white transition-colors"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Link
          href="/cadastro"
          className="hidden md:inline-flex items-center px-4 py-2 rounded-lg bg-brand-red hover:bg-brand-red-dark text-white text-sm font-medium transition-colors"
        >
          Matricule-se
        </Link>

        {/* TODO: Fase 2 — menu mobile (hamburger) */}
      </nav>
    </header>
  );
}
