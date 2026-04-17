"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AUTH_ERROR_CODES, getAuthErrorMessage } from "@/lib/auth/error-codes";
import {
  sanitizeCallbackUrl,
  sanitizeClientRedirectUrl,
} from "@/lib/auth/callback-url";
import { type LoginInput, loginSchema } from "@/lib/auth/validation";
import {
  authInputClassName,
  authPrimaryButtonClassName,
  authSecondaryButtonClassName,
} from "@/components/auth/styles";

type LoginFormProps = {
  googleEnabled: boolean;
};

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.27-2.09 3.57-5.18 3.57-8.64Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.76-2.11-6.7-4.95H1.3v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.29A7.18 7.18 0 0 1 4.93 12c0-.8.14-1.58.37-2.29V6.62H1.3A11.99 11.99 0 0 0 0 12c0 1.93.46 3.75 1.3 5.38l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.61 4.58 1.81l3.44-3.44C17.94 1.18 15.24 0 12 0A11.99 11.99 0 0 0 1.3 6.62l4 3.09c.94-2.84 3.58-4.95 6.7-4.95Z"
      />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      {open ? (
        <>
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      )}
    </svg>
  );
}

export function LoginForm({ googleEnabled }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"), "/dashboard");

  useEffect(() => {
    if (!searchParams.get("password")) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("password");

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/login?${nextQuery}` : "/login");
  }, [router, searchParams]);

  const initialMessage = useMemo(() => {
    if (searchParams.get("verified") === "1") {
      return "E-mail confirmado com sucesso. Agora voce ja pode entrar.";
    }

    if (searchParams.get("reset") === "1") {
      return "Senha redefinida com sucesso. Entre com sua nova senha.";
    }

    if (searchParams.get("registered") === "1") {
      return "Conta criada. Confirme seu e-mail para fazer login.";
    }

    return null;
  }, [searchParams]);

  const routeError = getAuthErrorMessage(searchParams.get("error"));
  const [message, setMessage] = useState<string | null>(initialMessage);
  const [error, setError] = useState<string | null>(routeError);
  const [showResend, setShowResend] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: searchParams.get("email") ?? "",
      password: "",
    },
  });

  async function onSubmit(data: LoginInput) {
    setLoading(true);
    setError(null);
    setMessage(null);
    setShowResend(false);

    const result = (await signIn("credentials", {
      redirect: false,
      email: data.email,
      password: data.password,
      callbackUrl,
    })) as { error?: string | null; code?: string | null; url?: string | null } | undefined;

    setLoading(false);

    const errorCode = result?.code ?? result?.error;

    if (errorCode) {
      const nextError = getAuthErrorMessage(errorCode) ?? "Nao foi possivel entrar.";
      setError(nextError);
      toast.error(nextError);
      setShowResend(errorCode === AUTH_ERROR_CODES.emailNotVerified);
      return;
    }

    toast.success("Login realizado com sucesso.");
    router.push(sanitizeClientRedirectUrl(result?.url, callbackUrl));
    router.refresh();
  }

  function handleGoogleLogin() {
    setGoogleLoading(true);
    setError(null);
    setMessage(null);
    void signIn("google", { callbackUrl });
  }

  const email = watch("email");
  const busy = loading || googleLoading;
  const labelClassName =
    "text-xs font-medium uppercase tracking-[0.18em] text-brand-gray-light";

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className={labelClassName}>
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            className={authInputClassName}
            disabled={busy}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-brand-red">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="password" className={labelClassName}>
              Senha
            </label>
            <Link
              href="/esqueci-senha"
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-brand-red transition hover:text-brand-white"
            >
              Esqueci
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Sua senha"
              className={`${authInputClassName} pr-12`}
              disabled={busy}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              disabled={busy}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-brand-gray-light transition hover:text-brand-white disabled:opacity-40"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-brand-red">{errors.password.message}</p>
          )}
        </div>

        {message && (
          <div className="rounded-xl border border-brand-white/15 bg-brand-white/5 px-4 py-3 text-sm text-brand-white">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-white">
            {error}
          </div>
        )}

        {showResend && (
          <p className="text-xs text-brand-gray-light">
            Precisa de um novo link?{" "}
            <Link
              href={`/reenvio-confirmacao?email=${encodeURIComponent(email ?? "")}`}
              className="text-brand-red hover:underline"
            >
              Reenviar confirmacao
            </Link>
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className={authPrimaryButtonClassName}
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/40 border-t-black" />
              Entrando...
            </span>
          ) : (
            "Entrar"
          )}
        </button>
      </form>

      <div className="relative">
        <div aria-hidden="true" className="absolute inset-0 flex items-center">
          <span className="h-px w-full bg-brand-gray-mid" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-brand-gray-dark px-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-gray-light">
            ou
          </span>
        </div>
      </div>

      {googleEnabled ? (
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={busy}
          className={`${authSecondaryButtonClassName} inline-flex items-center justify-center gap-3`}
        >
          {googleLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-gray-light border-t-white" />
          ) : (
            <GoogleLogo />
          )}
          {googleLoading ? "Conectando..." : "Continuar com Google"}
        </button>
      ) : (
        <p className="rounded-xl border border-dashed border-brand-gray-mid bg-brand-black/60 px-4 py-3 text-center text-xs text-brand-gray-light">
          Login com Google disponivel assim que configurarmos as credenciais.
        </p>
      )}

      <p className="text-center text-sm text-brand-gray-light">
        Nao tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-brand-red hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
