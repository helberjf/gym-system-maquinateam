import { absoluteUrl } from "@/lib/seo";

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  image: string;
  keywords: string[];
  sections: Array<{
    heading: string;
    body: string;
  }>;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "como-escolher-plano-de-luta",
    title: "Como escolher o melhor plano de luta para sua rotina",
    description:
      "Guia objetivo para comparar frequencia, objetivo fisico e modalidade antes de escolher um plano de academia de luta.",
    category: "Planos",
    publishedAt: "2026-04-24",
    updatedAt: "2026-04-24",
    readingMinutes: 4,
    image: "/images/interior.webp",
    keywords: ["planos de luta", "academia de luta", "muay thai", "boxe"],
    sections: [
      {
        heading: "Comece pelo objetivo",
        body:
          "Quem busca condicionamento precisa de uma frequencia diferente de quem quer competir. Defina se o foco e aprender tecnica, melhorar cardio, ganhar disciplina ou voltar a treinar com acompanhamento.",
      },
      {
        heading: "Compare frequencia real",
        body:
          "Um plano so funciona quando cabe na agenda. Duas ou tres aulas por semana costumam ser suficientes para evoluir sem sacrificar recuperacao, trabalho e estudos.",
      },
      {
        heading: "Considere suporte e comunidade",
        body:
          "A melhor escolha combina professores atentos, turmas bem organizadas e um ambiente em que o aluno se sente seguro para evoluir de forma consistente.",
      },
    ],
  },
  {
    slug: "beneficios-do-muay-thai-para-iniciantes",
    title: "Beneficios do Muay Thai para iniciantes",
    description:
      "Entenda como o Muay Thai melhora condicionamento, coordenacao e confianca mesmo para quem nunca treinou luta.",
    category: "Muay Thai",
    publishedAt: "2026-04-24",
    updatedAt: "2026-04-24",
    readingMinutes: 5,
    image: "/images/mulher_lutando.jpg",
    keywords: ["muay thai para iniciantes", "treino de luta", "condicionamento"],
    sections: [
      {
        heading: "Tecnica antes da intensidade",
        body:
          "O iniciante evolui melhor quando aprende base, guarda, deslocamento e golpes simples antes de aumentar volume. Esse caminho reduz lesoes e melhora a confianca.",
      },
      {
        heading: "Condicionamento completo",
        body:
          "A modalidade combina pernas, tronco, bracos e core. O resultado e um treino dinamico, com gasto energetico alto e melhora gradual de resistencia.",
      },
      {
        heading: "Disciplina sem monotonia",
        body:
          "Cada aula mistura tecnica, repeticao, combinacoes e desafios. Essa variedade ajuda o aluno a manter constancia por mais tempo.",
      },
    ],
  },
  {
    slug: "checklist-primeira-aula-boxe",
    title: "Checklist para sua primeira aula de boxe",
    description:
      "O que levar, como se preparar e o que esperar da primeira aula de boxe em uma academia especializada.",
    category: "Boxe",
    publishedAt: "2026-04-24",
    updatedAt: "2026-04-24",
    readingMinutes: 3,
    image: "/images/instrutor.jpg",
    keywords: ["primeira aula de boxe", "boxe iniciante", "academia de boxe"],
    sections: [
      {
        heading: "Vestuarios e itens basicos",
        body:
          "Use roupa confortavel, tenis firme e leve garrafa de agua. Luvas e bandagens podem ser orientadas pela equipe quando voce chegar.",
      },
      {
        heading: "Ritmo da primeira aula",
        body:
          "Normalmente a aula passa por aquecimento, base, movimentacao, golpes principais e exercicios de fechamento. A intensidade deve ser progressiva.",
      },
      {
        heading: "O que observar",
        body:
          "Repare na atencao do professor, no cuidado com tecnica e na organizacao da turma. Esses detalhes fazem diferenca na sua evolucao.",
      },
    ],
  },
];

export function getBlogPosts() {
  return BLOG_POSTS;
}

export function getBlogPostBySlug(slug: string) {
  return BLOG_POSTS.find((post) => post.slug === slug) ?? null;
}

export function buildBlogJsonLd(post: BlogPost) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    image: absoluteUrl(post.image),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    author: {
      "@type": "Organization",
      name: "Maquina Team",
    },
    publisher: {
      "@type": "Organization",
      name: "Maquina Team",
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/images/logo.jpg"),
      },
    },
  };
}
