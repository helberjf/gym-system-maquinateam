"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
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

  const inputClassName =
    "w-full rounded-lg border border-brand-gray-mid bg-brand-black px-3 py-2 text-sm text-white outline-none transition placeholder:text-brand-gray-light/50 focus:border-brand-red disabled:opacity-60";
  const readonlyInputClassName = `${inputClassName} cursor-not-allowed bg-brand-gray-mid/40`;
  const labelClassName =
    "text-[11px] font-medium uppercase tracking-[0.14em] text-brand-gray-light";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <span className={labelClassName}>
          Nome completo{" "}
          {form.name ? (
            <span className={nameValid ? "text-emerald-400" : "text-brand-red"}>
              {nameValid ? "OK" : "X"}
            </span>
          ) : null}
        </span>
        <input
          name="name"
          placeholder="Maria da Silva"
          value={form.name}
          onChange={handleChange}
          className={inputClassName}
          disabled={loading}
          required
        />
      </div>

      <div className="space-y-1">
        <span className={labelClassName}>E-mail</span>
        <input
          name="email"
          type="email"
          placeholder="email@exemplo.com"
          value={form.email}
          onChange={handleChange}
          className={inputClassName}
          disabled={loading}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className={labelClassName}>CPF</span>
          <input
            name="cpf"
            placeholder="000.000.000-00"
            value={form.cpf}
            onChange={handleChange}
            className={inputClassName}
            disabled={loading}
          />
        </div>

        <div className="space-y-1">
          <span className={labelClassName}>Genero</span>
          <select
            name="gender"
            value={form.gender}
            onChange={handleChange}
            className={inputClassName}
            disabled={loading}
          >
            <option value="MALE">Masculino</option>
            <option value="FEMALE">Feminino</option>
            <option value="OTHER">Outro</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-[72px_1fr] gap-3">
        <div className="space-y-1">
          <span className={labelClassName}>Pais</span>
          <select
            name="phoneCountry"
            value={form.phoneCountry}
            onChange={handleChange}
            className={inputClassName}
            disabled={loading}
          >
            <option value="BR">BR</option>
            <option value="US">US</option>
            <option value="OTHER">OUT</option>
          </select>
        </div>

        <div className="space-y-1">
          <span className={labelClassName}>Telefone</span>
          <div className="flex">
            {(form.phoneCountry === "BR" || form.phoneCountry === "US") && (
              <span className="rounded-l-lg border border-r-0 border-brand-gray-mid bg-brand-gray-mid/40 px-3 py-2 text-sm text-brand-gray-light">
                {form.phoneCountry === "BR" ? "+55" : "+1"}
              </span>
            )}

            <input
              name="phone"
              placeholder={
                form.phoneCountry === "OTHER"
                  ? "+351912345678"
                  : "Somente numeros"
              }
              value={form.phone}
              onChange={handleChange}
              className={`${inputClassName} ${
                form.phoneCountry !== "OTHER" ? "rounded-l-none" : ""
              }`}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <span className={labelClassName}>
          Nascimento <span className="normal-case text-brand-gray-light/60">(opcional)</span>
        </span>
        <input
          name="birthDate"
          type="date"
          value={form.birthDate}
          onChange={handleChange}
          className={inputClassName}
          disabled={loading}
        />
      </div>

      <div className="space-y-1">
        <span className={labelClassName}>
          CEP <span className="normal-case text-brand-gray-light/60">(opcional)</span>
        </span>
        <input
          name="zipCode"
          placeholder="00000-000"
          value={form.zipCode}
          onChange={handleChange}
          onBlur={fetchCep}
          className={inputClassName}
          disabled={loading}
        />

        {cepLoading ? (
          <div className="flex items-center gap-2 text-xs text-brand-gray-light">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-gray-light border-t-transparent" />
            Buscando CEP...
          </div>
        ) : null}

        {cepError ? <p className="text-xs text-brand-red">{cepError}</p> : null}
      </div>

      {cepReady ? (
        <>
          <div className="space-y-1">
            <span className={labelClassName}>Rua</span>
            <input
              name="street"
              value={form.street}
              onChange={handleChange}
              className={inputClassName}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-1">
            <span className={labelClassName}>Bairro</span>
            <input value={form.district} readOnly className={readonlyInputClassName} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className={labelClassName}>Cidade</span>
              <input value={form.city} readOnly className={readonlyInputClassName} />
            </div>

            <div className="space-y-1">
              <span className={labelClassName}>UF</span>
              <input value={form.state} readOnly className={readonlyInputClassName} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className={labelClassName}>Numero</span>
              <input
                name="number"
                placeholder="123"
                value={form.number}
                onChange={handleChange}
                className={inputClassName}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-1">
              <span className={labelClassName}>Complemento</span>
              <input
                name="complement"
                placeholder="Apto, casa"
                value={form.complement}
                onChange={handleChange}
                className={inputClassName}
                disabled={loading}
              />
            </div>
          </div>
        </>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <span className={labelClassName}>Senha</span>
          <input
            name="password"
            type="password"
            placeholder="Minimo de 8 caracteres"
            value={form.password}
            onChange={handleChange}
            className={inputClassName}
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-1">
          <span className={labelClassName}>
            Confirmar senha{" "}
            {form.confirm ? (
              <span className={confirmValid ? "text-emerald-400" : "text-brand-red"}>
                {confirmValid ? "OK" : "X"}
              </span>
            ) : null}
          </span>
          <input
            name="confirm"
            type="password"
            placeholder="Repita sua senha"
            value={form.confirm}
            onChange={handleChange}
            className={inputClassName}
            disabled={loading}
            required
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-white">
          {error}
        </div>
      ) : null}

      <div className="space-y-3 pt-2">
        <button
          type="submit"
          disabled={loading || !formValid}
          className="w-full rounded-xl bg-brand-red px-4 py-3 text-sm font-semibold text-black transition hover:bg-brand-red-dark disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/40 border-t-black" />
              Criando...
            </span>
          ) : (
            "Criar conta"
          )}
        </button>

        <p className="text-center text-sm text-brand-gray-light">
          Ja tem conta?{" "}
          <Link href="/login" className="font-semibold text-brand-red hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </form>
  );
}
