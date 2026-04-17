"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  authErrorMessageClassName,
  authFooterLinkClassName,
  authHintTextClassName,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
  authReadonlyInputClassName,
} from "@/components/auth/styles";
import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import {
  formatCpf,
  formatPhoneBR,
  formatStateUf,
  formatZipCodeBR,
  onlyDigits,
} from "@/lib/utils/formatters";

type PhoneCountry = "BR" | "US" | "OTHER";
type GenderOption = "MALE" | "FEMALE" | "OTHER";

type RegisterFormState = {
  name: string;
  email: string;
  password: string;
  confirm: string;
  birthDate: string;
  gender: GenderOption;
  cpf: string;
  phoneCountry: PhoneCountry;
  phone: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

function hasSurname(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 && parts.every((part) => part.length >= 2);
}

function normalizePhoneForSubmit(country: PhoneCountry, value: string) {
  const digits = onlyDigits(value);

  if (digits.length < 7) {
    return undefined;
  }

  if (country === "BR") {
    return formatPhoneBR(digits);
  }

  if (country === "US") {
    return `+1${digits}`;
  }

  return value.trim();
}

const formSectionClassName =
  "space-y-4 rounded-[1.45rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5";

const formSectionTitleClassName =
  "text-xs font-semibold uppercase tracking-[0.22em] text-brand-white";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(
    searchParams.get("callbackUrl"),
    "/dashboard",
  );
  const [form, setForm] = useState<RegisterFormState>({
    name: "",
    email: "",
    password: "",
    confirm: "",
    birthDate: "",
    gender: "MALE",
    cpf: "",
    phoneCountry: "BR",
    phone: "",
    zipCode: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const cepDigits = onlyDigits(form.zipCode);
  const cepReady = cepDigits.length === 8 && !cepError;
  const nameValid = hasSurname(form.name);
  const emailValid = form.email.trim().length > 3;
  const passwordValid = form.password.length >= 8;
  const confirmValid = passwordValid && form.password === form.confirm;
  const formValid = nameValid && emailValid && passwordValid && confirmValid;

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;

    if (name === "zipCode") {
      setCepError(null);
    }

    setForm((previous) => {
      if (name === "cpf") {
        return { ...previous, cpf: formatCpf(value) };
      }

      if (name === "zipCode") {
        return {
          ...previous,
          zipCode: formatZipCodeBR(value),
        };
      }

      if (name === "state") {
        return {
          ...previous,
          state: formatStateUf(value),
        };
      }

      if (name === "phoneCountry") {
        const nextCountry = value as PhoneCountry;
        const phoneDigits = onlyDigits(previous.phone);
        const nextPhone =
          nextCountry === "BR" ? formatPhoneBR(phoneDigits) : phoneDigits;

        return {
          ...previous,
          phoneCountry: nextCountry,
          phone: nextPhone,
        };
      }

      if (name === "phone") {
        return {
          ...previous,
          phone:
            previous.phoneCountry === "BR" ? formatPhoneBR(value) : value,
        };
      }

      return {
        ...previous,
        [name]: value,
      };
    });
  }

  async function fetchCep() {
    if (cepDigits.length !== 8) {
      return;
    }

    setCepLoading(true);
    setCepError(null);

    try {
      const response = await fetch(`/api/cep?cep=${cepDigits}`);
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            street?: string;
            district?: string;
            city?: string;
            state?: string;
            complement?: string;
          }
        | null;

      if (!response.ok || !payload?.ok) {
        setCepError(payload?.error ?? "CEP nao encontrado");
        return;
      }

      setForm((previous) => ({
        ...previous,
        street: payload.street ?? "",
        district: payload.district ?? "",
        city: payload.city ?? "",
        state: payload.state ?? "",
        complement: previous.complement || payload.complement || "",
      }));
    } catch {
      setCepError("Erro ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!formValid) {
      return;
    }

    setLoading(true);

    try {
      const phone = normalizePhoneForSubmit(form.phoneCountry, form.phone);
      const hasAddress =
        cepReady &&
        Boolean(
          form.street.trim() &&
            form.number.trim() &&
            form.district.trim() &&
            form.city.trim() &&
            form.state.trim(),
        );

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          confirmPassword: form.confirm,
          cpf: form.cpf || undefined,
          phone,
          birthDate: form.birthDate || undefined,
          ...(hasAddress
            ? {
                zipCode: cepDigits,
                street: form.street,
                number: form.number,
                complement: form.complement || undefined,
                district: form.district,
                city: form.city,
                state: form.state,
              }
            : {}),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; email?: string; emailSent?: boolean }
        | null;

      if (!response.ok || !payload?.ok) {
        const nextError = payload?.error ?? "Erro ao registrar.";
        setError(nextError);
        toast.error(nextError);
        return;
      }

      toast.success(
        payload.emailSent
          ? "Conta criada. Verifique seu e-mail."
          : "Conta criada. Use o reenvio de confirmacao se precisar.",
      );

      const params = new URLSearchParams({
        email: payload.email ?? form.email,
        sent: payload.emailSent ? "1" : "0",
      });

      if (callbackUrl !== "/dashboard") {
        params.set("callbackUrl", callbackUrl);
      }

      router.push(`/confirmar-email?${params.toString()}`);
      router.refresh();
    } catch {
      setError("Erro ao registrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className={formSectionClassName}>
        <div>
          <p className={formSectionTitleClassName}>Conta</p>
          <p className={`${authHintTextClassName} mt-2`}>
            Comece com seus dados principais para liberar o acesso.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="name" className={authLabelClassName}>
              Nome completo
            </label>
            {form.name ? (
              <span className="text-[11px] text-brand-gray-light">
                {nameValid ? "Nome completo ok" : "Adicione nome e sobrenome"}
              </span>
            ) : null}
          </div>
          <input
            id="name"
            name="name"
            placeholder="Maria da Silva"
            value={form.name}
            onChange={handleChange}
            className={authInputClassName}
            disabled={loading}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="email" className={authLabelClassName}>
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="email@exemplo.com"
              value={form.email}
              onChange={handleChange}
              className={authInputClassName}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="birthDate" className={authLabelClassName}>
              Data de nascimento
            </label>
            <input
              id="birthDate"
              name="birthDate"
              type="date"
              value={form.birthDate}
              onChange={handleChange}
              className={authInputClassName}
              disabled={loading}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="password" className={authLabelClassName}>
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Minimo de 8 caracteres"
              value={form.password}
              onChange={handleChange}
              className={authInputClassName}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm" className={authLabelClassName}>
              Confirmar senha
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              placeholder="Repita sua senha"
              value={form.confirm}
              onChange={handleChange}
              className={authInputClassName}
              disabled={loading}
              required
            />
          </div>
        </div>

        {!confirmValid && form.confirm ? (
          <p className="text-xs text-brand-white">
            As senhas precisam ser iguais para continuar.
          </p>
        ) : null}
      </div>

      <div className={formSectionClassName}>
        <div>
          <p className={formSectionTitleClassName}>Perfil</p>
          <p className={`${authHintTextClassName} mt-2`}>
            Campos opcionais para deixar o cadastro mais completo desde o inicio.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="cpf" className={authLabelClassName}>
              CPF
            </label>
            <input
              id="cpf"
              name="cpf"
              placeholder="000.000.000-00"
              value={form.cpf}
              onChange={handleChange}
              className={authInputClassName}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="gender" className={authLabelClassName}>
              Genero
            </label>
            <select
              id="gender"
              name="gender"
              value={form.gender}
              onChange={handleChange}
              className={authInputClassName}
              disabled={loading}
            >
              <option value="MALE">Masculino</option>
              <option value="FEMALE">Feminino</option>
              <option value="OTHER">Outro</option>
            </select>
          </div>
        </div>
      </div>

      <div className={formSectionClassName}>
        <div>
          <p className={formSectionTitleClassName}>Contato e endereco</p>
          <p className={`${authHintTextClassName} mt-2`}>
            O telefone e o CEP ajudam a equipe a acelerar atendimento e cobranca.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <label htmlFor="phoneCountry" className={authLabelClassName}>
              Pais
            </label>
            <select
              id="phoneCountry"
              name="phoneCountry"
              value={form.phoneCountry}
              onChange={handleChange}
              className={authInputClassName}
              disabled={loading}
            >
              <option value="BR">BR</option>
              <option value="US">US</option>
              <option value="OTHER">OUT</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="phone" className={authLabelClassName}>
              Telefone
            </label>
            <div className="flex">
              {(form.phoneCountry === "BR" || form.phoneCountry === "US") && (
                <span className="rounded-l-[1.1rem] border border-r-0 border-white/10 bg-white/[0.06] px-4 py-3.5 text-sm text-brand-gray-light">
                  {form.phoneCountry === "BR" ? "+55" : "+1"}
                </span>
              )}

              <input
                id="phone"
                name="phone"
                placeholder={
                  form.phoneCountry === "OTHER"
                    ? "+351912345678"
                    : "Somente numeros"
                }
                value={form.phone}
                onChange={handleChange}
                className={`${authInputClassName} ${
                  form.phoneCountry !== "OTHER" ? "rounded-l-none" : ""
                }`}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="zipCode" className={authLabelClassName}>
            CEP
          </label>
          <input
            id="zipCode"
            name="zipCode"
            placeholder="00000-000"
            value={form.zipCode}
            onChange={handleChange}
            onBlur={fetchCep}
            className={authInputClassName}
            disabled={loading}
          />

          {cepLoading ? (
            <div className="flex items-center gap-2 text-xs text-brand-gray-light">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Buscando CEP...
            </div>
          ) : null}

          {cepError ? (
            <p className="text-xs text-brand-white">{cepError}</p>
          ) : null}
        </div>

        {cepReady ? (
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <label htmlFor="street" className={authLabelClassName}>
                Rua
              </label>
              <input
                id="street"
                name="street"
                value={form.street}
                onChange={handleChange}
                className={authInputClassName}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="district" className={authLabelClassName}>
                Bairro
              </label>
              <input
                id="district"
                value={form.district}
                readOnly
                className={authReadonlyInputClassName}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="city" className={authLabelClassName}>
                  Cidade
                </label>
                <input
                  id="city"
                  value={form.city}
                  readOnly
                  className={authReadonlyInputClassName}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="state" className={authLabelClassName}>
                  UF
                </label>
                <input
                  id="state"
                  value={form.state}
                  readOnly
                  className={authReadonlyInputClassName}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="number" className={authLabelClassName}>
                  Numero
                </label>
                <input
                  id="number"
                  name="number"
                  placeholder="123"
                  value={form.number}
                  onChange={handleChange}
                  className={authInputClassName}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="complement" className={authLabelClassName}>
                  Complemento
                </label>
                <input
                  id="complement"
                  name="complement"
                  placeholder="Apto, casa, bloco"
                  value={form.complement}
                  onChange={handleChange}
                  className={authInputClassName}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {error ? <div className={authErrorMessageClassName}>{error}</div> : null}

      <div className="space-y-3 rounded-[1.45rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <button
          type="submit"
          disabled={loading || !formValid}
          className={authPrimaryButtonClassName}
        >
          {loading ? "Criando conta..." : "Criar conta"}
        </button>

        <p className={`${authHintTextClassName} text-center`}>
          Ja tem conta?{" "}
          <Link href="/login" className={authFooterLinkClassName}>
            Entrar
          </Link>
        </p>
      </div>
    </form>
  );
}
