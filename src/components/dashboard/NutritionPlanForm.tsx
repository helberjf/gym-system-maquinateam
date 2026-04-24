"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  inputClassName,
  labelClassName,
  textareaClassName,
} from "@/components/dashboard/styles";
import { useApiMutation } from "@/components/dashboard/useApiMutation";

type NutritionPlanFormProps = {
  studentId: string;
};

type MealDraft = {
  title: string;
  time: string;
  items: string;
  notes: string;
};

type FormPayload = {
  studentId: string;
  title: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  status: "ACTIVE" | "ARCHIVED";
  content: {
    caloriesTarget?: number;
    objective?: string;
    meals: Array<{
      title: string;
      time?: string;
      items: string[];
      notes?: string;
    }>;
  };
};

function createEmptyMeal(): MealDraft {
  return { title: "", time: "", items: "", notes: "" };
}

export function NutritionPlanForm({ studentId }: NutritionPlanFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [meals, setMeals] = useState<MealDraft[]>([createEmptyMeal()]);
  const { submit, isPending, error, message } = useApiMutation<FormPayload>({
    endpoint: "/api/nutrition-plans",
    method: "POST",
    successMessage: "Plano alimentar registrado com sucesso.",
    onSuccess() {
      formRef.current?.reset();
      setMeals([createEmptyMeal()]);
    },
  });

  function updateMeal(index: number, patch: Partial<MealDraft>) {
    setMeals((current) =>
      current.map((meal, i) => (i === index ? { ...meal, ...patch } : meal)),
    );
  }

  function addMeal() {
    setMeals((current) => [...current, createEmptyMeal()]);
  }

  function removeMeal(index: number) {
    setMeals((current) => current.filter((_, i) => i !== index));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const startsAt = String(formData.get("startsAt") ?? "");
    const endsAt = String(formData.get("endsAt") ?? "");
    const caloriesRaw = String(formData.get("caloriesTarget") ?? "").trim();
    const objective = String(formData.get("objective") ?? "").trim();
    const caloriesTarget =
      caloriesRaw.length > 0 ? Number(caloriesRaw) : undefined;

    const sanitizedMeals = meals
      .map((meal) => ({
        title: meal.title.trim(),
        time: meal.time.trim() || undefined,
        items: meal.items
          .split("\n")
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
        notes: meal.notes.trim() || undefined,
      }))
      .filter((meal) => meal.title.length > 0 && meal.items.length > 0);

    submit({
      studentId,
      title,
      description: description.length > 0 ? description : undefined,
      startsAt: startsAt.length > 0 ? startsAt : undefined,
      endsAt: endsAt.length > 0 ? endsAt : undefined,
      status: "ACTIVE",
      content: {
        caloriesTarget: Number.isFinite(caloriesTarget)
          ? caloriesTarget
          : undefined,
        objective: objective.length > 0 ? objective : undefined,
        meals: sanitizedMeals,
      },
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor="title" className={labelClassName}>
            Titulo do plano
          </label>
          <input
            id="title"
            name="title"
            type="text"
            maxLength={120}
            required
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="startsAt" className={labelClassName}>
            Inicio
          </label>
          <input
            id="startsAt"
            name="startsAt"
            type="date"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="endsAt" className={labelClassName}>
            Fim
          </label>
          <input
            id="endsAt"
            name="endsAt"
            type="date"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="caloriesTarget" className={labelClassName}>
            Meta calorica
          </label>
          <input
            id="caloriesTarget"
            name="caloriesTarget"
            type="number"
            min="0"
            className={inputClassName}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className={labelClassName}>
          Descricao geral
        </label>
        <textarea
          id="description"
          name="description"
          placeholder="Observacoes gerais sobre o plano."
          className={textareaClassName}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="objective" className={labelClassName}>
          Objetivo
        </label>
        <input
          id="objective"
          name="objective"
          type="text"
          placeholder="Hipertrofia, emagrecimento, manutencao..."
          className={inputClassName}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-brand-gray-light">
            Refeicoes
          </h3>
          <Button type="button" variant="secondary" size="sm" onClick={addMeal}>
            Adicionar refeicao
          </Button>
        </div>

        {meals.map((meal, index) => (
          <div
            key={index}
            className="space-y-3 rounded-3xl border border-brand-gray-mid bg-brand-black/40 p-4"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1.5 md:col-span-2">
                <label className={labelClassName}>Titulo</label>
                <input
                  type="text"
                  value={meal.title}
                  maxLength={80}
                  onChange={(e) =>
                    updateMeal(index, { title: e.target.value })
                  }
                  className={inputClassName}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClassName}>Horario</label>
                <input
                  type="text"
                  value={meal.time}
                  placeholder="08:00"
                  onChange={(e) => updateMeal(index, { time: e.target.value })}
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={labelClassName}>Itens (um por linha)</label>
              <textarea
                value={meal.items}
                onChange={(e) => updateMeal(index, { items: e.target.value })}
                placeholder={"2 ovos mexidos\n1 fatia de pao integral"}
                className={textareaClassName}
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelClassName}>Observacoes</label>
              <input
                type="text"
                value={meal.notes}
                onChange={(e) => updateMeal(index, { notes: e.target.value })}
                className={inputClassName}
              />
            </div>

            {meals.length > 1 ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => removeMeal(index)}
                >
                  Remover refeicao
                </Button>
              </div>
            ) : null}
          </div>
        ))}
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
          Registrar plano alimentar
        </Button>
      </div>
    </form>
  );
}
