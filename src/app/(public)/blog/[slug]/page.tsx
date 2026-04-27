import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  buildBlogJsonLd,
  getBlogPostBySlug,
  getBlogPosts,
} from "@/lib/blog";
import { buildPublicMetadata, serializeJsonLd } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return buildPublicMetadata({
      title: "Artigo nao encontrado",
      description: "Conteudo nao encontrado no blog da Maquina Team.",
      path: "/blog",
      noIndex: true,
    });
  }

  return buildPublicMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    keywords: post.keywords,
    images: [post.image],
    type: "article",
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="bg-brand-black text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildBlogJsonLd(post)),
        }}
      />

      <header className="relative min-h-[68svh] overflow-hidden">
        <Image
          src={post.image}
          alt={post.title}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-black/35 via-brand-black/65 to-brand-black" />
        <div className="relative mx-auto flex min-h-[68svh] max-w-4xl flex-col justify-end px-4 pb-14 pt-24 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-red"
          >
            Blog
          </Link>
          <h1 className="mt-4 text-4xl font-black uppercase leading-none text-white sm:text-6xl">
            {post.title}
          </h1>
          <p className="mt-5 text-base leading-7 text-brand-gray-light sm:text-lg">
            {post.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-brand-gray-light">
            <span className="rounded-full border border-brand-gray-mid px-3 py-1">
              {post.category}
            </span>
            <span className="rounded-full border border-brand-gray-mid px-3 py-1">
              {post.readingMinutes} min de leitura
            </span>
            <span className="rounded-full border border-brand-gray-mid px-3 py-1">
              {post.publishedAt}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-10">
          {post.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-black uppercase text-white">
                {section.heading}
              </h2>
              <p className="mt-4 text-base leading-8 text-brand-gray-light">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <h2 className="text-2xl font-black uppercase text-white">
            Treine com a Maquina Team
          </h2>
          <p className="mt-3 text-sm leading-6 text-brand-gray-light">
            Conheca os planos e encontre uma rotina de treino compativel com seus
            objetivos.
          </p>
          <Link
            href="/planos"
            className="mt-5 inline-flex rounded-2xl bg-brand-red px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red-dark"
          >
            Ver planos
          </Link>
        </div>
      </div>
    </article>
  );
}
