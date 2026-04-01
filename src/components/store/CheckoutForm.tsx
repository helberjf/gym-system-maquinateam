"use client";

import { startTransition, useMemo, useState } from "react";
import { DeliveryMethod, PaymentMethod } from "@prisma/client";
import { toast } from "sonner";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import {
  DELIVERY_METHOD_LABELS,
} from "@/lib/store/constants";
import { ApplyCouponForm } from "@/components/store/ApplyCouponForm";
import { Button } from "@/components/ui/Button";

type AddressShape = {
  id?: string;
  label?: string | null;
  recipientName: string;
  recipientPhone: string;
  zipCode: string;
  state: string;
  city: string;
  district: string;
  street: string;
  number: string;
  complement?: string | null;
  reference?: string | null;
  isDefault?: boolean;
};

type CheckoutFormProps = {
  addresses: AddressShape[];
  suggestedAddress: AddressShape | null;
  cartSubtotalCents: number;
};

const PAYMENT_METHOD_OPTIONS = [
  { value: PaymentMethod.PIX, label: "PIX" },
  { value: PaymentMethod.CREDIT_CARD, label: "Cartao" },
  { value: PaymentMethod.DEBIT_CARD, label: "Debito" },
  { value: PaymentMethod.BOLETO, label: "Boleto" },
] as const;

function getInitialAddress(
  addresses: AddressShape[],
  suggestedAddress: AddressShape | null,
) {
  const saved = addresses.find((address) => address.isDefault) ?? addresses[0];

  return (
    saved ?? {
      recipientName: suggestedAddress?.recipientName ?? "",
      recipientPhone: suggestedAddress?.recipientPhone ?? "",
      zipCode: suggestedAddress?.zipCode ?? "",
      state: suggestedAddress?.state ?? "MG",
      city: suggestedAddress?.city ?? "Juiz de Fora",
      district: suggestedAddress?.district ?? "",
      street: suggestedAddress?.street ?? "",
      number: suggestedAddress?.number ?? "",
      complement: suggestedAddress?.complement ?? "",
      reference: suggestedAddress?.reference ?? "",
      label: suggestedAddress?.label ?? "",
    }
  );
}

export function CheckoutForm({
  addresses,
  suggestedAddress,
  cartSubtotalCents,
}: CheckoutFormProps) {
  const initialAddress = useMemo(
    () => getInitialAddress(addresses, suggestedAddress),
    [addresses, suggestedAddress],
  );
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string>(
    initialAddress.id ?? "",
  );
  const [useNewAddress, setUseNewAddress] = useState(!initialAddress.id);
  const [address, setAddress] = useState<AddressShape>(initialAddress);
  const [saveAddress, setSaveAddress] = useState(true);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(DeliveryMethod.PICKUP);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [couponCode, setCouponCode] = useState("");
  const [discountCents, setDiscountCents] = useState(0);
  const [quotes, setQuotes] = useState<
    Array<{
      method: DeliveryMethod;
      label: string;
      description: string;
      priceCents: number;
      estimatedDays: number;
    }>
  >([
    {
      method: DeliveryMethod.PICKUP,
      label: DELIVERY_METHOD_LABELS[DeliveryMethod.PICKUP],
      description: "Retire diretamente na academia.",
      priceCents: 0,
      estimatedDays: 0,
    },
  ]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const selectedQuote =
    quotes.find((quote) => quote.method === deliveryMethod) ?? quotes[0] ?? null;
  const totalCents = cartSubtotalCents - discountCents + (selectedQuote?.priceCents ?? 0);

  function handleAddressFieldChange(field: keyof AddressShape, value: string) {
    setAddress((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function calculateShipping() {
    setLoadingQuotes(true);

    try {
      const response = await fetch("/api/store/shipping/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            quotes?: Array<{
              method: DeliveryMethod;
              label: string;
              description: string;
              priceCents: number;
              estimatedDays: number;
            }>;
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.quotes) {
        toast.error(payload?.error ?? "Nao foi possivel calcular o frete.");
        return;
      }

      setQuotes(payload.quotes);

      if (!payload.quotes.some((quote) => quote.method === deliveryMethod)) {
        setDeliveryMethod(payload.quotes[0]?.method ?? DeliveryMethod.PICKUP);
      }

      toast.success("Frete atualizado.");
    } catch {
      toast.error("Nao foi possivel calcular o frete.");
    } finally {
      setLoadingQuotes(false);
    }
  }

  function getSelectedSavedAddress() {
    return addresses.find((item) => item.id === selectedSavedAddressId) ?? null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const chosenAddress = useNewAddress ? address : getSelectedSavedAddress();

    try {
      const response = await fetch("/api/store/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deliveryMethod,
          shippingAddressId:
            deliveryMethod === DeliveryMethod.PICKUP
              ? undefined
              : useNewAddress
                ? undefined
                : selectedSavedAddressId,
          address:
            deliveryMethod === DeliveryMethod.PICKUP
              ? undefined
              : useNewAddress
                ? chosenAddress
                : undefined,
          saveAddress: useNewAddress ? saveAddress : false,
          couponCode: couponCode || undefined,
          paymentMethod,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            orderId?: string;
            orderNumber?: string;
            redirectUrl?: string;
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.orderId || !payload.redirectUrl) {
        toast.error(payload?.error ?? "Nao foi possivel concluir o pedido.");
        setSubmitting(false);
        return;
      }

      toast.success(
        `Pedido ${payload.orderNumber ?? ""} iniciado. Redirecionando para o pagamento...`.trim(),
      );
      startTransition(() => {
        window.location.assign(payload.redirectUrl!);
      });
    } catch {
      toast.error("Nao foi possivel concluir o pedido.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {addresses.length > 0 ? (
        <section className="space-y-4 rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Endereco</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Use um endereco salvo ou informe um novo para a entrega.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setUseNewAddress((current) => !current)}
            >
              {useNewAddress ? "Usar endereco salvo" : "Novo endereco"}
            </Button>
          </div>

          {!useNewAddress ? (
            <select
              value={selectedSavedAddressId}
              onChange={(event) => setSelectedSavedAddressId(event.target.value)}
              className="w-full rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            >
              {addresses.map((savedAddress) => (
                <option key={savedAddress.id} value={savedAddress.id}>
                  {savedAddress.label || savedAddress.street} - {savedAddress.city}/{savedAddress.state}
                </option>
              ))}
            </select>
          ) : null}
        </section>
      ) : null}

      {useNewAddress ? (
        <section className="space-y-4 rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-5">
          <div>
            <h2 className="text-lg font-bold text-white">Novo endereco</h2>
            <p className="mt-1 text-sm text-brand-gray-light">
              Endereco que sera usado no checkout e, se quiser, salvo para compras futuras.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              value={address.label ?? ""}
              onChange={(event) => handleAddressFieldChange("label", event.target.value)}
              placeholder="Apelido do endereco"
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            />
            <input
              value={address.recipientName}
              onChange={(event) => handleAddressFieldChange("recipientName", event.target.value)}
              placeholder="Destinatario"
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            />
            <input
              value={address.recipientPhone}
              onChange={(event) => handleAddressFieldChange("recipientPhone", event.target.value)}
              placeholder="Telefone"
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            />
            <input
              value={address.zipCode}
              onChange={(event) => handleAddressFieldChange("zipCode", event.target.value)}
              placeholder="CEP"
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            />
            <input
              value={address.state}
              onChange={(event) => handleAddressFieldChange("state", event.target.value)}
              placeholder="Estado"
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            />
            <input
              value={address.city}
              onChange={(event) => handleAddressFieldChange("city", event.target.value)}
              placeholder="Cidade"
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            />
            <input
              value={address.district}
              onChange={(event) => handleAddressFieldChange("district", event.target.value)}
              placeholder="Bairro"
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            />
            <input
              value={address.street}
              onChange={(event) => handleAddressFieldChange("street", event.target.value)}
              placeholder="Rua"
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            />
            <input
              value={address.number}
              onChange={(event) => handleAddressFieldChange("number", event.target.value)}
              placeholder="Numero"
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            />
            <input
              value={address.complement ?? ""}
              onChange={(event) => handleAddressFieldChange("complement", event.target.value)}
              placeholder="Complemento"
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-brand-gray-mid bg-brand-black/30 px-4 py-3 text-sm text-white">
            <input
              type="checkbox"
              checked={saveAddress}
              onChange={(event) => setSaveAddress(event.target.checked)}
              className="h-4 w-4 accent-brand-red"
            />
            Salvar endereco para as proximas compras.
          </label>
        </section>
      ) : null}

      <section className="space-y-4 rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Entrega</h2>
            <p className="mt-1 text-sm text-brand-gray-light">
              Escolha a retirada na academia ou calcule as opcoes de frete para entrega.
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" loading={loadingQuotes} onClick={calculateShipping}>
            Calcular frete
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {quotes.map((quote) => (
            <label
              key={quote.method}
              className={[
                "cursor-pointer rounded-2xl border px-4 py-4 transition",
                deliveryMethod === quote.method
                  ? "border-brand-white bg-brand-white/10"
                  : "border-brand-gray-mid bg-brand-black/30",
              ].join(" ")}
            >
              <input
                type="radio"
                name="deliveryMethod"
                value={quote.method}
                checked={deliveryMethod === quote.method}
                onChange={() => setDeliveryMethod(quote.method)}
                className="sr-only"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{quote.label}</p>
                  <p className="mt-1 text-xs text-brand-gray-light">{quote.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">
                    {formatCurrencyFromCents(quote.priceCents)}
                  </p>
                  <p className="mt-1 text-xs text-brand-gray-light">
                    {quote.estimatedDays === 0
                      ? "Retirada imediata"
                      : `${quote.estimatedDays} dia(s) uteis`}
                  </p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-5">
        <div>
          <h2 className="text-lg font-bold text-white">Pagamento e desconto</h2>
          <p className="mt-1 text-sm text-brand-gray-light">
            PIX abre o QR Code pela AbacatePay. Cartao, debito e boleto seguem pelo Mercado Pago.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PAYMENT_METHOD_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={[
                "cursor-pointer rounded-2xl border px-4 py-4 text-sm font-semibold transition",
                paymentMethod === option.value
                  ? "border-brand-white bg-brand-white/10 text-white"
                  : "border-brand-gray-mid bg-brand-black/30 text-brand-gray-light",
              ].join(" ")}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={option.value}
                checked={paymentMethod === option.value}
                onChange={() => setPaymentMethod(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>

        <ApplyCouponForm
          initialCode={couponCode}
          onValidated={(payload) => {
            if (payload.valid) {
              setCouponCode(payload.code);
              setDiscountCents(payload.discountCents ?? 0);
            } else {
              setDiscountCents(0);
            }
          }}
        />
      </section>

      <section className="rounded-[2rem] border border-brand-gray-mid bg-white p-5 text-black">
        <h2 className="text-lg font-bold uppercase">Resumo final</h2>
        <div className="mt-5 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <strong>{formatCurrencyFromCents(cartSubtotalCents)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span>Desconto</span>
            <strong>- {formatCurrencyFromCents(discountCents)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span>Frete</span>
            <strong>{formatCurrencyFromCents(selectedQuote?.priceCents ?? 0)}</strong>
          </div>
          <div className="flex items-center justify-between border-t border-black/10 pt-3 text-base">
            <span>Total</span>
            <strong>{formatCurrencyFromCents(totalCents)}</strong>
          </div>
        </div>

        <Button type="submit" size="lg" loading={submitting} className="mt-6 w-full">
          Ir para pagamento
        </Button>
      </section>
    </form>
  );
}
