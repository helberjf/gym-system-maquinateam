import { Suspense } from "react";
import { PixCheckoutClient } from "@/components/payments/PixCheckoutClient";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata = buildNoIndexMetadata({
  title: "Pix do plano",
  description: "Conclua a assinatura escaneando o QR Code Pix.",
  path: "/planos/pix",
});

export default function PlanPixCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-black" />}>
      <PixCheckoutClient context="plan" />
    </Suspense>
  );
}
