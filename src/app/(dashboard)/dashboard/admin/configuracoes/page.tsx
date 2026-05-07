import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { BrandSettingsForm } from "@/components/dashboard/admin/BrandSettingsForm";
import { requirePermission } from "@/lib/auth/guards";
import { getBrandConfig } from "@/lib/settings/service";

export const metadata: Metadata = {
  title: "Configuracoes",
  description: "Edite marca, contato, horarios e politicas exibidos no site.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requirePermission("manageAppSettings");
  const brand = await getBrandConfig();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administracao"
        title="Configuracoes da marca"
        description="Atualize nome, contato, horarios e politicas que aparecem na vitrine publica e nos emails sem precisar de deploy."
      />
      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <BrandSettingsForm
          initial={{
            name: brand.name,
            slogan: brand.slogan,
            instructor: brand.instructor,
            contact: { ...brand.contact },
            address: { ...brand.address },
            hours: { ...brand.hours },
            cancellationPolicy: brand.cancellationPolicy,
          }}
        />
      </section>
    </div>
  );
}
