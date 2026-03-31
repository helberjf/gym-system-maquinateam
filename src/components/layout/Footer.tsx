import Link from 'next/link';
import Image from 'next/image';
import { BRAND } from '@/lib/constants/brand';

export function Footer() {
  return (
    <footer className="bg-brand-gray-dark border-t border-brand-gray-mid mt-auto">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Image
                src="/images/logo.jpg"
                alt={BRAND.name}
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
              <span className="font-bold text-brand-white">{BRAND.name}</span>
            </div>
            <p className="text-sm text-brand-gray-light">{BRAND.slogan}</p>
            <p className="text-xs text-brand-gray-light mt-2">
              {BRAND.modalities.join(' · ')}
            </p>
          </div>

          {/* Contato */}
          <div>
            <h4 className="text-sm font-semibold text-brand-white mb-3">
              Contato
            </h4>
            <ul className="space-y-1 text-sm text-brand-gray-light">
              <li>{BRAND.contact.phone}</li>
              <li>{BRAND.contact.email}</li>
              <li>
                <a
                  href={BRAND.contact.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-red"
                >
                  {BRAND.contact.instagram}
                </a>
              </li>
            </ul>
          </div>

          {/* Endereço */}
          <div>
            <h4 className="text-sm font-semibold text-brand-white mb-3">
              Endereço
            </h4>
            <address className="not-italic text-sm text-brand-gray-light">
              <p>{BRAND.address.street}</p>
              <p>{BRAND.address.city}, {BRAND.address.cep}</p>
              <p className="mt-1">{BRAND.hours.label}</p>
            </address>
          </div>
        </div>

        <div className="border-t border-brand-gray-mid mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-brand-gray-light">
          <p>© {new Date().getFullYear()} {BRAND.name}. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <Link href="/home" className="hover:text-brand-white">Início</Link>
            <Link href="/faq" className="hover:text-brand-white">FAQ</Link>
            <Link href="/login" className="hover:text-brand-white">Login</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
