"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import { PaymentMethod } from "@prisma/client";
import { toast } from "sonner";
import { usePublicViewer } from "@/components/public/usePublicViewer";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/lib/constants/brand";

type PlanCheckoutButtonProps = {
  planId: string;
  callbackUrl?: string;
  className?: string;
  isAuthenticated?: boolean;
  tone?: "dark" | "light";
  mode?: "checkout" | "contact";
  contactHref?: string;
  contactLabel?: string;
};

export function PlanCheckoutButton({
  planId,
  callbackUrl = "/planos",
  className,
  isAuthenticated,
  tone = "dark",
  mode = "checkout",
  contactHref = BRAND.contact.whatsappUrl,
  contactLabel = "Consultar plano",
}: PlanCheckoutButtonProps) {
  const viewer = usePublicViewer({
    isAuthenticated,
  });
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const resolvedAuthentication =
    viewer.resolved || isAuthenticated !== undefined
      ? viewer.isAuthenticated
      : Boolean(isAuthenticated);
  const optionToneClasses =
    tone === "light"
      ? {
          selected:
            "border-black bg-black text-white shadow-[0_12px_30px_rgba(0,0,0,0.12)]",
          idle:
            "border-black/10 bg-black/[0.03] text-black/75 hover:bg-black/[0.06]",
        }
      : {
          selected:
            "border-white bg-white text-black shadow-[0_12px_30px_rgba(255,255,255,0.08)]",
          idle:
            "border-brand-gray-mid bg-brand-black/30 text-brand-gray-light hover:border-white/25",
        };
  const primaryToneClasses =
    tone === "light"
      ? "bg-black text-white border-transparent hover:bg-black/90"
      : "bg-brand-red text-black border-transparent hover:bg-brand-red-dark";

  if (mode === "contact") {
    return (
      <Link
        href={contactHref}
        target="_blank"
        rel="noopener noreferrer"
        className={[
          "inline-flex items-center justify-center gap-2 rounded-lg border font-medium",
          "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red",
          "px-4 py-2 text-sm",
          primaryToneClasses,
          className ?? "",
        ]
          .join(" ")
          .trim()}
      >
        {contactLabel}
      </Link>
    );
  }

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

  if (!resolvedAuthentication) {
    void callbackUrl;
    return (
      <div className="space-y-2">
        <Link
          href={`/planos/${planId}/assinar`}
          className={[
            "inline-flex items-center justify-center gap-2 rounded-lg border font-medium",
            "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red",
            "px-4 py-2 text-sm",
            primaryToneClasses,
            className ?? "",
          ]
            .join(" ")
            .trim()}
        >
          Assinar agora
        </Link>
        <p className="text-center text-[11px] uppercase tracking-[0.16em] text-brand-gray-light">
          Ja tem conta?{" "}
          <Link
            href={`/login?callbackUrl=${encodeURIComponent("/planos")}`}
            className="text-white underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
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
                ? optionToneClasses.selected
                : optionToneClasses.idle,
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
