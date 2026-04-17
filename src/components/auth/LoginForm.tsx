"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  authErrorMessageClassName,
  authFooterLinkClassName,
  authHintTextClassName,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
  authSecondaryButtonClassName,
  authSuccessMessageClassName,
} from "@/components/auth/styles";
import { AUTH_ERROR_CODES, getAuthErrorMessage } from "@/lib/auth/error-codes";
import {
  sanitizeCallbackUrl,
  sanitizeClientRedirectUrl,
} from "@/lib/auth/callback-url";
import { type LoginInput, loginSchema } from "@/lib/auth/validation";

type LoginFormProps = {
  googleEnabled: boolean;
};

function GoogleLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
    >
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
    if (!googleEnabled) {
      return;
    }

    setGoogleLoading(true);
    setError(null);
    setMessage(null);
    void signIn("google", { callbackUrl });
  }

  const email = watch("email");

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className={authLabelClassName}>
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            className={authInputClassName}
            disabled={loading || googleLoading}
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-xs text-brand-white">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className={authLabelClassName}>
              Senha
            </label>
            <Link href="/esqueci-senha" className={authFooterLinkClassName}>
              Esqueci minha senha
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Digite sua senha"
            className={authInputClassName}
            disabled={loading || googleLoading}
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-xs text-brand-white">{errors.password.message}</p>
          ) : null}
        </div>

        {message ? (
          <div className={authSuccessMessageClassName}>{message}</div>
        ) : null}

        {error ? <div className={authErrorMessageClassName}>{error}</div> : null}

        {showResend ? (
          <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className={authHintTextClassName}>
              Precisa de um novo link?{" "}
              <Link
                href={`/reenvio-confirmacao?email=${encodeURIComponent(email ?? "")}`}
                className={authFooterLinkClassName}
              >
                Reenviar confirmacao
              </Link>
            </p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className={authPrimaryButtonClassName}
        >
          {loading ? "Entrando..." : "Entrar agora"}
        </button>
      </form>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center">
          <span className="rounded-full border border-white/10 bg-brand-black px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-gray-light">
            ou continue com
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={!googleEnabled || loading || googleLoading}
          className={authSecondaryButtonClassName}
        >
          {googleLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <GoogleLogo />
          )}
          {googleLoading ? "Conectando..." : "Continuar com Google"}
        </button>

        {!googleEnabled ? (
          <p className={authHintTextClassName}>
            O botao foi mantido no layout e fica ativo assim que a integracao do
            Google estiver configurada no ambiente.
          </p>
        ) : null}
      </div>

      <nav
        className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-brand-gray-light"
        aria-label="Links auxiliares de autenticacao"
      >
        Nao tem conta?{" "}
        <Link href="/cadastro" className={authFooterLinkClassName}>
          Criar conta
        </Link>
      </nav>
    </div>
  );
}
