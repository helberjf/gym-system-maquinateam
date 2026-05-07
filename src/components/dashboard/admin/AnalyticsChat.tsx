"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { textareaClassName } from "@/components/dashboard/styles";

type Message = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "mqt_analytics_chat_v1";
const STORAGE_TTL_MS = 30 * 60 * 1000;

const QUICK_PROMPTS = [
  "Quantos alunos ativos temos?",
  "Resumo financeiro do mes",
  "Quem esta com pagamento atrasado?",
  "Top 5 turmas por presenca nos ultimos 30 dias",
  "Pipeline de leads",
];

type Stored = { savedAt: number; messages: Message[] };

function loadHistory(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > STORAGE_TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return parsed.messages ?? [];
  } catch {
    return [];
  }
}

function saveHistory(messages: Message[]) {
  if (typeof window === "undefined") return;
  const payload: Stored = { savedAt: Date.now(), messages };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function AnalyticsChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(loadHistory());
  }, []);

  useEffect(() => {
    saveHistory(messages);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || pending) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/admin/analytics-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: next.slice(-10).slice(0, -1),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        toolsUsed?: string[];
        error?: string;
      };
      if (!res.ok || !data.ok || !data.reply) {
        throw new Error(data.error ?? "Erro ao consultar IA.");
      }
      setMessages([
        ...next,
        { role: "assistant", content: data.reply },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao consultar IA.";
      toast.error(message);
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `Falha: ${message}. Tente novamente em instantes.`,
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  function clearChat() {
    setMessages([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={pending}
            onClick={() => send(prompt)}
            className="rounded-full border border-brand-white/20 bg-brand-white/5 px-3 py-1.5 text-xs text-brand-white hover:bg-brand-white/10 disabled:opacity-60"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="h-[420px] overflow-y-auto rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4 text-sm"
      >
        {messages.length === 0 ? (
          <p className="text-brand-gray-light">
            Pergunte algo sobre o negocio. Ex.: vendas, presenca, leads.
          </p>
        ) : (
          <ul className="space-y-3">
            {messages.map((message, index) => (
              <li
                key={index}
                className={[
                  "rounded-2xl border px-4 py-3",
                  message.role === "user"
                    ? "ml-8 border-brand-red/30 bg-brand-red/10 text-white"
                    : "mr-8 border-brand-white/15 bg-brand-white/5 text-white",
                ].join(" ")}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-light">
                  {message.role === "user" ? "Voce" : "Maquina IA"}
                </p>
                <pre className="mt-1 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {message.content}
                </pre>
              </li>
            ))}
            {pending ? (
              <li className="mr-8 rounded-2xl border border-brand-white/15 bg-brand-white/5 px-4 py-3 text-brand-gray-light">
                Consultando dados...
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className="space-y-3"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ex.: 'quantas matriculas fechamos este mes?'"
          maxLength={2000}
          disabled={pending}
          className={textareaClassName}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void send(input);
            }
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-gray-light">
          <span>Sessao salva localmente por 30 min. Ctrl+Enter envia.</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearChat}
              disabled={pending}
              className="rounded-xl border border-brand-gray-mid bg-brand-black/60 px-3 py-2 text-xs font-semibold text-brand-gray-light hover:text-white disabled:opacity-60"
            >
              Limpar conversa
            </button>
            <Button type="submit" size="md" loading={pending}>
              Enviar
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
