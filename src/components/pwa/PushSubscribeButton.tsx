"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type Status = "loading" | "unsupported" | "denied" | "subscribed" | "idle";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function PushSubscribeButton() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setStatus(existing ? "subscribed" : "idle");
      } catch {
        if (!cancelled) setStatus("idle");
      }
    }
    void probe();
    return () => {
      cancelled = true;
    };
  }, []);

  async function subscribe() {
    setBusy(true);
    try {
      const keyResp = await fetch("/api/push/public-key");
      const keyData = (await keyResp.json()) as {
        ok?: boolean;
        publicKey?: string | null;
      };
      if (!keyData.ok || !keyData.publicKey) {
        toast.error("Push nao configurado neste ambiente.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "idle");
        toast.error("Permissao para notificacoes negada.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const applicationServerKey = urlBase64ToUint8Array(keyData.publicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast: TS lib.dom narrows to ArrayBuffer, but Uint8Array.buffer is
        // ArrayBufferLike. Browsers accept Uint8Array directly.
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      });

      const json = sub.toJSON();
      const p256dh = json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey("p256dh"));
      const auth = json.keys?.auth ?? arrayBufferToBase64(sub.getKey("auth"));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh, auth },
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Falha ao salvar inscricao.");
      }
      setStatus("subscribed");
      toast.success("Notificacoes ativadas neste dispositivo.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel ativar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("idle");
      toast.success("Notificacoes desativadas neste dispositivo.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel desativar.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <button
        type="button"
        disabled
        className="rounded-xl border border-brand-gray-mid bg-brand-black/40 px-4 py-2 text-sm font-semibold text-brand-gray-light"
      >
        Carregando...
      </button>
    );
  }

  if (status === "unsupported") {
    return (
      <p className="text-xs text-brand-gray-light">
        Este dispositivo/navegador nao suporta notificacoes push.
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="text-xs text-brand-gray-light">
        Permissao de notificacao bloqueada nas preferencias do navegador.
      </p>
    );
  }

  return status === "subscribed" ? (
    <button
      type="button"
      onClick={unsubscribe}
      disabled={busy}
      className="rounded-xl border border-brand-white/20 bg-brand-white/5 px-4 py-2 text-sm font-semibold text-brand-white hover:bg-brand-white/10 disabled:opacity-60"
    >
      Desativar push
    </button>
  ) : (
    <button
      type="button"
      onClick={subscribe}
      disabled={busy}
      className="rounded-xl bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-60"
    >
      Ativar notificacoes push
    </button>
  );
}
