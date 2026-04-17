"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#0A0A0A] text-white antialiased">
        <main className="flex min-h-screen items-center justify-center px-6 py-16">
          <div className="w-full max-w-xl rounded-3xl border border-[#2D2D2D] bg-[#1A1A1A] p-8 text-center shadow-2xl sm:rounded-[2rem] sm:p-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#C8102E] sm:text-xs">
              Erro critico
            </p>
            <h1 className="mt-4 text-3xl font-black uppercase text-white sm:text-4xl">
              Algo saiu do previsto
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#6B7280]">
              Nao foi possivel carregar esta pagina. Tente novamente ou volte para
              o inicio. Nosso time ja foi notificado.
            </p>

            {error.digest ? (
              <p className="mt-4 text-[11px] font-mono uppercase tracking-wider text-[#6B7280]">
                Codigo: {error.digest}
              </p>
            ) : null}

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={reset}
                className="rounded-xl bg-[#C8102E] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#8B0000]"
              >
                Tentar de novo
              </button>
              <a
                href="/"
                className="rounded-xl border border-[#2D2D2D] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2D2D2D]"
              >
                Voltar ao inicio
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
