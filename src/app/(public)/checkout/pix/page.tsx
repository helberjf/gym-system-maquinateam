import { Suspense } from "react";
import { PixCheckoutClient } from "@/components/payments/PixCheckoutClient";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata = buildNoIndexMetadata({
  title: "Pix da loja",
  description: "Conclua o pedido da loja escaneando o QR Code Pix.",
  path: "/checkout/pix",
});

export default function StorePixCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-black" />}>
      <PixCheckoutClient context="store" />
    </Suspense>
  );
}
