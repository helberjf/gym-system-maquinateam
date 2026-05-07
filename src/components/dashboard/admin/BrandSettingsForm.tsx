"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  inputClassName,
  labelClassName,
  textareaClassName,
} from "@/components/dashboard/styles";
import { useApiMutation } from "@/components/dashboard/useApiMutation";

type BrandConfig = {
  name?: string;
  slogan?: string;
  instructor?: string;
  contact?: {
    phone?: string;
    whatsapp?: string;
    email?: string;
    instagram?: string;
    instagramUrl?: string;
    whatsappUrl?: string;
  };
  address?: {
    street?: string;
    city?: string;
    cep?: string;
    full?: string;
  };
  hours?: {
    weekdays?: string;
    weekend?: string;
    label?: string;
  };
  cancellationPolicy?: string | null;
};

type Props = {
  initial: BrandConfig;
};

export function BrandSettingsForm({ initial }: Props) {
  const [form, setForm] = useState<BrandConfig>(() => ({
    name: initial.name ?? "",
    slogan: initial.slogan ?? "",
    instructor: initial.instructor ?? "",
    contact: { ...(initial.contact ?? {}) },
    address: { ...(initial.address ?? {}) },
    hours: { ...(initial.hours ?? {}) },
    cancellationPolicy: initial.cancellationPolicy ?? "",
  }));

  const { submit, isPending, error, message } = useApiMutation<BrandConfig>({
    endpoint: "/api/admin/settings",
    method: "PATCH",
    successMessage: "Configuracoes salvas.",
  });

  function update<K extends keyof BrandConfig>(key: K, value: BrandConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateNested<P extends "contact" | "address" | "hours">(
    parent: P,
    key: string,
    value: string,
  ) {
    setForm((prev) => ({
      ...prev,
      [parent]: { ...(prev[parent] ?? {}), [key]: value },
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit({
      name: form.name?.trim() || undefined,
      slogan: form.slogan?.trim() || undefined,
      instructor: form.instructor?.trim() || undefined,
      contact: form.contact,
      address: form.address,
      hours: form.hours,
      cancellationPolicy: form.cancellationPolicy?.toString().trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="text-sm font-bold uppercase tracking-wider text-brand-red">
          Marca
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="name" className={labelClassName}>
              Nome
            </label>
            <input
              id="name"
              value={form.name ?? ""}
              onChange={(event) => update("name", event.target.value)}
              className={inputClassName}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="slogan" className={labelClassName}>
              Slogan
            </label>
            <input
              id="slogan"
              value={form.slogan ?? ""}
              onChange={(event) => update("slogan", event.target.value)}
              className={inputClassName}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="instructor" className={labelClassName}>
              Professor / Responsavel
            </label>
            <input
              id="instructor"
              value={form.instructor ?? ""}
              onChange={(event) => update("instructor", event.target.value)}
              className={inputClassName}
              maxLength={200}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-bold uppercase tracking-wider text-brand-red">
          Contato
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="contact.phone" className={labelClassName}>
              Telefone exibido
            </label>
            <input
              id="contact.phone"
              value={form.contact?.phone ?? ""}
              onChange={(event) =>
                updateNested("contact", "phone", event.target.value)
              }
              className={inputClassName}
              maxLength={40}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="contact.whatsapp" className={labelClassName}>
              WhatsApp (apenas digitos com DDI/DDD)
            </label>
            <input
              id="contact.whatsapp"
              value={form.contact?.whatsapp ?? ""}
              onChange={(event) =>
                updateNested("contact", "whatsapp", event.target.value)
              }
              className={inputClassName}
              maxLength={40}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="contact.email" className={labelClassName}>
              E-mail
            </label>
            <input
              id="contact.email"
              type="email"
              value={form.contact?.email ?? ""}
              onChange={(event) =>
                updateNested("contact", "email", event.target.value)
              }
              className={inputClassName}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="contact.instagram" className={labelClassName}>
              Instagram (@usuario)
            </label>
            <input
              id="contact.instagram"
              value={form.contact?.instagram ?? ""}
              onChange={(event) =>
                updateNested("contact", "instagram", event.target.value)
              }
              className={inputClassName}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="contact.instagramUrl" className={labelClassName}>
              URL Instagram
            </label>
            <input
              id="contact.instagramUrl"
              value={form.contact?.instagramUrl ?? ""}
              onChange={(event) =>
                updateNested("contact", "instagramUrl", event.target.value)
              }
              className={inputClassName}
              maxLength={300}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="contact.whatsappUrl" className={labelClassName}>
              URL WhatsApp (com mensagem pre-pronta)
            </label>
            <input
              id="contact.whatsappUrl"
              value={form.contact?.whatsappUrl ?? ""}
              onChange={(event) =>
                updateNested("contact", "whatsappUrl", event.target.value)
              }
              className={inputClassName}
              maxLength={500}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-bold uppercase tracking-wider text-brand-red">
          Endereco
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="address.street" className={labelClassName}>
              Rua e numero
            </label>
            <input
              id="address.street"
              value={form.address?.street ?? ""}
              onChange={(event) =>
                updateNested("address", "street", event.target.value)
              }
              className={inputClassName}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="address.city" className={labelClassName}>
              Cidade / UF
            </label>
            <input
              id="address.city"
              value={form.address?.city ?? ""}
              onChange={(event) =>
                updateNested("address", "city", event.target.value)
              }
              className={inputClassName}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="address.cep" className={labelClassName}>
              CEP
            </label>
            <input
              id="address.cep"
              value={form.address?.cep ?? ""}
              onChange={(event) =>
                updateNested("address", "cep", event.target.value)
              }
              className={inputClassName}
              maxLength={15}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="address.full" className={labelClassName}>
              Endereco completo (1 linha)
            </label>
            <input
              id="address.full"
              value={form.address?.full ?? ""}
              onChange={(event) =>
                updateNested("address", "full", event.target.value)
              }
              className={inputClassName}
              maxLength={300}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-bold uppercase tracking-wider text-brand-red">
          Horario de funcionamento
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="hours.weekdays" className={labelClassName}>
              Segunda a sexta
            </label>
            <input
              id="hours.weekdays"
              value={form.hours?.weekdays ?? ""}
              onChange={(event) =>
                updateNested("hours", "weekdays", event.target.value)
              }
              className={inputClassName}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="hours.weekend" className={labelClassName}>
              Fim de semana
            </label>
            <input
              id="hours.weekend"
              value={form.hours?.weekend ?? ""}
              onChange={(event) =>
                updateNested("hours", "weekend", event.target.value)
              }
              className={inputClassName}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="hours.label" className={labelClassName}>
              Texto exibido (resumo)
            </label>
            <input
              id="hours.label"
              value={form.hours?.label ?? ""}
              onChange={(event) =>
                updateNested("hours", "label", event.target.value)
              }
              className={inputClassName}
              maxLength={120}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-bold uppercase tracking-wider text-brand-red">
          Politicas
        </legend>
        <div className="space-y-1.5">
          <label htmlFor="cancellationPolicy" className={labelClassName}>
            Politica de cancelamento (mostrada na vitrine de planos)
          </label>
          <textarea
            id="cancellationPolicy"
            value={form.cancellationPolicy ?? ""}
            onChange={(event) =>
              update("cancellationPolicy", event.target.value)
            }
            className={textareaClassName}
            maxLength={2000}
          />
        </div>
      </fieldset>

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
          Salvar configuracoes
        </Button>
      </div>
    </form>
  );
}
