import { Suspense } from "react";
import type { Metadata } from "next";
import { PixCheckoutClient } from "@/components/payments/PixCheckoutClient";

export const metadata: Metadata = {
  title: "Pix do plano",
  description: "Conclua a assinatura escaneando o QR Code Pix.",
};

export default function PlanPixCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-black" />}>
      <PixCheckoutClient context="plan" />
    </Suspense>
  );
}
