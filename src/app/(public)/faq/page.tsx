import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/public/SectionHeading";
import { BRAND } from "@/lib/constants/brand";
import { absoluteUrl, buildPublicMetadata, serializeJsonLd } from "@/lib/seo";

export const metadata = buildPublicMetadata({
  title: "FAQ",
  description:
    "Perguntas frequentes sobre treinos, matricula, planos, horarios e rotina da Maquina Team.",
  path: "/faq",
  keywords: [
    "perguntas frequentes academia",
    "faq academia de luta",
    "horarios de treino",
    "matricula academia",
  ],
});

const faqCategories = [
  {
    title: "Sobre a academia",
    items: [
      {
        question: "Quais modalidades a academia oferece?",
        answer: `Hoje a academia trabalha com ${BRAND.modalities.join(", ")} dentro de uma rotina pensada para evolucao tecnica e condicionamento.`,
      },
      {
        question: "A Maquina Team serve para iniciantes?",
        answer:
          "Sim. O ambiente foi estruturado para receber tanto quem esta começando quanto quem ja treina com mais ritmo e experiencia.",
      },
      {
        question: "Quem conduz a parte tecnica?",
        answer: `${BRAND.instructor} lidera a identidade tecnica da academia e a construcao da rotina de treino.`,
      },
    ],
  },
  {
    title: "Planos e matricula",
    items: [
      {
        question: "Como faco minha matricula?",
        answer:
          "Voce pode falar com a equipe pelo WhatsApp, visitar a unidade ou criar sua conta e seguir com a orientacao comercial pelo sistema.",
      },
      {
        question: "Quais formas de pagamento sao aceitas?",
        answer:
          "A operacao suporta pix, dinheiro, cartao, transferencia e outros metodos cadastrados no sistema.",
      },
      {
        question: "Posso cancelar ou trocar meu plano?",
        answer:
          "Sim. O fluxo depende do plano contratado e da etapa da assinatura. A equipe consegue orientar o melhor caminho.",
      },
    ],
  },
  {
    title: "Treino e rotina",
    items: [
      {
        question: "Qual e o horario de funcionamento?",
        answer: BRAND.hours.label,
      },
      {
        question: "Preciso ter equipamento para comecar?",
        answer:
          "Nas primeiras aulas o foco e entrar na rotina. Depois disso a equipe orienta o que faz sentido adquirir para sua modalidade.",
      },
      {
        question: "Existe acompanhamento pelo sistema?",
        answer:
          "Sim. O aluno pode acompanhar presenca, plano, pagamentos, treinos atribuidos e avisos pelo painel privado.",
      },
    ],
  },
];

export default function FaqPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqCategories.flatMap((category) =>
      category.items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    ),
    url: absoluteUrl("/faq"),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(faqSchema),
        }}
      />
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="FAQ"
          title="Perguntas frequentes"
          description="As respostas abaixo cobrem as duvidas mais comuns sobre matricula, planos, rotina e funcionamento da academia."
          align="center"
        />

        <div className="mx-auto mt-12 max-w-4xl space-y-8">
          {faqCategories.map((category) => (
            <section
              key={category.title}
              className="rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-6"
            >
              <h2 className="text-3xl font-bold uppercase text-white">
                {category.title}
              </h2>
              <div className="mt-6 space-y-4">
                {category.items.map((item) => (
                  <details
                    key={item.question}
                    className="group rounded-[1.5rem] border border-brand-gray-mid bg-brand-black/50 p-5"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold uppercase text-white">
                      <span>{item.question}</span>
                      <span className="text-brand-gray-light transition group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="pt-4 text-sm leading-7 text-brand-gray-light">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-12 rounded-[2rem] border border-brand-gray-mid bg-white px-6 py-8 text-black sm:px-8">
          <p className="text-xs uppercase tracking-[0.3em] text-black/55">
            Ainda com duvida?
          </p>
          <h2 className="mt-3 text-4xl font-bold uppercase">Fale com a equipe</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-black/70">
            Se quiser ajuda para escolher plano, confirmar horarios ou entender a
            experiencia da academia, a equipe responde rapido pelo WhatsApp.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <a href={BRAND.contact.whatsappUrl} target="_blank" rel="noopener noreferrer">
                Abrir WhatsApp
              </a>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/contato">Ir para contato</Link>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
