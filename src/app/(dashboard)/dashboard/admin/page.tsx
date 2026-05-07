import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SimpleBarChart } from "@/components/dashboard/SimpleBarChart";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { formatDate, getStudentStatusLabel } from "@/lib/academy/constants";
import { getStudentStatusTone } from "@/lib/academy/presentation";
import { requirePermission } from "@/lib/auth/guards";
import {
  formatCurrencyFromCents,
  getPaymentStatusLabel,
} from "@/lib/billing/constants";
import { getAdminDashboardData } from "@/lib/reports/service";
import { getTrainingAssignmentStatusLabel } from "@/lib/training/constants";
import { getTrainingAssignmentTone } from "@/lib/training/presentation";

export const metadata: Metadata = {
  title: "Area administrativa",
  description: "Painel analitico com metricas principais, trilha recente e alertas operacionais.",
};

function getPaymentTone(status: string) {
  if (status === "PAID") {
    return "success" as const;
  }

  if (status === "PENDING") {
    return "warning" as const;
  }

  return "neutral" as const;
}

export default async function AdminDashboardPage() {
  const session = await requirePermission("accessAdminEndpoints", "/dashboard/admin");
  const viewer = await getViewerContextFromSession(session);
  const data = await getAdminDashboardData(viewer);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administracao"
        title="Dashboard administrativo"
        description="Acompanhe alunos, presenca, financeiro, estoque, treinos recentes e trilha de auditoria em um unico lugar."
        action={
          <div className="flex flex-wrap gap-3">
            <Button asChild size="sm">
              <Link href="/dashboard/admin/analytics">Maquina IA</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/relatorios">Abrir relatorios</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/admin/configuracoes">Configuracoes</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/pagamentos">Operar financeiro</Link>
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total de alunos"
          value={data.metrics.totalStudents}
          note="Base total de perfis de aluno cadastrados."
        />
        <MetricCard
          label="Alunos ativos"
          value={data.metrics.activeStudents}
          note="Perfis em operacao regular ou periodo experimental."
        />
        <MetricCard
          label="Alunos inadimplentes"
          value={data.metrics.delinquentStudents}
          note="Alunos com ao menos uma cobranca pendente vencida."
        />
        <MetricCard
          label="Presenca do dia"
          value={data.metrics.attendanceToday}
          note="Check-ins e check-outs registrados hoje."
        />
        <MetricCard
          label="Faturamento do mes"
          value={formatCurrencyFromCents(data.metrics.monthRevenueCents)}
          note="Recebimentos confirmados no mes corrente."
        />
        <MetricCard
          label="Pagamentos pendentes"
          value={data.metrics.pendingPayments}
          note={`${formatCurrencyFromCents(data.metrics.pendingAmountCents)} em aberto.`}
        />
        <MetricCard
          label="Estoque baixo"
          value={data.metrics.lowStockProducts}
          note="Produtos pedindo reposicao no cadastro interno."
        />
        <MetricCard
          label="Treinos recentes"
          value={data.recentTrainings.length}
          note="Ultimas atribuicoes registradas no sistema."
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SimpleBarChart
          title="Faturamento dos ultimos meses"
          description="Receita consolidada a partir dos pagamentos quitados."
          points={data.charts.revenueByMonth}
          formatter={(value) => formatCurrencyFromCents(value)}
          tone="emerald"
        />
        <SimpleBarChart
          title="Presenca dos ultimos dias"
          description="Movimentacao recente de check-ins na academia."
          points={data.charts.attendanceByDay}
          tone="sky"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Treinos atribuidos recentemente</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Ultimos acompanhamentos criados por professores e administracao.
              </p>
            </div>
            <StatusBadge tone="neutral">{data.recentTrainings.length} registro(s)</StatusBadge>
          </div>

          {data.recentTrainings.length === 0 ? (
            <p className="mt-6 text-sm text-brand-gray-light">
              Ainda nao ha atribuicoes recentes de treino.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {data.recentTrainings.map((training) => (
                <article
                  key={training.id}
                  className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{training.title}</p>
                      <p className="mt-1 text-xs text-brand-gray-light">
                        {training.studentProfile.user.name} -{" "}
                        {training.teacherProfile?.user.name ?? "Equipe tecnica"}
                      </p>
                    </div>
                    <StatusBadge tone={getTrainingAssignmentTone(training.status)}>
                      {getTrainingAssignmentStatusLabel(training.status)}
                    </StatusBadge>
                  </div>
                  <p className="mt-3 text-xs text-brand-gray-light">
                    Atribuido em {formatDate(training.assignedAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Produtos com estoque baixo</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Itens que exigem reposicao ou revisao de configuracao.
              </p>
            </div>
            <StatusBadge tone="warning">{data.lowStockProducts.length} alerta(s)</StatusBadge>
          </div>

          {data.lowStockProducts.length === 0 ? (
            <p className="mt-6 text-sm text-brand-gray-light">
              Nenhum produto em estoque baixo neste momento.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {data.lowStockProducts.map((product) => (
                <article
                  key={product.id}
                  className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{product.name}</p>
                      <p className="mt-1 text-xs text-brand-gray-light">{product.category}</p>
                    </div>
                    <StatusBadge tone="danger">
                      {product.stockQuantity} / alerta {product.lowStockThreshold}
                    </StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Cadastros recentes</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Alunos adicionados mais recentemente na base.
              </p>
            </div>
            <StatusBadge tone="neutral">{data.recentStudents.length} aluno(s)</StatusBadge>
          </div>

          {data.recentStudents.length === 0 ? (
            <p className="mt-6 text-sm text-brand-gray-light">
              Nenhum cadastro recente encontrado.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {data.recentStudents.map((student) => (
                <article
                  key={student.id}
                  className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{student.user.name}</p>
                      <p className="mt-1 text-xs text-brand-gray-light">
                        {student.registrationNumber} - {formatDate(student.createdAt)}
                      </p>
                    </div>
                    <StatusBadge tone={getStudentStatusTone(student.status)}>
                      {getStudentStatusLabel(student.status)}
                    </StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Pagamentos recentes</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Ultimos registros financeiros processados pela operacao.
              </p>
            </div>
            <StatusBadge tone="neutral">{data.recentPayments.length} pagamento(s)</StatusBadge>
          </div>

          {data.recentPayments.length === 0 ? (
            <p className="mt-6 text-sm text-brand-gray-light">
              Nenhum pagamento recente para exibir.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {data.recentPayments.map((payment) => (
                <article
                  key={payment.id}
                  className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {payment.studentProfile.user.name}
                      </p>
                      <p className="mt-1 text-xs text-brand-gray-light">
                        Vence em {formatDate(payment.dueDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge tone={getPaymentTone(payment.status)}>
                        {getPaymentStatusLabel(payment.status, payment.dueDate)}
                      </StatusBadge>
                      <p className="mt-2 text-xs font-semibold text-white">
                        {formatCurrencyFromCents(payment.amountCents)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Vendas recentes</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Ultimas vendas de produtos registradas no caixa interno.
              </p>
            </div>
            <StatusBadge tone="neutral">{data.recentSales.length} venda(s)</StatusBadge>
          </div>

          {data.recentSales.length === 0 ? (
            <p className="mt-6 text-sm text-brand-gray-light">
              Nenhuma venda recente para exibir.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {data.recentSales.map((sale) => (
                <article
                  key={sale.id}
                  className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {sale.studentProfile?.user.name ?? sale.customerName ?? "Venda de balcao"}
                      </p>
                      <p className="mt-1 text-xs text-brand-gray-light">
                        {sale.saleNumber} - {formatDate(sale.soldAt)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-white">
                      {formatCurrencyFromCents(sale.totalCents)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Auditoria recente</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Ultimas acoes administrativas persistidas em trilha de auditoria.
              </p>
            </div>
            <StatusBadge tone="neutral">{data.recentAuditLogs.length} evento(s)</StatusBadge>
          </div>

          {data.recentAuditLogs.length === 0 ? (
            <p className="mt-6 text-sm text-brand-gray-light">
              Ainda nao existem registros de auditoria.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {data.recentAuditLogs.map((log) => (
                <article
                  key={log.id}
                  className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="info">{log.action}</StatusBadge>
                    <span className="text-sm font-semibold text-white">{log.entityType}</span>
                  </div>
                  <p className="mt-2 text-sm text-brand-gray-light">{log.summary}</p>
                  <p className="mt-3 text-xs text-brand-gray-light">
                    {log.actor?.name ?? "Sistema"} - {formatDate(log.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
