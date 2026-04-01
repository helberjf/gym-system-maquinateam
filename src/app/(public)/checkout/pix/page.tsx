import { Suspense } from "react";
import type { Metadata } from "next";
import { PixCheckoutClient } from "@/components/payments/PixCheckoutClient";

export const metadata: Metadata = {
  title: "Pix da loja",
  description: "Conclua o pedido da loja escaneando o QR Code Pix.",
};

export default function StorePixCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-black" />}>
      <PixCheckoutClient context="store" />
    </Suspense>
  );
}
