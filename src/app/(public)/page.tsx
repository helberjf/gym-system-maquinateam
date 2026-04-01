import { HomeLandingPage } from "@/components/public/HomeLandingPage";
import { getOptionalSession } from "@/lib/auth/session";
import { getFeaturedPublicPlans } from "@/lib/billing/public";
import { BRAND } from "@/lib/constants/brand";
import { buildPublicMetadata, serializeJsonLd, absoluteUrl } from "@/lib/seo";
import { getFeaturedProducts } from "@/lib/store/catalog";

export const metadata = buildPublicMetadata({
  title: "Premium Fight Club em Juiz de Fora",
  description:
    "Treinos de boxe, muay thai, kickboxing e funcional com planos online, loja esportiva e painel do aluno na Maquina Team.",
  path: "/",
  keywords: [
    "academia de boxe em juiz de fora",
    "muay thai em juiz de fora",
    "kickboxing em juiz de fora",
    "academia com loja esportiva",
  ],
});

export const revalidate = 120;

export default async function PublicHomePage() {
  const [session, featuredPlans, featuredProducts] = await Promise.all([
    getOptionalSession(),
    getFeaturedPublicPlans(3).catch(() => []),
    getFeaturedProducts().catch(() => []),
  ]);
  const averageRating =
    BRAND.reviews.reduce((total, review) => total + review.rating, 0) /
    BRAND.reviews.length;
  const homeSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HealthClub",
        "@id": absoluteUrl("/#academy"),
        name: BRAND.name,
        url: absoluteUrl("/"),
        image: absoluteUrl("/images/fachada.webp"),
        description: BRAND.slogan,
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
        openingHours: ["Mo-Su 08:00-22:00"],
        sameAs: [BRAND.contact.instagramUrl],
        review: BRAND.reviews.map((review) => ({
          "@type": "Review",
          author: {
            "@type": "Person",
            name: review.author,
          },
          reviewBody: review.text,
          reviewRating: {
            "@type": "Rating",
            ratingValue: review.rating,
            bestRating: 5,
          },
        })),
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: averageRating.toFixed(1),
          reviewCount: BRAND.reviews.length,
          bestRating: 5,
        },
      },
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        url: absoluteUrl("/"),
        name: BRAND.name,
        potentialAction: {
          "@type": "SearchAction",
          target: absoluteUrl("/products?q={search_term_string}"),
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(homeSchema),
        }}
      />
      <HomeLandingPage
        featuredPlans={featuredPlans}
        featuredProducts={featuredProducts}
        isAuthenticated={Boolean(session?.user?.id)}
      />
    </>
  );
}
