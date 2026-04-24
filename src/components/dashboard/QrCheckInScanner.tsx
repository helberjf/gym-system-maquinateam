"use client";

import { BrowserQRCodeReader } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import {
  inputClassName,
  labelClassName,
} from "@/components/dashboard/styles";

type Option = { id: string; label: string };

type ScannerProps = {
  scheduleOptions: Option[];
};

type LastResult = {
  ok: boolean;
  message: string;
};

export function QrCheckInScanner({ scheduleOptions }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const cooldownRef = useRef<string>("");
  const [scheduleId, setScheduleId] = useState(
    scheduleOptions[0]?.id ?? "",
  );
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  useEffect(() => {
    return () => {
      stopRef.current?.();
    };
  }, []);

  async function handleToken(token: string) {
    if (!scheduleId) {
      toast.error("Selecione uma turma antes de escanear.");
      return;
    }
    if (submitting) {
      return;
    }
    if (cooldownRef.current === token) {
      return;
    }
    cooldownRef.current = token;
    setSubmitting(true);

    try {
      const response = await fetch("/api/attendance/check-in-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, classScheduleId: scheduleId }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; message?: string }
        | null;

      if (!response.ok || !data?.ok) {
        const errorMsg = data?.error ?? "Nao foi possivel registrar check-in.";
        setLastResult({ ok: false, message: errorMsg });
        toast.error(errorMsg);
      } else {
        const msg = data.message ?? "Check-in registrado.";
        setLastResult({ ok: true, message: msg });
        toast.success(msg);
      }
    } catch {
      const msg = "Falha de rede ao enviar check-in.";
      setLastResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setTimeout(() => {
        cooldownRef.current = "";
      }, 4000);
    }
  }

  async function startScanner() {
    if (scanning) {
      return;
    }
    if (!videoRef.current) {
      return;
    }

    setLastResult(null);

    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error) => {
          if (result) {
            void handleToken(result.getText());
          }
          if (error && error.name !== "NotFoundException") {
            // Ignore noisy not-found frames.
          }
        },
      );
      stopRef.current = () => controls.stop();
      setScanning(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel acessar a camera.";
      toast.error(message);
    }
  }

  function stopScanner() {
    stopRef.current?.();
    stopRef.current = null;
    setScanning(false);
  }

  return (
    <section className="space-y-5 rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
      <div className="space-y-2">
        <label htmlFor="schedule" className={labelClassName}>
          Turma
        </label>
        <select
          id="schedule"
          value={scheduleId}
          onChange={(event) => setScheduleId(event.target.value)}
          className={inputClassName}
        >
          {scheduleOptions.length === 0 ? (
            <option value="">Nenhuma turma ativa disponivel</option>
          ) : null}
          {scheduleOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-3xl border border-brand-gray-mid bg-black">
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full object-cover"
          muted
          playsInline
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {scanning ? (
          <Button type="button" variant="secondary" onClick={stopScanner}>
            Parar camera
          </Button>
        ) : (
          <Button
            type="button"
            onClick={startScanner}
            disabled={!scheduleId}
          >
            Iniciar scanner
          </Button>
        )}
        {submitting ? (
          <span className="text-sm text-brand-gray-light">Enviando...</span>
        ) : null}
      </div>

      {lastResult ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            lastResult.ok
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-brand-red/40 bg-brand-red/10 text-brand-red"
          }`}
        >
          {lastResult.message}
        </div>
      ) : null}
    </section>
  );
}
