import Link from "next/link";
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
  },
  {
    label: "Instagram",
    value: BRAND.contact.instagram,
    href: BRAND.contact.instagramUrl,
    action: "Abrir perfil",
  },
  {
    label: "E-mail",
    value: BRAND.contact.email,
    href: `mailto:${BRAND.contact.email}`,
    action: "Enviar e-mail",
  },
  {
    label: "Endereco",
    value: BRAND.address.full,
    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BRAND.address.full)}`,
    action: "Abrir mapa",
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
                  className="rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-6"
                >
                  <p className="text-xs uppercase tracking-[0.3em] text-brand-gray-light">
                    {item.label}
                  </p>
                  <p className="mt-4 text-xl font-bold uppercase text-white">
                    {item.value}
                  </p>
                  <p className="mt-4 text-sm text-brand-gray-light">{item.action}</p>
                </a>
              ))}
            </div>
          </div>

          <section className="rounded-[2.5rem] border border-brand-gray-mid bg-white p-8 text-black shadow-[0_20px_80px_rgba(255,255,255,0.06)]">
            <p className="text-xs uppercase tracking-[0.3em] text-black/55">
              Atendimento
            </p>
            <h2 className="mt-4 text-5xl font-bold uppercase leading-none">
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
              <Button asChild size="lg">
                <a href={BRAND.contact.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  Falar no WhatsApp
                </a>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/cadastro">Criar conta</Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
