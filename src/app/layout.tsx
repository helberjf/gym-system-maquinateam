import type { Metadata } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/constants/brand";
import { getSiteUrl } from "@/lib/seo";
import { AppToaster } from "@/components/ui/AppToaster";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  applicationName: BRAND.name,
  title: {
    default: `${BRAND.name} | Academia de luta`,
    template: `%s | ${BRAND.name}`,
  },
  description: `${BRAND.slogan} Academia premium de luta com boxe, muay thai, kickboxing e funcional em Juiz de Fora.`,
  keywords: [
    "academia de luta",
    "boxe",
    "muay thai",
    "kickboxing",
    "funcional",
    "juiz de fora",
    "maquina team",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: BRAND.name,
    title: BRAND.name,
    description: BRAND.slogan,
    url: "/",
    images: [
      {
        url: "/images/fachada.webp",
        width: 1200,
        height: 630,
        alt: BRAND.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.name,
    description: BRAND.slogan,
    images: ["/images/fachada.webp"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${manrope.variable} ${barlowCondensed.variable}`}
    >
      <body>
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
