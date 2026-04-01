"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import { PaymentMethod } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";

type PlanCheckoutButtonProps = {
  planId: string;
  callbackUrl?: string;
  className?: string;
  isAuthenticated: boolean;
};

export function PlanCheckoutButton({
  planId,
  callbackUrl = "/planos",
  className,
  isAuthenticated,
}: PlanCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);

  async function handleCheckout() {
    setLoading(true);

    try {
      const response = await fetch(`/api/plans/${planId}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentMethod,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            redirectUrl?: string;
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.redirectUrl) {
        toast.error(payload?.error ?? "Nao foi possivel iniciar o pagamento do plano.");
        setLoading(false);
        return;
      }

      startTransition(() => {
        window.location.assign(payload.redirectUrl!);
      });
    } catch {
      toast.error("Nao foi possivel iniciar o pagamento do plano.");
      setLoading(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <Button asChild className={className}>
        <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
          Entrar para assinar
        </Link>
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[
          {
            value: PaymentMethod.PIX,
            label: "Pix",
            description: "AbacatePay",
          },
          {
            value: PaymentMethod.CREDIT_CARD,
            label: "Cartao",
            description: "Mercado Pago",
          },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setPaymentMethod(option.value)}
            className={[
              "rounded-2xl border px-3 py-3 text-left transition",
              paymentMethod === option.value
                ? "border-brand-white bg-brand-white/10 text-white"
                : "border-brand-gray-mid bg-brand-black/30 text-brand-gray-light",
            ].join(" ")}
          >
            <span className="block text-sm font-semibold uppercase">{option.label}</span>
            <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] opacity-70">
              {option.description}
            </span>
          </button>
        ))}
      </div>

      <Button onClick={handleCheckout} loading={loading} className={className}>
        {paymentMethod === PaymentMethod.PIX
          ? "Assinar com Pix"
          : "Assinar no Mercado Pago"}
      </Button>
    </div>
  );
}
