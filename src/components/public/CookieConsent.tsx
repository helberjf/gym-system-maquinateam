"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "mqt:cookie-consent:v1";

type Consent = "accepted" | "rejected";

function readStoredConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

function writeConsent(value: Consent) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage indisponivel (modo privado, quotas): silenciar — banner so reaparece.
  }
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readStoredConsent() === null) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleChoice = (choice: Consent) => {
    writeConsent(choice);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-brand-gray-mid bg-brand-black/95 p-4 text-sm text-brand-gray-light shadow-[0_20px_80px_rgba(0,0,0,0.5)] backdrop-blur sm:inset-x-6 sm:bottom-6 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-6">
          Utilizamos cookies essenciais para autenticacao, carrinho e pagamentos,
          alem de cookies opcionais de desempenho e preferencias. Ao aceitar, voce
          concorda com o uso conforme nossa{" "}
          <Link
            href="/politica-de-privacidade"
            className="text-white underline underline-offset-4"
          >
            Politica de Privacidade
          </Link>
          .
        </p>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => handleChoice("rejected")}
            className="rounded-full border border-brand-gray-mid px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-gray-light transition hover:border-white hover:text-white"
          >
            Recusar opcionais
          </button>
          <button
            type="button"
            onClick={() => handleChoice("accepted")}
            className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-brand-gray-light"
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}
