"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import {
  inputClassName,
  labelClassName,
  textareaClassName,
} from "@/components/dashboard/styles";
import { useApiMutation } from "@/components/dashboard/useApiMutation";

type CategoryOption = { value: string; label: string };

type ExpenseFormProps = {
  categoryOptions: CategoryOption[];
};

type FormPayload = {
  category: string;
  description: string;
  amountCents: number;
  incurredAt: string;
  notes?: string;
};

function parseAmountToCents(raw: string): number {
  const normalized = raw.replace(/\./g, "").replace(/,/g, ".").trim();
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return Math.round(numeric * 100);
}

export function ExpenseForm({ categoryOptions }: ExpenseFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { submit, isPending, error, message } = useApiMutation<FormPayload>({
    endpoint: "/api/expenses",
    method: "POST",
    successMessage: "Despesa registrada com sucesso.",
    onSuccess() {
      formRef.current?.reset();
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const category = String(formData.get("category") ?? "");
    const description = String(formData.get("description") ?? "").trim();
    const incurredAt = String(formData.get("incurredAt") ?? "");
    const amountCents = parseAmountToCents(
      String(formData.get("amount") ?? ""),
    );
    const rawNotes = String(formData.get("notes") ?? "").trim();

    submit({
      category,
      description,
      amountCents,
      incurredAt,
      notes: rawNotes.length > 0 ? rawNotes : undefined,
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="category" className={labelClassName}>
            Categoria
          </label>
          <select
            id="category"
            name="category"
            required
            defaultValue={categoryOptions[0]?.value ?? ""}
            className={inputClassName}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="incurredAt" className={labelClassName}>
            Data
          </label>
          <input
            id="incurredAt"
            name="incurredAt"
            type="date"
            required
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor="description" className={labelClassName}>
            Descricao
          </label>
          <input
            id="description"
            name="description"
            type="text"
            maxLength={120}
            required
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="amount" className={labelClassName}>
            Valor (R$)
          </label>
          <input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            required
            className={inputClassName}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="notes" className={labelClassName}>
          Observacoes
        </label>
        <textarea
          id="notes"
          name="notes"
          placeholder="Detalhes, numero de NF, vencimento..."
          className={textareaClassName}
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-brand-gray-light/20 bg-brand-black/70 px-4 py-3 text-sm text-brand-white">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-brand-white/15 bg-brand-white/5 px-4 py-3 text-sm text-brand-white">
          {message}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={isPending}>
          Registrar despesa
        </Button>
      </div>
    </form>
  );
}
