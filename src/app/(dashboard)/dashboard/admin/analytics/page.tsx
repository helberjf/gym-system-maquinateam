import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AnalyticsChat } from "@/components/dashboard/admin/AnalyticsChat";
import { requirePermission } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Maquina IA",
  description: "Chat analitico com IA para administradores.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AnalyticsChatPage() {
  await requirePermission("accessAdminEndpoints", "/dashboard/admin/analytics");

  const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administracao"
        title="Maquina IA"
        description="Pergunte em linguagem natural sobre presencas, financeiro, leads, estoque e operacao. As respostas vem de consultas reais ao banco."
      />

      {!aiConfigured ? (
        <section className="rounded-3xl border border-brand-red/40 bg-brand-red/10 p-6 text-sm text-brand-red">
          <p className="font-semibold">ANTHROPIC_API_KEY nao configurada.</p>
          <p className="mt-2">
            Defina <code>ANTHROPIC_API_KEY</code> nas variaveis de ambiente do
            servidor para habilitar este recurso.
          </p>
        </section>
      ) : null}

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <AnalyticsChat />
      </section>
    </div>
  );
}
