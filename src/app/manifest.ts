import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/constants/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} | Academia de luta`,
    short_name: BRAND.name,
    description: `${BRAND.slogan} Academia premium de luta com boxe, muay thai, kickboxing e funcional em Juiz de Fora.`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0A0A",
    theme_color: "#C8102E",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["fitness", "health", "lifestyle", "sports"],
    icons: [
      {
        src: "/images/logo.jpg",
        sizes: "192x192",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/images/logo.jpg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "any",
      },
    ],
  };
}
