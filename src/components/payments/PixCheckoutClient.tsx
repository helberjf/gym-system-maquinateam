"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type PixCheckoutClientProps = {
  context: "store" | "plan";
};

type PixStatusResponse = {
  checkoutPaymentId: string;
  paymentId: string;
  kind: "STORE_ORDER" | "PLAN_SUBSCRIPTION";
  amountCents: number;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
  providerStatus?: string | null;
  brCode?: string | null;
  qrCodeImage?: string | null;
  expiresAt?: string | null;
  syncError?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
  subscriptionId?: string | null;
  planName?: string | null;
  error?: string;
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString("pt-BR");
}

function normalizeQrCodeImageSrc(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
}

function buildRedirectTarget(data: PixStatusResponse) {
  if (data.kind === "STORE_ORDER" && data.orderId) {
    const params = new URLSearchParams({
      orderId: data.orderId,
      paymentId: data.paymentId,
      status: data.providerStatus ?? data.status,
    });

    if (data.status === "PAID") {
      return `/checkout/sucesso?${params.toString()}`;
    }

    if (["FAILED", "CANCELLED", "REFUNDED"].includes(data.status)) {
      return `/checkout/falha?${params.toString()}`;
    }
  }

  if (data.kind === "PLAN_SUBSCRIPTION" && data.subscriptionId) {
    const params = new URLSearchParams({
      subscriptionId: data.subscriptionId,
      paymentId: data.paymentId,
      status: data.providerStatus ?? data.status,
    });

    if (data.status === "PAID") {
      return `/planos/sucesso?${params.toString()}`;
    }

    if (["FAILED", "CANCELLED", "REFUNDED"].includes(data.status)) {
      return `/planos/falha?${params.toString()}`;
    }
  }

  return null;
}

export function PixCheckoutClient({ context }: PixCheckoutClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("payment");

  const [data, setData] = useState<PixStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const qrCodeImageSrc = useMemo(
    () => normalizeQrCodeImageSrc(data?.qrCodeImage),
    [data?.qrCodeImage],
  );

  const backHref = context === "plan" ? "/planos" : "/products";

  const fetchStatus = useCallback(
    async (mode: "initial" | "manual" | "poll" = "poll") => {
      if (!paymentId) {
        setError("Pagamento Pix nao informado.");
        setLoading(false);
        return;
      }

      if (mode === "manual") {
        setRefreshing(true);
      } else if (mode === "initial") {
        setLoading(true);
      }

      try {
        const response = await fetch(
          `/api/payments/pix/status?payment=${encodeURIComponent(paymentId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => null)) as
          | (PixStatusResponse & { ok?: boolean })
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? "Erro ao consultar o status do Pix.");
        }

        setData(payload);
        setError(null);

        const redirectTarget = buildRedirectTarget(payload);

        if (redirectTarget) {
          router.replace(redirectTarget);
          return;
        }
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Erro ao consultar o status do Pix.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [paymentId, router],
  );

  useEffect(() => {
    if (!paymentId) {
      setError("Pagamento Pix nao informado.");
      setLoading(false);
      return;
    }

    void fetchStatus("initial");

    const intervalId = window.setInterval(() => {
      void fetchStatus("poll");
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchStatus, paymentId]);

  async function handleCopyPixCode() {
    if (!data?.brCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(data.brCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Nao foi possivel copiar o codigo Pix.");
    }
  }

  const title =
    data?.kind === "PLAN_SUBSCRIPTION"
      ? "Assinatura com Pix"
      : "Pagamento com Pix";
  const summaryTitle =
    data?.kind === "PLAN_SUBSCRIPTION"
      ? data.planName ?? "Assinatura"
      : data?.orderNumber ?? "Pedido da loja";

  return (
    <main className="min-h-screen bg-brand-black px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="space-y-2">
          <Link
            href={backHref}
            className="inline-flex text-sm font-medium text-brand-gray-light transition hover:text-white"
          >
            Voltar
          </Link>
          <h1 className="text-3xl font-bold uppercase text-white sm:text-4xl">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-brand-gray-light sm:text-base">
            Escaneie o QR Code ou copie o codigo Pix. Assim que o pagamento for
            confirmado, seguimos automaticamente para a tela final do pedido.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-white">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  QR Code Pix
                </div>
                <p className="text-xs text-brand-gray-light">
                  Pix processado pela AbacatePay.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void fetchStatus("manual")}
                className="inline-flex items-center gap-2 rounded-2xl border border-brand-gray-mid bg-brand-black/40 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-brand-black disabled:opacity-60"
                disabled={refreshing}
              >
                {refreshing ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent" />
                ) : null}
                Atualizar
              </button>
            </div>

            {loading && !data ? (
              <div className="flex min-h-72 items-center justify-center rounded-[1.5rem] border border-dashed border-brand-gray-mid bg-brand-black/30 text-sm text-brand-gray-light">
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border border-white/70 border-t-transparent" />
                Gerando dados do Pix...
              </div>
            ) : qrCodeImageSrc ? (
              <div className="flex flex-col items-center gap-4 rounded-[1.5rem] border border-brand-gray-mid bg-white p-4">
                <Image
                  src={qrCodeImageSrc}
                  alt="QR Code Pix para pagamento"
                  width={360}
                  height={360}
                  className="h-auto w-full max-w-[360px] rounded-2xl bg-white"
                  unoptimized
                />
                <p className="text-center text-xs uppercase tracking-[0.16em] text-black/60">
                  Abra o app do seu banco e finalize com Pix.
                </p>
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                O QR Code ainda nao foi disponibilizado. Atualize em instantes.
              </div>
            )}

            <div className="mt-5 space-y-2 rounded-[1.5rem] border border-brand-gray-mid bg-brand-black/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-gray-light">
                    Copia e cola
                  </p>
                  <p className="mt-2 break-all text-sm text-white">
                    {data?.brCode ?? "Aguardando codigo Pix."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPixCode}
                disabled={!data?.brCode}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-brand-gray-light disabled:opacity-50"
              >
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-[1.5rem] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            {data?.syncError ? (
              <div className="mt-4 rounded-[1.5rem] border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                {data.syncError}
              </div>
            ) : null}
          </section>

          <aside className="space-y-4 rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-5 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-white">
              <span className="h-2 w-2 rounded-full bg-white" />
              Resumo do pagamento
            </div>

            <div className="space-y-3 text-sm">
              <div className="rounded-[1.5rem] border border-brand-gray-mid bg-white p-4 text-black">
                <p className="text-xs uppercase tracking-[0.16em] text-black/55">
                  Total
                </p>
                <p className="mt-2 text-3xl font-bold leading-none">
                  {formatCurrency(data?.amountCents ?? 0)}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.14em] text-black/55">
                  {summaryTitle}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-brand-gray-mid bg-brand-black/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-brand-gray-light">Status</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                      data?.status === "PAID"
                        ? "bg-white text-black"
                        : "bg-brand-white/10 text-white"
                    }`}
                  >
                    {data?.status === "PAID" ? "Pago" : "Aguardando"}
                  </span>
                </div>

                <dl className="mt-4 space-y-3 text-sm">
                  <div className="grid grid-cols-[auto,minmax(0,1fr)] items-start gap-3">
                    <dt className="text-brand-gray-light">Pagamento</dt>
                    <dd className="min-w-0 break-all text-right font-mono text-xs font-medium text-white sm:text-sm">
                      {data?.paymentId ?? "-"}
                    </dd>
                  </div>
                  {data?.orderNumber ? (
                    <div className="grid grid-cols-[auto,minmax(0,1fr)] items-start gap-3">
                      <dt className="text-brand-gray-light">Pedido</dt>
                      <dd className="min-w-0 break-all text-right font-mono text-xs font-medium text-white sm:text-sm">
                        {data.orderNumber}
                      </dd>
                    </div>
                  ) : null}
                  {data?.planName ? (
                    <div className="grid grid-cols-[auto,minmax(0,1fr)] items-start gap-3">
                      <dt className="text-brand-gray-light">Plano</dt>
                      <dd className="min-w-0 text-right font-medium text-white">
                        {data.planName}
                      </dd>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-[auto,minmax(0,1fr)] items-start gap-3">
                    <dt className="text-brand-gray-light">Expira em</dt>
                    <dd className="min-w-0 text-right font-medium text-white">
                      {formatDateTime(data?.expiresAt) ?? "Nao informado"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
