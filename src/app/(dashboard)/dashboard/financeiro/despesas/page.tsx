import type { Metadata } from "next";
import { ExpenseCategory } from "@prisma/client";
import { ExpenseForm } from "@/components/dashboard/ExpenseForm";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { flattenSearchParams } from "@/lib/academy/presentation";
import { requirePermission } from "@/lib/auth/guards";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import { listExpenses } from "@/lib/expenses/service";
import {
  EXPENSE_CATEGORY_LABELS,
  MANUAL_EXPENSE_CATEGORIES,
} from "@/lib/reports/dre";
import { expenseFiltersSchema, parseSearchParams } from "@/lib/validators";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Despesas",
  description: "Cadastro manual de despesas operacionais.",
};

export const dynamic = "force-dynamic";

const CATEGORY_OPTIONS = MANUAL_EXPENSE_CATEGORIES.map((category) => ({
  value: category,
  label: EXPENSE_CATEGORY_LABELS[category],
}));

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePermission("manageExpenses");
  const viewer = await getViewerContextFromSession(session);
  const filters = parseSearchParams(
    flattenSearchParams(await searchParams),
    expenseFiltersSchema,
  );
  const { items, pagination } = await listExpenses(filters, viewer);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Despesas operacionais"
        description="Registre aluguel, folha, marketing e outras despesas para consolidar o DRE."
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <h2 className="text-lg font-bold text-white">Nova despesa</h2>
        <p className="mt-1 text-sm text-brand-gray-light">
          Taxas do MercadoPago sao capturadas automaticamente do webhook.
        </p>
        <div className="mt-5">
          <ExpenseForm categoryOptions={CATEGORY_OPTIONS} />
        </div>
      </section>

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <select
            name="category"
            defaultValue={filters.category ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todas as categorias</option>
            {Object.values(ExpenseCategory).map((category) => (
              <option key={category} value={category}>
                {EXPENSE_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
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
          <button
            type="submit"
            className="rounded-xl bg-brand-red px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
          >
            Filtrar
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Despesas registradas</h2>
          <p className="text-xs text-brand-gray-light">
            {pagination.totalItems} registro(s)
          </p>
        </div>

        {items.length === 0 ? (
          <p className="mt-4 text-sm text-brand-gray-light">
            Nenhuma despesa encontrada para o filtro atual.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-brand-gray-mid text-sm">
            {items.map((expense) => (
              <li
                key={expense.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-semibold text-white">
                    {expense.description}
                  </p>
                  <p className="text-xs text-brand-gray-light">
                    {EXPENSE_CATEGORY_LABELS[expense.category]} -{" "}
                    {expense.incurredAt.toISOString().slice(0, 10)}
                    {expense.createdByUser
                      ? ` - por ${expense.createdByUser.name}`
                      : ""}
                  </p>
                </div>
                <span className="font-semibold text-white">
                  {formatCurrencyFromCents(expense.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
