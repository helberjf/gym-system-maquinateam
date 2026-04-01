import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PublicPlanCard } from "@/components/public/PublicPlanCard";
import { SectionHeading } from "@/components/public/SectionHeading";
import type { PublicPlanCatalogItem } from "@/lib/billing/public";
import { BRAND } from "@/lib/constants/brand";

const stats = [
  { label: "Modalidades", value: String(BRAND.modalities.length) },
  { label: "Horario", value: "08h - 22h" },
  { label: "Cidade", value: "JF - MG" },
  { label: "Foco", value: "Performance" },
];

type HomeLandingPageProps = {
  featuredPlans: PublicPlanCatalogItem[];
  isAuthenticated: boolean;
};

export function HomeLandingPage({
  featuredPlans,
  isAuthenticated,
}: HomeLandingPageProps) {
  return (
    <div className="bg-brand-black">
      <section className="relative overflow-hidden border-b border-brand-gray-mid">
        <div className="absolute inset-0">
          <Image
            src="/images/fachada.webp"
            alt={BRAND.name}
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-25 grayscale"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0.55),#050505)]" />
        </div>

        <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-7xl items-center gap-8 px-4 py-12 sm:min-h-[calc(100vh-4.5rem)] sm:gap-10 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.34em] text-brand-gray-light">
              Academia de luta premium
            </p>
            <h1 className="mt-5 max-w-4xl text-[clamp(3.25rem,14vw,4.75rem)] font-bold uppercase leading-[0.9] text-white sm:text-7xl lg:text-8xl">
              {BRAND.name}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-brand-gray-light sm:text-lg sm:leading-8">
              {BRAND.slogan} Boxe, muay thai, kickboxing e funcional em um
              ambiente forte, clean e pronto para quem quer evolucao de verdade.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/cadastro">Criar conta</Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
                <Link href="/planos">Ver planos</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto">
                <a
                  href={BRAND.contact.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              </Button>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-brand-gray-mid bg-brand-black/60 p-4 backdrop-blur"
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-brand-gray-light">
                    {item.label}
                  </p>
                  <p className="mt-3 text-2xl font-bold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto grid w-full max-w-sm gap-4 sm:max-w-md lg:max-w-none">
            <div className="overflow-hidden rounded-[1.75rem] border border-brand-gray-mid bg-brand-gray-dark shadow-2xl sm:rounded-[2rem]">
              <div className="relative aspect-[5/4] sm:aspect-[4/5]">
                <Image
                  src="/images/instrutor.jpg"
                  alt={BRAND.instructor}
                  fill
                  sizes="(min-width: 1024px) 34vw, (min-width: 640px) 28rem, calc(100vw - 2rem)"
                  className="object-cover grayscale"
                />
              </div>
              <div className="border-t border-brand-gray-mid p-5 sm:p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-brand-gray-light">
                  Lideranca tecnica
                </p>
                <h2 className="mt-3 text-2xl font-bold uppercase text-white sm:text-3xl">
                  {BRAND.instructor}
                </h2>
                <p className="mt-3 text-sm leading-6 text-brand-gray-light">
                  Base tecnica, disciplina de treino e uma experiencia de
                  academia voltada para constancia, resultado e alto padrao.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Diferenciais"
          title="Treino com identidade"
          description="A Maquina Team combina tecnica, disciplina e ambiente premium. O resultado e uma academia enxuta, forte e focada no que realmente importa: evolucao consistente."
        />

        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {BRAND.highlights.map((item) => (
            <article
              key={item}
              className="rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-5 sm:p-6"
            >
              <p className="text-sm uppercase tracking-[0.24em] text-brand-gray-light">
                destaque
              </p>
              <p className="mt-4 text-xl font-bold uppercase text-white sm:text-2xl">{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-brand-gray-mid bg-brand-gray-dark/60">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 sm:gap-10 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:px-8">
          <div className="mx-auto w-full max-w-xl overflow-hidden rounded-[2rem] border border-brand-gray-mid lg:max-w-none">
            <div className="relative aspect-[5/4] sm:aspect-[4/3]">
              <Image
                src="/images/interior.webp"
                alt="Interior da academia"
                fill
                sizes="(min-width: 1024px) 38vw, (min-width: 640px) 80vw, calc(100vw - 2rem)"
                className="object-cover grayscale"
              />
            </div>
          </div>

          <div>
            <SectionHeading
              eyebrow="Modalidades"
              title="Rotina completa para luta"
              description="Do primeiro treino ao ritmo de atleta, a grade foi pensada para encaixar tecnica, cardio, forca e consistencia."
            />

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {BRAND.modalities.map((modality) => (
                <div
                  key={modality}
                  className="rounded-[2rem] border border-brand-gray-mid bg-brand-black/50 p-5"
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-brand-gray-light">
                    modalidade
                  </p>
                  <p className="mt-3 text-2xl font-bold uppercase text-white sm:text-3xl">
                    {modality}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="w-full sm:w-auto">
                <Link href="/planos">Escolher plano</Link>
              </Button>
              <Button asChild variant="secondary" className="w-full sm:w-auto">
                <Link href="/contato">Falar com a academia</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <SectionHeading
            eyebrow="Planos"
            title="Escolha o ritmo"
            description="Planos claros, premium e diretos. Entre pelo nivel de frequencia que cabe na sua rotina hoje."
          />
          <Button asChild variant="secondary" className="hidden sm:inline-flex">
            <Link href="/planos">Ver tabela completa</Link>
          </Button>
        </div>

        {featuredPlans.length === 0 ? (
          <div className="mt-10 rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-6">
            <p className="text-sm text-brand-gray-light">
              Os planos publicos estao sendo sincronizados. Enquanto isso, a equipe
              comercial segue atendendo rapido pelo WhatsApp.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 xl:grid-cols-3">
            {featuredPlans.map((plan) => (
              <PublicPlanCard
                key={plan.id}
                plan={plan}
                isAuthenticated={isAuthenticated}
                callbackUrl="/planos"
              />
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-brand-gray-mid bg-brand-gray-dark/60">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Prova social"
            title="Quem treina sente a diferenca"
            description="Feedback real de quem ja entrou na rotina da Maquina Team."
            align="center"
          />

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {BRAND.reviews.map((review) => (
              <article
                key={review.author}
                className="rounded-[2rem] border border-brand-gray-mid bg-brand-black/50 p-6"
              >
                <p className="text-base leading-7 text-brand-gray-light">
                  "{review.text}"
                </p>
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                    {review.author}
                  </p>
                  <p className="text-xs uppercase tracking-[0.24em] text-brand-gray-light">
                    {review.rating}/5
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-[2.5rem] border border-brand-gray-mid bg-white px-6 py-10 text-black shadow-[0_20px_80px_rgba(255,255,255,0.06)] sm:px-10">
          <p className="text-xs uppercase tracking-[0.32em] text-black/55">
            Entre agora
          </p>
          <h2 className="mt-4 text-4xl font-bold uppercase leading-none sm:text-5xl">
            Site publico e sistema conectados
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-black/70 sm:text-base">
            Conheca a academia, fale com a equipe, crie sua conta, acompanhe
            treinos, pagamentos, presenca e toda a jornada dentro do sistema.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
              <Link href="/cadastro">Criar conta</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto">
              <a
                href={BRAND.contact.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
