import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SimpleBarChart } from "@/components/dashboard/SimpleBarChart";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { formatDate } from "@/lib/academy/constants";
import { flattenSearchParams } from "@/lib/academy/presentation";
import { requirePermission } from "@/lib/auth/guards";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import { getReportsPageData } from "@/lib/reports/service";
import { parseSearchParams, reportFiltersSchema } from "@/lib/validators";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Relatorios",
  description: "Relatorios operacionais de presenca, financeiro, vendas e estoque.",
};

function buildExportHref(
  kind: string,
  filters: {
    dateFrom?: string;
    dateTo?: string;
    studentId?: string;
    modalityId?: string;
    teacherId?: string;
  },
  format: "csv" | "xlsx" | "pdf" = "csv",
) {
  const params = new URLSearchParams();
  params.set("kind", kind);
  params.set("format", format);

  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo);
  }

  if (filters.studentId) {
    params.set("studentId", filters.studentId);
  }

  if (filters.modalityId) {
    params.set("modalityId", filters.modalityId);
  }

  if (filters.teacherId) {
    params.set("teacherId", filters.teacherId);
  }

  return `/api/reports/export?${params.toString()}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePermission("viewReports", "/dashboard/relatorios");
  const viewer = await getViewerContextFromSession(session);
  const filters = parseSearchParams(
    flattenSearchParams(await searchParams),
    reportFiltersSchema,
  );
  const data = await getReportsPageData(viewer, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Relatorios"
        title="Relatorios operacionais"
        description="Consolide presenca, pagamentos, faturamento, vendas internas e alertas de estoque em um unico painel."
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <input
            name="dateFrom"
            type="date"
            defaultValue={filters.dateFrom ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          />
          <input
            name="dateTo"
            type="date"
            defaultValue={filters.dateTo ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          />
          <select
            name="studentId"
            defaultValue={filters.studentId ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todos os alunos</option>
            {data.options.students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.user.name}
              </option>
            ))}
          </select>
          <select
            name="modalityId"
            defaultValue={filters.modalityId ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todas as modalidades</option>
            {data.options.modalities.map((modality) => (
              <option key={modality.id} value={modality.id}>
                {modality.name}
              </option>
            ))}
          </select>
          <select
            name="teacherId"
            defaultValue={filters.teacherId ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todos os professores</option>
            {data.options.teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.user.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary" className="w-full">
              Filtrar
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/dashboard/relatorios">Limpar</Link>
            </Button>
          </div>
        </form>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild variant="secondary" size="sm">
            <a href={buildExportHref("attendance", filters)}>CSV presenca</a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={buildExportHref("attendance", filters, "xlsx")}>XLSX presenca</a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={buildExportHref("attendance", filters, "pdf")}>PDF presenca</a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={buildExportHref("payments", filters)}>CSV pagamentos</a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={buildExportHref("payments", filters, "xlsx")}>XLSX pagamentos</a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={buildExportHref("payments", filters, "pdf")}>PDF pagamentos</a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={buildExportHref("delinquency", filters)}>CSV inadimplencia</a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={buildExportHref("sales", filters)}>CSV vendas</a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={buildExportHref("sales", filters, "xlsx")}>XLSX vendas</a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={buildExportHref("low-stock", filters)}>CSV estoque baixo</a>
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Presencas"
          value={data.attendance.summary.presentCount}
          note={`${data.attendance.summary.noShowCount} falta(s) no periodo.`}
        />
        <MetricCard
          label="Faturamento"
          value={formatCurrencyFromCents(data.payments.summary.paidAmountCents)}
          note={`${data.payments.summary.paidCount} pagamento(s) quitado(s).`}
        />
        <MetricCard
          label="Inadimplencia"
          value={formatCurrencyFromCents(data.payments.summary.overdueAmountCents)}
          note={`${data.payments.summary.delinquentStudents} aluno(s) em atraso.`}
        />
        <MetricCard
          label="Vendas"
          value={formatCurrencyFromCents(data.sales.summary.totalRevenueCents)}
          note={`${data.sales.summary.totalSales} venda(s) no periodo.`}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SimpleBarChart
          title="Presenca por dia"
          description="Check-ins e check-outs convertidos em barras por dia."
          points={data.attendance.charts.byDate}
          tone="sky"
        />
        <SimpleBarChart
          title="Faturamento por dia"
          description="Valores pagos dentro do periodo filtrado."
          points={data.payments.charts.revenueByDate}
          formatter={(value) => formatCurrencyFromCents(value)}
          tone="emerald"
        />
        <SimpleBarChart
          title="Presenca por modalidade"
          description="Top modalidades com mais presencas no recorte atual."
          points={data.attendance.charts.byModality}
          tone="amber"
        />
        <SimpleBarChart
          title="Vendas por produto"
          description="Produtos com maior receita no periodo filtrado."
          points={data.sales.charts.topProducts}
          formatter={(value) => formatCurrencyFromCents(value)}
          tone="red"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Presenca por aluno</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Ranking de alunos com maior volume de presencas.
              </p>
            </div>
            <StatusBadge tone="neutral">{data.attendance.charts.byStudent.length} linha(s)</StatusBadge>
          </div>
          <div className="mt-6 space-y-3">
            {data.attendance.charts.byStudent.map((item) => (
              <div
                key={`${item.label}-${item.note}`}
                className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-1 text-xs text-brand-gray-light">{item.note}</p>
                  </div>
                  <StatusBadge tone="info">{item.value} presenca(s)</StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Presenca por professor</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Professores com mais movimentacao no recorte.
              </p>
            </div>
            <StatusBadge tone="neutral">{data.attendance.charts.byTeacher.length} linha(s)</StatusBadge>
          </div>
          <div className="mt-6 space-y-3">
            {data.attendance.charts.byTeacher.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <StatusBadge tone="info">{item.value} presenca(s)</StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Inadimplencia</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Alunos com cobrancas pendentes vencidas.
              </p>
            </div>
            <StatusBadge tone="warning">{data.payments.delinquency.length} aluno(s)</StatusBadge>
          </div>
          {data.payments.delinquency.length === 0 ? (
            <p className="mt-6 text-sm text-brand-gray-light">
              Nenhum aluno em atraso dentro do recorte atual.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {data.payments.delinquency.map((entry) => (
                <div
                  key={`${entry.registrationNumber}-${entry.studentName}`}
                  className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{entry.studentName}</p>
                      <p className="mt-1 text-xs text-brand-gray-light">
                        {entry.registrationNumber} • {entry.modalityName ?? "Sem modalidade principal"}
                      </p>
                    </div>
                    <StatusBadge tone="danger">
                      {formatCurrencyFromCents(entry.overdueAmountCents)}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Estoque baixo</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Produtos com necessidade de reposicao.
              </p>
            </div>
            <StatusBadge tone="warning">{data.lowStockProducts.length} produto(s)</StatusBadge>
          </div>
          {data.lowStockProducts.length === 0 ? (
            <p className="mt-6 text-sm text-brand-gray-light">
              Nenhum alerta de estoque baixo no momento.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {data.lowStockProducts.slice(0, 10).map((product) => (
                <div
                  key={product.id}
                  className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4"
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
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Pagamentos recentes</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Ultimos registros financeiros dentro do periodo.
              </p>
            </div>
            <StatusBadge tone="neutral">{data.payments.records.length} linha(s)</StatusBadge>
          </div>
          <div className="mt-6 space-y-3">
            {data.payments.records.slice(0, 8).map((payment) => (
              <div
                key={payment.id}
                className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {payment.studentProfile.user.name}
                    </p>
                    <p className="mt-1 text-xs text-brand-gray-light">
                      {payment.subscription.plan.name} • vence em {formatDate(payment.dueDate)}
                    </p>
                  </div>
                  <StatusBadge
                    tone={
                      payment.status === "PAID"
                        ? "success"
                        : payment.status === "PENDING"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {formatCurrencyFromCents(payment.amountCents)}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Vendas recentes</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Ultimas vendas de produtos no recorte filtrado.
              </p>
            </div>
            <StatusBadge tone="neutral">{data.sales.sales.length} linha(s)</StatusBadge>
          </div>
          <div className="mt-6 space-y-3">
            {data.sales.sales.slice(0, 8).map((sale) => (
              <div
                key={sale.id}
                className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {sale.studentProfile?.user.name ?? sale.customerName ?? "Venda de balcao"}
                    </p>
                    <p className="mt-1 text-xs text-brand-gray-light">
                      {sale.saleNumber} • {formatDate(sale.soldAt)}
                    </p>
                  </div>
                  <StatusBadge tone={sale.status === "PAID" ? "success" : "warning"}>
                    {formatCurrencyFromCents(sale.totalCents)}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
