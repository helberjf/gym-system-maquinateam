"use client";

import { startTransition, useMemo, useState } from "react";
import { DeliveryMethod, PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { toast } from "sonner";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import { ApplyCouponForm } from "@/components/store/ApplyCouponForm";
import { Button } from "@/components/ui/Button";
import { DELIVERY_METHOD_LABELS } from "@/lib/store/constants";
import {
  formatCpf,
  formatPhoneBR,
  formatStateUf,
  formatZipCodeBR,
  normalizeBrazilPhoneDigits,
  onlyDigits,
} from "@/lib/utils/formatters";
import { validateCpf } from "@/lib/validators/validateCpf";

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

type GuestCustomerState = {
  name: string;
  email: string;
  phone: string;
  document: string;
};

type CepLookupResponse = {
  zipCode: string;
  street: string;
  district: string;
  city: string;
  state: string;
  complement: string;
};

type CheckoutFormProps = {
  addresses: AddressShape[];
  suggestedAddress: AddressShape | null;
  cartSubtotalCents: number;
  customer: {
    authenticated: boolean;
    name: string;
    email: string;
    phone: string;
    document: string;
  };
};

type GuestFieldName = keyof GuestCustomerState;
type AddressFieldName =
  | "recipientName"
  | "recipientPhone"
  | "zipCode"
  | "state"
  | "city"
  | "district"
  | "street"
  | "number";

const PAYMENT_METHOD_OPTIONS = [
  { value: PaymentMethod.PIX, label: "PIX" },
  { value: PaymentMethod.CREDIT_CARD, label: "Cartao" },
  { value: PaymentMethod.DEBIT_CARD, label: "Debito" },
  { value: PaymentMethod.BOLETO, label: "Boleto" },
] as const;

const GUEST_FIELD_NAMES: GuestFieldName[] = [
  "name",
  "email",
  "phone",
  "document",
];

const ADDRESS_FIELD_NAMES: AddressFieldName[] = [
  "recipientName",
  "recipientPhone",
  "zipCode",
  "state",
  "city",
  "district",
  "street",
  "number",
];

const guestFieldSchemas: Record<GuestFieldName, z.ZodType<string>> = {
  name: z
    .string()
    .trim()
    .min(1, "Informe seu nome completo.")
    .refine((value) => hasSurname(value), "Informe nome e sobrenome."),
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail.")
    .email("Informe um e-mail valido."),
  phone: z
    .string()
    .trim()
    .refine((value) => {
      const digits = normalizeBrazilPhoneDigits(value);
      return digits.length >= 10 && digits.length <= 11;
    }, "Informe um telefone valido."),
  document: z
    .string()
    .trim()
    .min(1, "Informe seu CPF.")
    .refine((value) => validateCpf(value), "Informe um CPF valido."),
};

const addressFieldSchemas: Record<AddressFieldName, z.ZodType<string>> = {
  recipientName: z.string().trim().min(2, "Informe o destinatario."),
  recipientPhone: z
    .string()
    .trim()
    .refine((value) => {
      const digits = normalizeBrazilPhoneDigits(value);
      return digits.length >= 10 && digits.length <= 11;
    }, "Informe um telefone valido."),
  zipCode: z
    .string()
    .trim()
    .refine((value) => onlyDigits(value).length === 8, "Informe um CEP valido."),
  state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Informe uma UF valida."),
  city: z.string().trim().min(2, "Informe a cidade."),
  district: z.string().trim().min(2, "Informe o bairro."),
  street: z.string().trim().min(2, "Informe a rua."),
  number: z.string().trim().min(1, "Informe o numero."),
};

function hasSurname(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 && parts.every((part) => part.length >= 2);
}

function getInputClassName(hasError: boolean) {
  return [
    "w-full rounded-xl border bg-brand-black px-4 py-3 text-sm text-white outline-none transition",
    hasError
      ? "border-brand-red focus:border-brand-red"
      : "border-brand-gray-mid focus:border-brand-red",
  ].join(" ");
}

function getFirstErrorMessage<TField extends string>(
  errors: Partial<Record<TField, string>>,
): string | null {
  for (const message of Object.values(errors)) {
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return null;
}

function buildTouchedState<TField extends string>(fields: TField[]) {
  return Object.fromEntries(fields.map((field) => [field, true])) as Record<
    TField,
    boolean
  >;
}

function normalizeAddressForForm(address: AddressShape): AddressShape {
  return {
    ...address,
    recipientPhone: formatPhoneBR(address.recipientPhone ?? ""),
    zipCode: formatZipCodeBR(address.zipCode ?? ""),
    state: formatStateUf(address.state ?? ""),
    label: address.label ?? "",
    complement: address.complement ?? "",
    reference: address.reference ?? "",
  };
}

function getInitialAddress(
  addresses: AddressShape[],
  suggestedAddress: AddressShape | null,
) {
  const saved = addresses.find((address) => address.isDefault) ?? addresses[0];

  return normalizeAddressForForm(
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
    },
  );
}

export function CheckoutForm({
  addresses,
  suggestedAddress,
  cartSubtotalCents,
  customer,
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
  const [guestCustomer, setGuestCustomer] = useState<GuestCustomerState>({
    name: customer.name,
    email: customer.email,
    phone: formatPhoneBR(customer.phone),
    document: formatCpf(customer.document),
  });
  const [guestErrors, setGuestErrors] = useState<
    Partial<Record<GuestFieldName, string>>
  >({});
  const [guestTouched, setGuestTouched] = useState<
    Partial<Record<GuestFieldName, boolean>>
  >({});
  const [addressErrors, setAddressErrors] = useState<
    Partial<Record<AddressFieldName, string>>
  >({});
  const [addressTouched, setAddressTouched] = useState<
    Partial<Record<AddressFieldName, boolean>>
  >({});
  const [saveAddress, setSaveAddress] = useState(customer.authenticated);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(
    DeliveryMethod.PICKUP,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethod.PIX,
  );
  const [couponCode, setCouponCode] = useState("");
  const [discountCents, setDiscountCents] = useState(0);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
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
  const totalCents =
    cartSubtotalCents - discountCents + (selectedQuote?.priceCents ?? 0);

  function getSelectedSavedAddress() {
    const selected = addresses.find((item) => item.id === selectedSavedAddressId);
    return selected ? normalizeAddressForForm(selected) : null;
  }

  function validateGuestField(field: GuestFieldName, value: string) {
    const result = guestFieldSchemas[field].safeParse(value);
    return result.success ? undefined : result.error.issues[0]?.message;
  }

  function validateAddressField(field: AddressFieldName, value: string) {
    const result = addressFieldSchemas[field].safeParse(value);
    return result.success ? undefined : result.error.issues[0]?.message;
  }

  function validateGuestForm() {
    const nextErrors = GUEST_FIELD_NAMES.reduce<
      Partial<Record<GuestFieldName, string>>
    >((accumulator, field) => {
      const error = validateGuestField(field, guestCustomer[field]);

      if (error) {
        accumulator[field] = error;
      }

      return accumulator;
    }, {});

    setGuestTouched(buildTouchedState(GUEST_FIELD_NAMES));
    setGuestErrors(nextErrors);

    return nextErrors;
  }

  function validateAddressForm() {
    const nextErrors = ADDRESS_FIELD_NAMES.reduce<
      Partial<Record<AddressFieldName, string>>
    >((accumulator, field) => {
      const error = validateAddressField(field, address[field]);

      if (error) {
        accumulator[field] = error;
      }

      return accumulator;
    }, {});

    setAddressTouched(buildTouchedState(ADDRESS_FIELD_NAMES));
    setAddressErrors(nextErrors);

    return nextErrors;
  }

  function handleAddressFieldChange(field: keyof AddressShape, value: string) {
    const nextValue =
      field === "recipientPhone"
        ? formatPhoneBR(value)
        : field === "zipCode"
          ? formatZipCodeBR(value)
          : field === "state"
            ? formatStateUf(value)
            : value;

    setAddress((current) => ({
      ...current,
      [field]: nextValue,
    }));

    if (field === "zipCode") {
      setCepError(null);
    }

    if (
      ADDRESS_FIELD_NAMES.includes(field as AddressFieldName) &&
      addressTouched[field as AddressFieldName]
    ) {
      setAddressErrors((current) => ({
        ...current,
        [field]: validateAddressField(field as AddressFieldName, nextValue),
      }));
    }
  }

  function handleGuestCustomerFieldChange(field: GuestFieldName, value: string) {
    const nextValue =
      field === "phone"
        ? formatPhoneBR(value)
        : field === "document"
          ? formatCpf(value)
          : value;

    setGuestCustomer((current) => ({
      ...current,
      [field]: nextValue,
    }));

    if (guestTouched[field]) {
      setGuestErrors((current) => ({
        ...current,
        [field]: validateGuestField(field, nextValue),
      }));
    }
  }

  function handleGuestFieldBlur(field: GuestFieldName) {
    setGuestTouched((current) => ({
      ...current,
      [field]: true,
    }));
    setGuestErrors((current) => ({
      ...current,
      [field]: validateGuestField(field, guestCustomer[field]),
    }));
  }

  function handleAddressFieldBlur(field: AddressFieldName) {
    setAddressTouched((current) => ({
      ...current,
      [field]: true,
    }));
    setAddressErrors((current) => ({
      ...current,
      [field]: validateAddressField(field, address[field]),
    }));
  }

  async function fetchCepData() {
    const zipDigits = onlyDigits(address.zipCode);

    if (zipDigits.length !== 8) {
      return;
    }

    setCepLoading(true);
    setCepError(null);

    try {
      const response = await fetch(`/api/cep?cep=${zipDigits}`);
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
          }
        | (CepLookupResponse & { ok?: boolean })
        | null;

      if (!response.ok || !payload || ("ok" in payload && payload.ok === false)) {
        setCepError(
          (payload && "error" in payload && payload.error) || "CEP nao encontrado.",
        );
        return;
      }

      const data = payload as CepLookupResponse & { ok?: boolean };

      setAddress((current) => ({
        ...current,
        zipCode: formatZipCodeBR(data.zipCode || zipDigits),
        street: data.street || current.street,
        district: data.district || current.district,
        city: data.city || current.city,
        state: formatStateUf(data.state || current.state),
        complement: current.complement || data.complement || "",
      }));

      setAddressErrors((current) => ({
        ...current,
        zipCode: undefined,
        street: undefined,
        district: undefined,
        city: undefined,
        state: undefined,
      }));
    } catch {
      setCepError("Erro ao buscar CEP.");
    } finally {
      setCepLoading(false);
    }
  }

  async function calculateShipping() {
    const shippingAddress = useNewAddress ? address : getSelectedSavedAddress();

    if (!shippingAddress) {
      toast.error("Selecione ou informe um endereco para calcular o frete.");
      return;
    }

    if (useNewAddress) {
      const nextErrors = validateAddressForm();
      const firstError = getFirstErrorMessage(nextErrors);

      if (firstError) {
        toast.error(firstError);
        return;
      }
    }

    setLoadingQuotes(true);

    try {
      const response = await fetch("/api/store/shipping/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: shippingAddress,
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customer.authenticated) {
      const nextErrors = validateGuestForm();
      const firstError = getFirstErrorMessage(nextErrors);

      if (firstError) {
        toast.error(firstError);
        return;
      }
    }

    const chosenAddress = useNewAddress ? address : getSelectedSavedAddress();

    if (deliveryMethod !== DeliveryMethod.PICKUP) {
      if (!chosenAddress) {
        toast.error("Selecione ou informe um endereco para a entrega.");
        return;
      }

      if (useNewAddress) {
        const nextErrors = validateAddressForm();
        const firstError = getFirstErrorMessage(nextErrors);

        if (firstError) {
          toast.error(firstError);
          return;
        }
      }
    }

    setSubmitting(true);

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
          guest: customer.authenticated
            ? undefined
            : {
                name: guestCustomer.name,
                email: guestCustomer.email,
                phone: guestCustomer.phone,
                document: guestCustomer.document,
              },
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

      if (
        !response.ok ||
        !payload?.ok ||
        !payload.orderId ||
        !payload.redirectUrl
      ) {
        toast.error(payload?.error ?? "Nao foi possivel concluir o pedido.");
        setSubmitting(false);
        return;
      }

      toast.success(
        `Pedido ${payload.orderNumber ?? ""} iniciado. Redirecionando para o pagamento...`.trim(),
      );
      const redirectUrl = payload.redirectUrl;

      startTransition(() => {
        window.location.assign(redirectUrl);
      });
    } catch {
      toast.error("Nao foi possivel concluir o pedido.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!customer.authenticated ? (
        <section className="space-y-4 rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-5">
          <div>
            <h2 className="text-lg font-bold text-white">Seus dados</h2>
            <p className="mt-1 text-sm text-brand-gray-light">
              Compra como visitante. Informe os dados do comprador para gerar o pedido e o pagamento.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <input
                value={guestCustomer.name}
                onChange={(event) =>
                  handleGuestCustomerFieldChange("name", event.target.value)
                }
                onBlur={() => handleGuestFieldBlur("name")}
                placeholder="Nome completo"
                autoComplete="name"
                className={getInputClassName(Boolean(guestErrors.name))}
              />
              {guestErrors.name ? (
                <p className="text-xs text-brand-red">{guestErrors.name}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <input
                value={guestCustomer.email}
                onChange={(event) =>
                  handleGuestCustomerFieldChange("email", event.target.value)
                }
                onBlur={() => handleGuestFieldBlur("email")}
                placeholder="E-mail"
                type="email"
                autoComplete="email"
                className={getInputClassName(Boolean(guestErrors.email))}
              />
              {guestErrors.email ? (
                <p className="text-xs text-brand-red">{guestErrors.email}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <input
                value={guestCustomer.phone}
                onChange={(event) =>
                  handleGuestCustomerFieldChange("phone", event.target.value)
                }
                onBlur={() => handleGuestFieldBlur("phone")}
                placeholder="Telefone"
                autoComplete="tel"
                inputMode="tel"
                maxLength={15}
                className={getInputClassName(Boolean(guestErrors.phone))}
              />
              {guestErrors.phone ? (
                <p className="text-xs text-brand-red">{guestErrors.phone}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <input
                value={guestCustomer.document}
                onChange={(event) =>
                  handleGuestCustomerFieldChange("document", event.target.value)
                }
                onBlur={() => handleGuestFieldBlur("document")}
                placeholder="CPF"
                autoComplete="off"
                inputMode="numeric"
                maxLength={14}
                className={getInputClassName(Boolean(guestErrors.document))}
              />
              {guestErrors.document ? (
                <p className="text-xs text-brand-red">{guestErrors.document}</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

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
              className={getInputClassName(false)}
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
            <div className="space-y-1.5">
              <input
                value={address.label ?? ""}
                onChange={(event) =>
                  handleAddressFieldChange("label", event.target.value)
                }
                placeholder="Apelido do endereco"
                autoComplete="shipping address-line1"
                className={getInputClassName(false)}
              />
            </div>

            <div className="space-y-1.5">
              <input
                value={address.recipientName}
                onChange={(event) =>
                  handleAddressFieldChange("recipientName", event.target.value)
                }
                onBlur={() => handleAddressFieldBlur("recipientName")}
                placeholder="Destinatario"
                autoComplete="shipping name"
                className={getInputClassName(Boolean(addressErrors.recipientName))}
              />
              {addressErrors.recipientName ? (
                <p className="text-xs text-brand-red">
                  {addressErrors.recipientName}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <input
                value={address.recipientPhone}
                onChange={(event) =>
                  handleAddressFieldChange("recipientPhone", event.target.value)
                }
                onBlur={() => handleAddressFieldBlur("recipientPhone")}
                placeholder="Telefone"
                autoComplete="tel"
                inputMode="tel"
                maxLength={15}
                className={getInputClassName(Boolean(addressErrors.recipientPhone))}
              />
              {addressErrors.recipientPhone ? (
                <p className="text-xs text-brand-red">
                  {addressErrors.recipientPhone}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <input
                value={address.zipCode}
                onChange={(event) =>
                  handleAddressFieldChange("zipCode", event.target.value)
                }
                onBlur={() => {
                  handleAddressFieldBlur("zipCode");
                  void fetchCepData();
                }}
                placeholder="CEP"
                autoComplete="postal-code"
                inputMode="numeric"
                maxLength={9}
                className={getInputClassName(Boolean(addressErrors.zipCode))}
              />
              {addressErrors.zipCode ? (
                <p className="text-xs text-brand-red">{addressErrors.zipCode}</p>
              ) : null}
              {cepLoading ? (
                <div className="flex items-center gap-2 text-[11px] text-brand-gray-light">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-gray-light border-t-transparent" />
                  Buscando CEP...
                </div>
              ) : null}
              {cepError ? (
                <p className="text-xs text-brand-red">{cepError}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <input
                value={address.state}
                onChange={(event) =>
                  handleAddressFieldChange("state", event.target.value)
                }
                onBlur={() => handleAddressFieldBlur("state")}
                placeholder="UF"
                autoComplete="address-level1"
                maxLength={2}
                className={getInputClassName(Boolean(addressErrors.state))}
              />
              {addressErrors.state ? (
                <p className="text-xs text-brand-red">{addressErrors.state}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <input
                value={address.city}
                onChange={(event) =>
                  handleAddressFieldChange("city", event.target.value)
                }
                onBlur={() => handleAddressFieldBlur("city")}
                placeholder="Cidade"
                autoComplete="address-level2"
                className={getInputClassName(Boolean(addressErrors.city))}
              />
              {addressErrors.city ? (
                <p className="text-xs text-brand-red">{addressErrors.city}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <input
                value={address.district}
                onChange={(event) =>
                  handleAddressFieldChange("district", event.target.value)
                }
                onBlur={() => handleAddressFieldBlur("district")}
                placeholder="Bairro"
                autoComplete="address-level3"
                className={getInputClassName(Boolean(addressErrors.district))}
              />
              {addressErrors.district ? (
                <p className="text-xs text-brand-red">{addressErrors.district}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <input
                value={address.street}
                onChange={(event) =>
                  handleAddressFieldChange("street", event.target.value)
                }
                onBlur={() => handleAddressFieldBlur("street")}
                placeholder="Rua"
                autoComplete="street-address"
                className={getInputClassName(Boolean(addressErrors.street))}
              />
              {addressErrors.street ? (
                <p className="text-xs text-brand-red">{addressErrors.street}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <input
                value={address.number}
                onChange={(event) =>
                  handleAddressFieldChange("number", event.target.value)
                }
                onBlur={() => handleAddressFieldBlur("number")}
                placeholder="Numero"
                autoComplete="off"
                className={getInputClassName(Boolean(addressErrors.number))}
              />
              {addressErrors.number ? (
                <p className="text-xs text-brand-red">{addressErrors.number}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <input
                value={address.complement ?? ""}
                onChange={(event) =>
                  handleAddressFieldChange("complement", event.target.value)
                }
                placeholder="Complemento"
                autoComplete="address-line2"
                className={getInputClassName(false)}
              />
            </div>
          </div>

          {customer.authenticated ? (
            <label className="flex items-center gap-3 rounded-2xl border border-brand-gray-mid bg-brand-black/30 px-4 py-3 text-sm text-white">
              <input
                type="checkbox"
                checked={saveAddress}
                onChange={(event) => setSaveAddress(event.target.checked)}
                className="h-4 w-4 accent-brand-red"
              />
              Salvar endereco para as proximas compras.
            </label>
          ) : (
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 px-4 py-3 text-sm text-brand-gray-light">
              Seus dados de entrega vao valer apenas para este pedido.
            </div>
          )}
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
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={loadingQuotes}
            onClick={calculateShipping}
          >
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
                  <p className="mt-1 text-xs text-brand-gray-light">
                    {quote.description}
                  </p>
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
