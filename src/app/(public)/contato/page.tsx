import Link from "next/link";
import {
  AtSign,
  ArrowUpRight,
  Mail,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/public/SectionHeading";
import { BRAND } from "@/lib/constants/brand";
import { absoluteUrl, buildPublicMetadata, serializeJsonLd } from "@/lib/seo";

export const metadata = buildPublicMetadata({
  title: "Contato",
  description:
    "Entre em contato com a Maquina Team por WhatsApp, Instagram, e-mail ou presencialmente em Juiz de Fora.",
  path: "/contato",
  keywords: [
    "contato academia",
    "whatsapp academia",
    "academia em juiz de fora",
    "endereco maquina team",
  ],
});

const contactCards = [
  {
    label: "WhatsApp",
    value: BRAND.contact.phone,
    href: BRAND.contact.whatsappUrl,
    action: "Chamar agora",
    icon: MessageCircle,
    compact: false,
  },
  {
    label: "Instagram",
    value: BRAND.contact.instagram,
    href: BRAND.contact.instagramUrl,
    action: "Abrir perfil",
    icon: AtSign,
    compact: false,
  },
  {
    label: "E-mail",
    value: BRAND.contact.email,
    href: `mailto:${BRAND.contact.email}`,
    action: "Enviar e-mail",
    icon: Mail,
    compact: true,
  },
  {
    label: "Endereco",
    value: BRAND.address.full,
    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BRAND.address.full)}`,
    action: "Abrir mapa",
    icon: MapPin,
    compact: true,
  },
];

export default function ContatoPage() {
  const contactSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: `Contato ${BRAND.name}`,
    url: absoluteUrl("/contato"),
    mainEntity: {
      "@type": "HealthClub",
      name: BRAND.name,
      telephone: BRAND.contact.phone,
      email: BRAND.contact.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: BRAND.address.street,
        addressLocality: "Juiz de Fora",
        addressRegion: "MG",
        postalCode: BRAND.address.cep,
        addressCountry: "BR",
      },
      sameAs: [BRAND.contact.instagramUrl],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(contactSchema),
        }}
      />
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid items-start gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <SectionHeading
              eyebrow="Contato"
              title="Fale com a equipe"
              description="Se voce quer visitar a unidade, entender qual plano faz sentido ou conhecer a rotina da academia, os canais abaixo levam voce direto para a equipe."
            />

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {contactCards.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full min-w-0 flex-col rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-6 transition hover:-translate-y-1 hover:border-white/20 hover:bg-[#171717]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.3em] text-brand-gray-light">
                        {item.label}
                      </p>
                      <p
                        className={[
                          "mt-4 min-w-0 break-words font-bold leading-tight text-white",
                          item.compact
                            ? "text-base normal-case sm:text-lg"
                            : "text-lg uppercase sm:text-xl",
                        ].join(" ")}
                      >
                        {item.value}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-white/80 transition group-hover:text-white">
                      <item.icon className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-auto pt-6">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-white">
                      {item.action}
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <section className="rounded-[2.5rem] border border-brand-gray-mid bg-white p-6 text-black shadow-[0_20px_80px_rgba(255,255,255,0.06)] sm:p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-black/55">
              Atendimento
            </p>
            <h2 className="mt-4 text-4xl font-bold uppercase leading-none sm:text-5xl">
              Venha conhecer a academia
            </h2>
            <div className="mt-8 space-y-5 text-sm leading-7 text-black/70">
              <p>
                Endereco: <strong>{BRAND.address.full}</strong>
              </p>
              <p>
                Horario: <strong>{BRAND.hours.label}</strong>
              </p>
              <p>
                Modalidades: <strong>{BRAND.modalities.join(", ")}</strong>
              </p>
              <p>
                Atendimento comercial e recepcao integrados ao sistema para
                cadastro, pagamentos, planos e acompanhamento do aluno.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="w-full bg-black text-white hover:bg-black/90 sm:w-auto"
              >
                <a href={BRAND.contact.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  Falar no WhatsApp
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline-dark"
                className="w-full sm:w-auto"
              >
                <Link href="/cadastro">Criar conta</Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
