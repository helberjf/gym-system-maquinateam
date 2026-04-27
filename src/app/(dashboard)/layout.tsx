import Link from "next/link";
import { UserRole } from "@prisma/client";
import { signOut } from "@/auth";
import { DashboardNotifications } from "@/components/dashboard/DashboardNotifications";
import { BRAND } from "@/lib/constants/brand";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { requireAuthenticatedSession } from "@/lib/auth/guards";
import { getDashboardNotifications } from "@/lib/notifications/service";
import { hasPermission } from "@/lib/permissions";

const roleLabelMap: Record<UserRole, string> = {
  ADMIN: "Administrador",
  RECEPCAO: "Recepcao",
  PROFESSOR: "Professor",
  ALUNO: "Aluno",
};

const roleBadgeClassMap: Record<UserRole, string> = {
  ADMIN: "bg-brand-red/15 text-brand-red border-brand-red/40",
  RECEPCAO: "bg-brand-white/5 text-brand-white border-brand-white/15",
  PROFESSOR: "bg-brand-gray-mid/60 text-brand-white border-brand-gray-light/25",
  ALUNO: "bg-brand-black/70 text-brand-white border-brand-gray-light/20",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuthenticatedSession("/dashboard");
  const viewer = await getViewerContextFromSession(session);
  const notifications = await getDashboardNotifications(viewer);
  const sidebarNotice =
    session.user.role === UserRole.ALUNO
      ? null
      : "Modulos operacionais e financeiros protegidos no proxy, no servidor e nas mutacoes sensiveis.";

  const sidebarLinks = [
    {
      href: "/dashboard",
      label: "Painel",
      visible: true,
    },
    {
      href: "/dashboard/alunos",
      label: "Alunos",
      visible: hasPermission(session.user.role, "viewStudents"),
    },
    {
      href: "/dashboard/professores",
      label: "Professores",
      visible: hasPermission(session.user.role, "viewTeachers"),
    },
    {
      href: "/dashboard/modalidades",
      label: "Modalidades",
      visible: hasPermission(session.user.role, "viewModalities"),
    },
    {
      href: "/dashboard/turmas",
      label: "Turmas",
      visible: hasPermission(session.user.role, "viewClassSchedules"),
    },
    {
      href: "/dashboard/agenda",
      label: "Agenda",
      visible: hasPermission(session.user.role, "viewClassSchedules"),
    },
    {
      href: "/dashboard/planos",
      label: "Planos",
      visible: hasPermission(session.user.role, "viewPlans"),
    },
    {
      href:
        session.user.role === UserRole.ALUNO ? "/planos" : "/dashboard/assinaturas",
      label: session.user.role === UserRole.ALUNO ? "Planos" : "Assinaturas",
      visible:
        session.user.role === UserRole.ALUNO
          ? true
          : hasPermission(session.user.role, "viewSubscriptions"),
    },
    {
      href: "/dashboard/pagamentos",
      label: "Pagamentos",
      visible: hasPermission(session.user.role, "viewPayments"),
    },
    {
      href: "/dashboard/treinos",
      label: "Treinos",
      visible: hasPermission(session.user.role, "viewTrainings"),
    },
    {
      href: "/dashboard/produtos",
      label: "Produtos",
      visible: hasPermission(session.user.role, "viewProducts"),
    },
    {
      href: "/dashboard/vendas",
      label: "Vendas",
      visible: hasPermission(session.user.role, "viewSales"),
    },
    {
      href: "/dashboard/pedidos",
      label: "Meus pedidos",
      visible: hasPermission(session.user.role, "viewStoreOrders"),
    },
    {
      href: "/dashboard/pedidos-loja",
      label: "Pedidos da loja",
      visible: hasPermission(session.user.role, "manageStoreOrders"),
    },
    {
      href: "/dashboard/cupons",
      label: "Cupons",
      visible: hasPermission(session.user.role, "manageCoupons"),
    },
    {
      href: "/dashboard/avisos",
      label: "Avisos",
      visible: hasPermission(session.user.role, "viewAnnouncements"),
    },
    {
      href: "/dashboard/relatorios",
      label: "Relatorios",
      visible: hasPermission(session.user.role, "viewReports"),
    },
    {
      href: "/dashboard/admin",
      label: "Area administrativa",
      visible: hasPermission(session.user.role, "accessAdminEndpoints"),
    },
  ].filter((item) => item.visible);

  async function handleSignOut() {
    "use server";

    await signOut({
      redirectTo: "/login",
    });
  }

  return (
    <div className="min-h-screen bg-brand-black text-white">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="w-full border-b border-brand-gray-mid bg-brand-gray-dark md:min-h-screen md:w-72 md:border-b-0 md:border-r">
          <div className="flex h-full flex-col gap-6 px-5 py-6">
            <div>
              <Link href="/" className="text-sm font-bold text-white">
                {BRAND.name}
              </Link>
              <p className="mt-2 text-sm text-brand-gray-light">
                Acesso privado da academia.
              </p>
            </div>

            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/50 p-4">
              <p className="text-sm font-semibold text-white">
                {session.user.name ?? "Conta autenticada"}
              </p>
              <p className="mt-1 text-xs text-brand-gray-light">
                {session.user.email}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={[
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                    roleBadgeClassMap[session.user.role],
                  ].join(" ")}
                >
                  {roleLabelMap[session.user.role]}
                </span>
                <span
                  className={[
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                    session.user.emailVerified
                      ? "border-brand-white/15 bg-brand-white/5 text-brand-white"
                      : "border-brand-gray-light/25 bg-brand-gray-mid/60 text-brand-white",
                  ].join(" ")}
                >
                  {session.user.emailVerified ? "E-mail verificado" : "E-mail pendente"}
                </span>
              </div>
            </div>

            <nav className="space-y-1">
              {sidebarLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-xl px-3 py-2 text-sm text-brand-gray-light transition hover:bg-brand-gray-mid hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto rounded-2xl border border-brand-gray-mid bg-brand-black/50 p-4">
              {sidebarNotice ? (
                <p className="text-sm text-brand-gray-light">{sidebarNotice}</p>
              ) : null}
              <form action={handleSignOut} className="mt-4">
                <button
                  type="submit"
                  className="w-full rounded-xl border border-brand-gray-mid px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-gray-mid"
                >
                  Sair da conta
                </button>
              </form>
            </div>
          </div>
        </aside>

        <main className="flex-1 px-5 py-6 md:px-8 md:py-8">
          <DashboardNotifications notifications={notifications} />
          {children}
        </main>
      </div>
    </div>
  );
}
