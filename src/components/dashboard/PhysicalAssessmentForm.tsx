"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import {
  inputClassName,
  labelClassName,
  textareaClassName,
} from "@/components/dashboard/styles";
import { useApiMutation } from "@/components/dashboard/useApiMutation";

type PhysicalAssessmentFormProps = {
  studentId: string;
};

type FormPayload = {
  studentId: string;
  assessedAt?: string;
  weightKg?: string;
  heightCm?: string;
  bodyFatPercent?: string;
  muscleMassKg?: string;
  chestCm?: string;
  waistCm?: string;
  hipCm?: string;
  leftArmCm?: string;
  rightArmCm?: string;
  leftThighCm?: string;
  rightThighCm?: string;
  restingHeartRate?: string;
  bloodPressureSystolic?: string;
  bloodPressureDiastolic?: string;
  notes?: string;
};

function pickValue(formData: FormData, key: string) {
  const raw = formData.get(key);
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function PhysicalAssessmentForm({
  studentId,
}: PhysicalAssessmentFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { submit, isPending, error, message } = useApiMutation<FormPayload>({
    endpoint: "/api/physical-assessments",
    method: "POST",
    successMessage: "Avaliacao registrada com sucesso.",
    onSuccess() {
      formRef.current?.reset();
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    submit({
      studentId,
      assessedAt: pickValue(formData, "assessedAt"),
      weightKg: pickValue(formData, "weightKg"),
      heightCm: pickValue(formData, "heightCm"),
      bodyFatPercent: pickValue(formData, "bodyFatPercent"),
      muscleMassKg: pickValue(formData, "muscleMassKg"),
      chestCm: pickValue(formData, "chestCm"),
      waistCm: pickValue(formData, "waistCm"),
      hipCm: pickValue(formData, "hipCm"),
      leftArmCm: pickValue(formData, "leftArmCm"),
      rightArmCm: pickValue(formData, "rightArmCm"),
      leftThighCm: pickValue(formData, "leftThighCm"),
      rightThighCm: pickValue(formData, "rightThighCm"),
      restingHeartRate: pickValue(formData, "restingHeartRate"),
      bloodPressureSystolic: pickValue(formData, "bloodPressureSystolic"),
      bloodPressureDiastolic: pickValue(formData, "bloodPressureDiastolic"),
      notes: pickValue(formData, "notes"),
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1.5 md:col-span-3">
          <label htmlFor="assessedAt" className={labelClassName}>
            Data da avaliacao
          </label>
          <input
            id="assessedAt"
            name="assessedAt"
            type="datetime-local"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="weightKg" className={labelClassName}>
            Peso (kg)
          </label>
          <input
            id="weightKg"
            name="weightKg"
            type="number"
            step="0.1"
            min="0"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="heightCm" className={labelClassName}>
            Altura (cm)
          </label>
          <input
            id="heightCm"
            name="heightCm"
            type="number"
            min="0"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="bodyFatPercent" className={labelClassName}>
            Gordura corporal (%)
          </label>
          <input
            id="bodyFatPercent"
            name="bodyFatPercent"
            type="number"
            step="0.1"
            min="0"
            max="100"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="muscleMassKg" className={labelClassName}>
            Massa magra (kg)
          </label>
          <input
            id="muscleMassKg"
            name="muscleMassKg"
            type="number"
            step="0.1"
            min="0"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="chestCm" className={labelClassName}>
            Peito (cm)
          </label>
          <input
            id="chestCm"
            name="chestCm"
            type="number"
            step="0.1"
            min="0"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="waistCm" className={labelClassName}>
            Cintura (cm)
          </label>
          <input
            id="waistCm"
            name="waistCm"
            type="number"
            step="0.1"
            min="0"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="hipCm" className={labelClassName}>
            Quadril (cm)
          </label>
          <input
            id="hipCm"
            name="hipCm"
            type="number"
            step="0.1"
            min="0"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="leftArmCm" className={labelClassName}>
            Braco esquerdo (cm)
          </label>
          <input
            id="leftArmCm"
            name="leftArmCm"
            type="number"
            step="0.1"
            min="0"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="rightArmCm" className={labelClassName}>
            Braco direito (cm)
          </label>
          <input
            id="rightArmCm"
            name="rightArmCm"
            type="number"
            step="0.1"
            min="0"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="leftThighCm" className={labelClassName}>
            Coxa esquerda (cm)
          </label>
          <input
            id="leftThighCm"
            name="leftThighCm"
            type="number"
            step="0.1"
            min="0"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="rightThighCm" className={labelClassName}>
            Coxa direita (cm)
          </label>
          <input
            id="rightThighCm"
            name="rightThighCm"
            type="number"
            step="0.1"
            min="0"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="restingHeartRate" className={labelClassName}>
            FC repouso (bpm)
          </label>
          <input
            id="restingHeartRate"
            name="restingHeartRate"
            type="number"
            min="0"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="bloodPressureSystolic" className={labelClassName}>
            PA sistolica (mmHg)
          </label>
          <input
            id="bloodPressureSystolic"
            name="bloodPressureSystolic"
            type="number"
            min="0"
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="bloodPressureDiastolic" className={labelClassName}>
            PA diastolica (mmHg)
          </label>
          <input
            id="bloodPressureDiastolic"
            name="bloodPressureDiastolic"
            type="number"
            min="0"
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
          placeholder="Contexto, metas, orientacoes..."
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
          Registrar avaliacao
        </Button>
      </div>
    </form>
  );
}
