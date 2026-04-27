import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getBlogPosts } from "@/lib/blog";
import { buildPublicMetadata, serializeJsonLd } from "@/lib/seo";

export const metadata: Metadata = buildPublicMetadata({
  title: "Blog de luta, treino e performance",
  description:
    "Conteudos da Maquina Team sobre boxe, muay thai, planos de academia e evolucao segura nos treinos.",
  path: "/blog",
  keywords: ["blog de luta", "treino de luta", "academia de luta juiz de fora"],
});

export default function BlogPage() {
  const posts = getBlogPosts();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Blog Maquina Team",
    description:
      "Guias de treino, luta, condicionamento e escolha de planos para alunos iniciantes e avancados.",
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      url: `/blog/${post.slug}`,
      datePublished: post.publishedAt,
    })),
  };

  return (
    <div className="bg-brand-black text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <section className="relative min-h-[72svh] overflow-hidden">
        <Image
          src="/images/interior.webp"
          alt="Interior da academia Maquina Team"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-black/35 via-brand-black/65 to-brand-black" />
        <div className="relative mx-auto flex min-h-[72svh] max-w-7xl flex-col justify-end px-4 pb-14 pt-24 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-red">
            Blog
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black uppercase leading-none text-white sm:text-6xl">
            Luta, rotina e evolucao dentro do tatame
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-brand-gray-light sm:text-lg">
            Artigos praticos para treinar melhor, escolher planos com clareza e
            chegar mais preparado nas aulas.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group overflow-hidden rounded-3xl border border-brand-gray-mid bg-brand-gray-dark transition hover:border-brand-red/50"
          >
            <div className="relative aspect-[16/10]">
              <Image
                src={post.image}
                alt={post.title}
                fill
                className="object-cover transition duration-300 group-hover:scale-105"
                sizes="(min-width: 1024px) 33vw, 100vw"
              />
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-brand-gray-light">
                <span className="rounded-full border border-brand-gray-mid px-3 py-1">
                  {post.category}
                </span>
                <span>{post.readingMinutes} min</span>
              </div>
              <h2 className="mt-4 text-xl font-bold text-white transition group-hover:text-brand-red">
                {post.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-brand-gray-light">
                {post.description}
              </p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
