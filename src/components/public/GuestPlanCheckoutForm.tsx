"use client";

import { startTransition, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  authErrorMessageClassName,
  authHintTextClassName,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/styles";
import { formatCpf, formatPhoneBR, onlyDigits } from "@/lib/utils/formatters";

type PaymentChoice = "PIX" | "CREDIT_CARD";

type FormState = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  password: string;
  paymentMethod: PaymentChoice;
  acceptTerms: boolean;
};

type GuestPlanCheckoutFormProps = {
  planId: string;
  className?: string;
};

const INITIAL_STATE: FormState = {
  name: "",
  email: "",
  phone: "",
  cpf: "",
  password: "",
  paymentMethod: "PIX",
  acceptTerms: false,
};

function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

function isStrongPassword(value: string) {
  return (
    value.length >= 8 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value)
  );
}

export function GuestPlanCheckoutForm({
  planId,
  className,
}: GuestPlanCheckoutFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cpfDigits = onlyDigits(form.cpf);
  const phoneDigits = onlyDigits(form.phone);

  const nameValid = form.name.trim().split(/\s+/).length >= 2;
  const emailValid = isValidEmail(form.email);
  const cpfValid = cpfDigits.length === 11;
  const phoneValid = phoneDigits.length >= 10;
  const passwordValid = isStrongPassword(form.password);

  const formValid =
    nameValid &&
    emailValid &&
    cpfValid &&
    phoneValid &&
    passwordValid &&
    form.acceptTerms;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formValid) {
      setError("Confira os campos destacados antes de continuar.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/plans/${planId}/guest-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          cpf: cpfDigits,
          password: form.password,
          paymentMethod: form.paymentMethod,
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
        const message =
          payload?.error ??
          "Nao foi possivel iniciar o pagamento agora. Tente novamente.";
        setError(message);
        toast.error(message);
        setLoading(false);
        return;
      }

      toast.success("Conta criada. Redirecionando para o pagamento...");
      startTransition(() => {
        window.location.assign(payload.redirectUrl!);
      });
    } catch {
      const message =
        "Nao foi possivel iniciar o pagamento agora. Verifique sua conexao.";
      setError(message);
      toast.error(message);
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={["space-y-4", className ?? ""].join(" ").trim()}
      noValidate
    >
      <div className="space-y-2">
        <label htmlFor="guest-name" className={authLabelClassName}>
          Nome completo
        </label>
        <input
          id="guest-name"
          name="name"
          autoComplete="name"
          value={form.name}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, name: event.target.value }))
          }
          className={authInputClassName}
          placeholder="Seu nome e sobrenome"
          required
          aria-invalid={form.name.length > 0 && !nameValid}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="guest-email" className={authLabelClassName}>
            E-mail
          </label>
          <input
            id="guest-email"
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, email: event.target.value }))
            }
            className={authInputClassName}
            placeholder="voce@exemplo.com"
            required
            aria-invalid={form.email.length > 0 && !emailValid}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="guest-phone" className={authLabelClassName}>
            WhatsApp / Telefone
          </label>
          <input
            id="guest-phone"
            type="tel"
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                phone: formatPhoneBR(event.target.value),
              }))
            }
            className={authInputClassName}
            placeholder="(32) 99999-9999"
            required
            aria-invalid={form.phone.length > 0 && !phoneValid}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="guest-cpf" className={authLabelClassName}>
            CPF
          </label>
          <input
            id="guest-cpf"
            name="cpf"
            inputMode="numeric"
            value={form.cpf}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                cpf: formatCpf(event.target.value),
              }))
            }
            className={authInputClassName}
            placeholder="000.000.000-00"
            required
            aria-invalid={form.cpf.length > 0 && !cpfValid}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="guest-password" className={authLabelClassName}>
            Crie uma senha
          </label>
          <input
            id="guest-password"
            type="password"
            name="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, password: event.target.value }))
            }
            className={authInputClassName}
            placeholder="Min. 8, 1 maiuscula, 1 numero"
            required
            aria-invalid={form.password.length > 0 && !passwordValid}
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className={authLabelClassName}>Forma de pagamento</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "PIX" as const, label: "Pix", hint: "AbacatePay" },
            {
              value: "CREDIT_CARD" as const,
              label: "Cartao",
              hint: "Mercado Pago",
            },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                setForm((prev) => ({ ...prev, paymentMethod: option.value }))
              }
              className={[
                "rounded-2xl border px-3 py-3 text-left transition",
                form.paymentMethod === option.value
                  ? "border-white bg-white text-black shadow-[0_12px_30px_rgba(255,255,255,0.08)]"
                  : "border-brand-gray-mid bg-brand-black/30 text-brand-gray-light hover:border-white/25",
              ].join(" ")}
            >
              <span className="block text-sm font-semibold uppercase">
                {option.label}
              </span>
              <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] opacity-70">
                {option.hint}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-2 text-xs leading-6 text-brand-gray-light">
        <input
          type="checkbox"
          checked={form.acceptTerms}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, acceptTerms: event.target.checked }))
          }
          className="mt-1 h-4 w-4 rounded border-white/20 bg-white/[0.04] accent-white"
        />
        <span>
          Li e aceito a{" "}
          <a
            href="/politica-de-privacidade"
            className="text-white underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Politica de Privacidade
          </a>{" "}
          e os{" "}
          <a
            href="/termos-de-uso"
            className="text-white underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Termos de Uso
          </a>
          .
        </span>
      </label>

      {error ? <p className={authErrorMessageClassName}>{error}</p> : null}

      <button
        type="submit"
        disabled={!formValid || loading}
        className={authPrimaryButtonClassName}
      >
        {loading
          ? "Processando..."
          : form.paymentMethod === "PIX"
            ? "Pagar com Pix"
            : "Ir para o Mercado Pago"}
      </button>

      <p className={authHintTextClassName}>
        Apos o pagamento, voce pode acessar o painel com o e-mail e a senha
        criados aqui.
      </p>
    </form>
  );
}
