import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatus, UserRole } from "@prisma/client";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { AdvancedDashboardChart } from "@/components/dashboard/AdvancedDashboardChart";
import { SimpleBarChart } from "@/components/dashboard/SimpleBarChart";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  formatDate,
  formatTimeRange,
  getAttendanceStatusLabel,
  getStudentStatusLabel,
  getWeekdayLabels,
} from "@/lib/academy/constants";
import {
  getAttendanceStatusTone,
  getStudentStatusTone,
} from "@/lib/academy/presentation";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { requireAuthenticatedSession } from "@/lib/auth/guards";
import {
  formatCurrencyFromCents,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  getSubscriptionStatusLabel,
} from "@/lib/billing/constants";
import { getStudentFinancialSnapshot } from "@/lib/billing/service";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getAdminDashboardData,
  getReceptionDashboardData,
} from "@/lib/reports/service";
import {
  getDashboardAnnouncements,
  getStudentPerformanceSnapshot,
  getTeacherOperationalSnapshot,
} from "@/lib/training/service";
import {
  getAnnouncementTargetLabel,
  getTrainingAssignmentStatusLabel,
} from "@/lib/training/constants";
import {
  getAnnouncementTone,
  getTrainingAssignmentTone,
} from "@/lib/training/presentation";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Resumo privado da conta autenticada e dos acessos por perfil.",
};

type DashboardMetric = {
  label: string;
  value: string;
  note: string;
};

export default async function DashboardPage() {
  const session = await requireAuthenticatedSession("/dashboard");
  const viewer = await getViewerContextFromSession(session);

  const announcements = await getDashboardAnnouncements(viewer, 4);

  let metrics: DashboardMetric[] = [];
  let summaryTitle = "Visao geral";
  let summaryDescription =
    "Seu acesso esta protegido por sessao, role e verificacoes server-side.";
  let profileNotice: string | null = null;
  let studentFinancialSnapshot:
    | Awaited<ReturnType<typeof getStudentFinancialSnapshot>>
    | null = null;
  let studentPerformanceSnapshot:
    | Awaited<ReturnType<typeof getStudentPerformanceSnapshot>>
    | null = null;
  let teacherOperationalSnapshot:
    | Awaited<ReturnType<typeof getTeacherOperationalSnapshot>>
    | null = null;
  let adminDashboardData:
    | Awaited<ReturnType<typeof getAdminDashboardData>>
    | null = null;
  let receptionDashboardData:
    | Awaited<ReturnType<typeof getReceptionDashboardData>>
    | null = null;
  const moduleCards = (
    session.user.role === UserRole.ALUNO
      ? [
          {
            href: "/dashboard/turmas",
            title: "Turmas",
            description: "Horarios e grade disponivel para o seu acompanhamento.",
            visible: hasPermission(session.user.role, "viewClassSchedules"),
          },
          {
            href: "/dashboard/agenda",
            title: "Agenda",
            description: "Calendario visual das turmas ativas da semana.",
            visible: hasPermission(session.user.role, "viewClassSchedules"),
          },
          {
            href: "/dashboard/presenca",
            title: "Presenca",
            description: "Seus check-ins, historico e frequencia.",
            visible: hasPermission(session.user.role, "viewAttendance"),
          },
          {
            href: "/planos",
            title: "Planos",
            description: "Veja os planos disponiveis e escolha a melhor opcao para a sua rotina.",
            visible: true,
          },
          {
            href: "/dashboard/pagamentos",
            title: "Pagamentos",
            description: "Mensalidades, vencimentos e comprovacoes do seu perfil.",
            visible: hasPermission(session.user.role, "viewPayments"),
          },
          {
            href: "/dashboard/treinos",
            title: "Treinos",
            description: "Modelos atribuidos e historico tecnico do aluno.",
            visible: hasPermission(session.user.role, "viewTrainings"),
          },
          {
            href: "/dashboard/pedidos",
            title: "Meus pedidos",
            description: "Historico de compra, entrega e status do e-commerce.",
            visible: hasPermission(session.user.role, "viewStoreOrders"),
          },
          {
            href: "/dashboard/avisos",
            title: "Avisos",
            description: "Comunicados publicados para o seu perfil.",
            visible: hasPermission(session.user.role, "viewAnnouncements"),
          },
        ]
      : [
          {
            href: "/dashboard/alunos",
            title: "Alunos",
            description: "Cadastros, status e vinculos principais.",
            visible: hasPermission(session.user.role, "viewStudents"),
          },
          {
            href: "/dashboard/professores",
            title: "Professores",
            description: "Equipe docente e modalidades ensinadas.",
            visible: hasPermission(session.user.role, "viewTeachers"),
          },
          {
            href: "/dashboard/modalidades",
            title: "Modalidades",
            description: "Catalogo operacional da academia.",
            visible: hasPermission(session.user.role, "viewModalities"),
          },
          {
            href: "/dashboard/turmas",
            title: "Turmas",
            description: "Grade, horarios e vinculos de alunos.",
            visible: hasPermission(session.user.role, "viewClassSchedules"),
          },
          {
            href: "/dashboard/agenda",
            title: "Agenda operacional",
            description: "Calendario visual semanal com salas, professores e ocupacao.",
            visible: hasPermission(session.user.role, "viewClassSchedules"),
          },
          {
            href: "/dashboard/presenca",
            title: "Presenca",
            description: "Check-in, check-out e historico filtrado.",
            visible: hasPermission(session.user.role, "viewAttendance"),
          },
          {
            href: "/dashboard/planos",
            title: "Planos",
            description: "Catalogo comercial e recorrencias.",
            visible: hasPermission(session.user.role, "viewPlans"),
          },
          {
            href: "/dashboard/assinaturas",
            title: "Assinaturas",
            description: "Contratos, renovacoes e vinculos financeiros.",
            visible: hasPermission(session.user.role, "viewSubscriptions"),
          },
          {
            href: "/dashboard/pagamentos",
            title: "Pagamentos",
            description: "Mensalidades, vencimentos e inadimplencia.",
            visible: hasPermission(session.user.role, "viewPayments"),
          },
          {
            href: "/dashboard/treinos",
            title: "Treinos",
            description: "Modelos, atribuicoes e historico tecnico.",
            visible: hasPermission(session.user.role, "viewTrainings"),
          },
          {
            href: "/dashboard/produtos",
            title: "Produtos",
            description: "Cadastro, vitrine e estoque da loja da academia.",
            visible: hasPermission(session.user.role, "viewProducts"),
          },
          {
            href: "/dashboard/pedidos",
            title: "Meus pedidos",
            description: "Historico de compra, entrega e status do e-commerce.",
            visible: hasPermission(session.user.role, "viewStoreOrders"),
          },
          {
            href: "/dashboard/pedidos-loja",
            title: "Pedidos da loja",
            description: "Operacao administrativa de checkout, separacao e envio.",
            visible: hasPermission(session.user.role, "manageStoreOrders"),
          },
          {
            href: "/dashboard/cupons",
            title: "Cupons",
            description: "Campanhas promocionais, regras e limites do catalogo.",
            visible: hasPermission(session.user.role, "manageCoupons"),
          },
          {
            href: "/dashboard/avisos",
            title: "Avisos",
            description: "Comunicados operacionais e mensagens da academia.",
            visible: hasPermission(session.user.role, "viewAnnouncements"),
          },
          {
            href: "/dashboard/relatorios",
            title: "Relatorios",
            description: "Indicadores operacionais, financeiros e exportacao CSV.",
            visible: hasPermission(session.user.role, "viewReports"),
          },
          {
            href: "/dashboard/admin",
            title: "Area administrativa",
            description: "Painel analitico com auditoria, estoque e visao executiva.",
            visible: hasPermission(session.user.role, "accessAdminEndpoints"),
          },
        ]
  ).filter((item) => item.visible);

  const moduleSectionTitle =
    session.user.role === UserRole.ALUNO
      ? "Atalhos do aluno"
      : "Modulos operacionais";
  const moduleSectionDescription =
    session.user.role === UserRole.ALUNO
      ? "Acesse somente as areas do painel que fazem sentido para o seu acompanhamento."
      : "Atalhos do painel liberados para o seu perfil.";

  if (session.user.role === UserRole.ALUNO) {
    if (!viewer.studentProfileId) {
      profileNotice =
        "Sua conta esta autenticada, mas ainda nao tem StudentProfile vinculado. Revise o seed ou o fluxo de cadastro.";
    } else {
      const financialSnapshot = await getStudentFinancialSnapshot(viewer);
      const performanceSnapshot = await getStudentPerformanceSnapshot(viewer);
      const studentProfile = performanceSnapshot.studentProfile;

      studentFinancialSnapshot = financialSnapshot;
      studentPerformanceSnapshot = performanceSnapshot;
      const nextPayment = financialSnapshot?.nextPayment;
      const currentPlan = financialSnapshot?.activeSubscription?.plan;
      const financialStatusLabel =
        financialSnapshot?.financialStatus === "inadimplente"
          ? "Inadimplente"
          : financialSnapshot?.financialStatus === "em_dia"
            ? "Em dia"
            : "Sem cobranca";

      summaryTitle = "Painel do aluno";
      summaryDescription = `Matricula ${studentProfile.registrationNumber} com status ${getStudentStatusLabel(studentProfile.status)}.`;
      metrics = [
        {
          label: "Plano atual",
          value: currentPlan?.name ?? "Sem plano",
          note: financialSnapshot?.activeSubscription
            ? getSubscriptionStatusLabel(financialSnapshot.activeSubscription.status)
            : "Nenhuma assinatura ativa no momento.",
        },
        {
          label: "Proximo vencimento",
          value: nextPayment?.dueDate ? formatDate(nextPayment.dueDate) : "-",
          note: nextPayment
            ? `Valor ${formatCurrencyFromCents(nextPayment.amountCents)}.`
            : "Nenhuma cobranca em aberto.",
        },
        {
          label: "Status financeiro",
          value: financialStatusLabel,
          note:
            financialSnapshot?.financialStatus === "inadimplente"
              ? "Existe ao menos uma cobranca vencida."
              : "Situacao financeira atual do seu cadastro.",
        },
        {
          label: "Presencas no mes",
          value: String(performanceSnapshot.attendanceSummary.monthPresentCount),
          note: `${performanceSnapshot.activeAssignments.length} treino(s) em andamento no seu painel.`,
        },
        {
          label: "Streak atual",
          value: `${performanceSnapshot.attendanceSummary.currentStreak} dia(s)`,
          note:
            performanceSnapshot.attendanceSummary.frequencyPercent !== null
              ? `Frequencia do mes: ${performanceSnapshot.attendanceSummary.frequencyPercent}%.`
              : "Ainda sem frequencia suficiente no mes para calcular taxa.",
        },
      ];
    }
  } else if (session.user.role === UserRole.PROFESSOR) {
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        registrationNumber: true,
        isActive: true,
      },
    });

    if (!teacherProfile) {
      profileNotice =
        "Sua conta esta autenticada, mas ainda nao tem TeacherProfile vinculado.";
    } else {
      const operationalSnapshot = await getTeacherOperationalSnapshot(viewer);
      teacherOperationalSnapshot = operationalSnapshot;

      summaryTitle = "Painel do professor";
      summaryDescription = teacherProfile.registrationNumber
        ? `Registro ${teacherProfile.registrationNumber} com perfil ${teacherProfile.isActive ? "ativo" : "inativo"}.`
        : "Perfil docente com acesso a turmas e treinos.";
      metrics = [
        {
          label: "Turmas de hoje",
          value: String(operationalSnapshot.todayClasses.length),
          note: "Grade operacional do dia para o seu perfil.",
        },
        {
          label: "Modelos de treino",
          value: String(operationalSnapshot.summary.activeTemplates),
          note: "Templates que voce pode reutilizar.",
        },
        {
          label: "Treinos atribuidos",
          value: String(operationalSnapshot.summary.activeAssignments),
          note: "Acompanhamentos que ainda exigem atencao.",
        },
        {
          label: "Alunos vinculados",
          value: String(operationalSnapshot.summary.linkedStudents),
          note: `${operationalSnapshot.summary.todaysCheckIns} check-in(s) nas suas turmas hoje.`,
        },
      ];
    }
  } else if (session.user.role === UserRole.ADMIN) {
    const adminData = await getAdminDashboardData(viewer);
    const [totalStoreOrders, openStoreOrders] = await prisma.$transaction([
      prisma.order.count(),
      prisma.order.count({
        where: {
          status: {
            in: [
              OrderStatus.PENDING,
              OrderStatus.CONFIRMED,
              OrderStatus.PROCESSING,
              OrderStatus.SHIPPED,
            ],
          },
        },
      }),
    ]);
    adminDashboardData = adminData;
    summaryTitle = "Painel administrativo";
    summaryDescription =
      "Acompanhe operacao, financeiro, estoque, treinos recentes e atalhos para relatorios.";
    metrics = [
      {
        label: "Total de alunos",
        value: String(adminDashboardData.metrics.totalStudents),
        note: "Base total de perfis de aluno cadastrados.",
      },
      {
        label: "Alunos ativos",
        value: String(adminDashboardData.metrics.activeStudents),
        note: "Perfis ativos ou em periodo experimental.",
      },
      {
        label: "Inadimplentes",
        value: String(adminDashboardData.metrics.delinquentStudents),
        note: "Alunos com cobrancas pendentes vencidas.",
      },
      {
        label: "Faturamento do mes",
        value: formatCurrencyFromCents(adminDashboardData.metrics.monthRevenueCents),
        note: "Recebimentos confirmados no mes corrente.",
      },
      {
        label: "Pagamentos pendentes",
        value: String(adminDashboardData.metrics.pendingPayments),
        note: `${formatCurrencyFromCents(adminDashboardData.metrics.pendingAmountCents)} em aberto.`,
      },
      {
        label: "Pedidos da loja",
        value: String(totalStoreOrders),
        note: `${openStoreOrders} pedido(s) ainda no fluxo operacional.`,
      },
    ];
  } else {
    const receptionData = await getReceptionDashboardData(viewer);
    const openStoreOrders = await prisma.order.count({
      where: {
        status: {
          in: [
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSING,
            OrderStatus.SHIPPED,
          ],
        },
      },
    });
    receptionDashboardData = receptionData;
    summaryTitle = "Painel da recepcao";
    summaryDescription =
      "Priorize check-ins, cobrancas pendentes, atrasos, vendas e novos cadastros do dia a dia.";
    metrics = [
      {
        label: "Check-ins do dia",
        value: String(receptionDashboardData.metrics.todayCheckIns),
        note: "Movimentacao registrada hoje no controle de presenca.",
      },
      {
        label: "Pagamentos pendentes",
        value: String(receptionDashboardData.metrics.pendingPayments),
        note: `${formatCurrencyFromCents(receptionDashboardData.metrics.pendingAmountCents)} aguardando operacao.`,
      },
      {
        label: "Alunos em atraso",
        value: String(receptionDashboardData.metrics.overdueStudents),
        note: "Alunos com cobrancas vencidas e ainda em aberto.",
      },
      {
        label: "Vendas recentes",
        value: String(receptionDashboardData.metrics.recentSales),
        note: "Movimentos recentes do caixa interno.",
      },
      {
        label: "Pedidos da loja",
        value: String(openStoreOrders),
        note: "Fila online que ainda exige separacao, envio ou entrega.",
      },
      {
        label: "Cadastros recentes",
        value: String(receptionDashboardData.metrics.recentRegistrations),
        note: "Perfis adicionados recentemente na academia.",
      },
    ];
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-brand-red">
          {session.user.role}
        </p>
        <h1 className="mt-3 text-3xl font-black text-white">{summaryTitle}</h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-gray-light">
          {summaryDescription}
        </p>
      </section>

      {profileNotice ? (
        <section className="rounded-2xl border border-brand-gray-mid bg-brand-gray-dark p-5 text-sm text-brand-white">
          {profileNotice}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            note={metric.note}
          />
        ))}
      </section>

      {session.user.role === UserRole.ALUNO && studentFinancialSnapshot ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
            <h2 className="text-xl font-bold text-white">Resumo financeiro</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                  Plano atual
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {studentFinancialSnapshot.activeSubscription?.plan.name ?? "Sem plano"}
                </p>
                <p className="mt-1 text-sm text-brand-gray-light">
                  {studentFinancialSnapshot.activeSubscription
                    ? getSubscriptionStatusLabel(
                        studentFinancialSnapshot.activeSubscription.status,
                      )
                    : "Nenhuma assinatura ativa no momento."}
                </p>
              </div>
              <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                  Proxima cobranca
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {studentFinancialSnapshot.nextPayment?.dueDate
                    ? formatDate(studentFinancialSnapshot.nextPayment.dueDate)
                    : "-"}
                </p>
                <p className="mt-1 text-sm text-brand-gray-light">
                  {studentFinancialSnapshot.nextPayment
                    ? formatCurrencyFromCents(
                        studentFinancialSnapshot.nextPayment.amountCents,
                      )
                    : "Sem pagamento pendente."}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Historico recente</h2>
                <p className="mt-1 text-sm text-brand-gray-light">
                  Ultimos pagamentos registrados para o seu perfil.
                </p>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link href="/dashboard/pagamentos">Ver todos</Link>
              </Button>
            </div>

            {studentFinancialSnapshot.recentPayments.length === 0 ? (
              <p className="mt-6 text-sm text-brand-gray-light">
                Nenhum pagamento registrado para a sua conta ate o momento.
              </p>
            ) : (
              <div className="mt-6 space-y-3">
                {studentFinancialSnapshot.recentPayments.map((payment) => (
                  <article
                    key={payment.id}
                    className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {payment.description ?? "Mensalidade"}
                        </p>
                        <p className="mt-1 text-xs text-brand-gray-light">
                          Vence em {formatDate(payment.dueDate)} •{" "}
                          {getPaymentMethodLabel(payment.method)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">
                          {formatCurrencyFromCents(payment.amountCents)}
                        </p>
                        <p className="mt-1 text-xs text-brand-gray-light">
                          {getPaymentStatusLabel(payment.status, payment.dueDate)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : null}

      {session.user.role === UserRole.ALUNO && studentPerformanceSnapshot ? (
        <>
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
              <h2 className="text-xl font-bold text-white">Minha rotina</h2>
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Modalidade principal
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {studentPerformanceSnapshot.studentProfile.primaryModality?.name ?? "Nao definida"}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Professor vinculado
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {studentPerformanceSnapshot.studentProfile.responsibleTeacher?.user.name ??
                      "Equipe da academia"}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Presenca do mes
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {studentPerformanceSnapshot.attendanceSummary.monthPresentCount} aula(s)
                  </p>
                  <p className="mt-1 text-sm text-brand-gray-light">
                    {studentPerformanceSnapshot.attendanceSummary.frequencyPercent !== null
                      ? `${studentPerformanceSnapshot.attendanceSummary.frequencyPercent}% de frequencia`
                      : "Sem frequencia suficiente para calcular taxa"}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Streak atual
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {studentPerformanceSnapshot.attendanceSummary.currentStreak} dia(s)
                  </p>
                  <p className="mt-1 text-sm text-brand-gray-light">
                    {studentPerformanceSnapshot.attendanceSummary.monthNoShowCount} falta(s) no mes
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Proximas turmas</h2>
                  <p className="mt-1 text-sm text-brand-gray-light">
                    Agenda mais proxima das suas matriculas ativas.
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/turmas">Ver grade</Link>
                </Button>
              </div>

              {studentPerformanceSnapshot.nextClasses.length === 0 ? (
                <p className="mt-6 text-sm text-brand-gray-light">
                  Nenhuma turma ativa vinculada ao seu perfil neste momento.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {studentPerformanceSnapshot.nextClasses.map((classSchedule) => (
                    <article
                      key={classSchedule.id}
                      className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {classSchedule.title}
                          </p>
                          <p className="mt-1 text-xs text-brand-gray-light">
                            {classSchedule.modality.name} • {classSchedule.teacherProfile.user.name}
                          </p>
                        </div>
                        <StatusBadge tone="info">
                          {formatDate(classSchedule.nextOccurrence)}
                        </StatusBadge>
                      </div>
                      <p className="mt-3 text-xs text-brand-gray-light">
                        {getWeekdayLabels(
                          classSchedule.daysOfWeek.length > 0
                            ? classSchedule.daysOfWeek
                            : [classSchedule.dayOfWeek],
                        ).join(" • ")}{" "}
                        • {formatTimeRange(classSchedule.startTime, classSchedule.endTime)}
                      </p>
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
                  <h2 className="text-xl font-bold text-white">Treinos atribuidos</h2>
                  <p className="mt-1 text-sm text-brand-gray-light">
                    Seus treinos mais recentes com status e validade.
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/treinos">Abrir painel</Link>
                </Button>
              </div>

              {studentPerformanceSnapshot.activeAssignments.length === 0 ? (
                <p className="mt-6 text-sm text-brand-gray-light">
                  Nenhum treino em andamento no momento.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {studentPerformanceSnapshot.activeAssignments.slice(0, 4).map((assignment) => (
                    <article
                      key={assignment.id}
                      className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {assignment.title}
                          </p>
                          <p className="mt-1 text-xs text-brand-gray-light">
                            {assignment.trainingTemplate?.modality?.name ?? "Treino livre"} •{" "}
                            {assignment.trainingTemplate?.level ?? "nivel livre"}
                          </p>
                        </div>
                        <StatusBadge tone={getTrainingAssignmentTone(assignment.status)}>
                          {getTrainingAssignmentStatusLabel(assignment.status)}
                        </StatusBadge>
                      </div>
                      <p className="mt-3 text-xs text-brand-gray-light">
                        Validade {formatDate(assignment.dueAt)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Historico de presenca</h2>
                  <p className="mt-1 text-sm text-brand-gray-light">
                    Seus registros recentes de check-in e check-out.
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/presenca">Ver tudo</Link>
                </Button>
              </div>

              {studentPerformanceSnapshot.recentAttendance.length === 0 ? (
                <p className="mt-6 text-sm text-brand-gray-light">
                  Ainda nao existem registros de presenca para sua conta.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {studentPerformanceSnapshot.recentAttendance.map((attendance) => (
                    <article
                      key={attendance.id}
                      className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {attendance.classSchedule.title}
                          </p>
                          <p className="mt-1 text-xs text-brand-gray-light">
                            {attendance.classSchedule.modality.name} •{" "}
                            {attendance.classSchedule.teacherProfile.user.name}
                          </p>
                        </div>
                        <StatusBadge tone={getAttendanceStatusTone(attendance.status)}>
                          {getAttendanceStatusLabel(attendance.status)}
                        </StatusBadge>
                      </div>
                      <p className="mt-3 text-xs text-brand-gray-light">
                        {formatDate(attendance.classDate)} •{" "}
                        {formatTimeRange(
                          attendance.classSchedule.startTime,
                          attendance.classSchedule.endTime,
                        )}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </article>
          </section>
        </>
      ) : null}

      {session.user.role === UserRole.PROFESSOR && teacherOperationalSnapshot ? (
        <>
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Turmas do dia</h2>
                  <p className="mt-1 text-sm text-brand-gray-light">
                    Grade programada para hoje nas suas modalidades.
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/turmas">Abrir turmas</Link>
                </Button>
              </div>

              {teacherOperationalSnapshot.todayClasses.length === 0 ? (
                <p className="mt-6 text-sm text-brand-gray-light">
                  Nenhuma turma programada para hoje.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {teacherOperationalSnapshot.todayClasses.map((classSchedule) => (
                    <article
                      key={classSchedule.id}
                      className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {classSchedule.title}
                          </p>
                          <p className="mt-1 text-xs text-brand-gray-light">
                            {classSchedule.modality.name} • sala {classSchedule.room ?? "principal"}
                          </p>
                        </div>
                        <StatusBadge tone="info">
                          {classSchedule._count.enrollments} aluno(s)
                        </StatusBadge>
                      </div>
                      <p className="mt-3 text-xs text-brand-gray-light">
                        {formatTimeRange(classSchedule.startTime, classSchedule.endTime)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
              <h2 className="text-xl font-bold text-white">Atalhos operacionais</h2>
              <div className="mt-5 grid grid-cols-1 gap-3">
                <Link
                  href="/dashboard/presenca"
                  className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4 transition hover:border-brand-red/40"
                >
                  <p className="text-sm font-semibold text-white">Registrar presenca</p>
                  <p className="mt-1 text-xs text-brand-gray-light">
                    Check-in, check-out e acompanhamento da turma.
                  </p>
                </Link>
                <Link
                  href="/dashboard/treinos"
                  className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4 transition hover:border-brand-red/40"
                >
                  <p className="text-sm font-semibold text-white">Gerenciar treinos</p>
                  <p className="mt-1 text-xs text-brand-gray-light">
                    Modelos ativos, atribuicoes e progresso dos alunos.
                  </p>
                </Link>
                <Link
                  href="/dashboard/turmas"
                  className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4 transition hover:border-brand-red/40"
                >
                  <p className="text-sm font-semibold text-white">Abrir turmas</p>
                  <p className="mt-1 text-xs text-brand-gray-light">
                    Grade, horarios e vinculos sob sua responsabilidade.
                  </p>
                </Link>
              </div>
            </article>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Presenca recente</h2>
                  <p className="mt-1 text-sm text-brand-gray-light">
                    Ultimos registros das turmas vinculadas ao seu perfil.
                  </p>
                </div>
                <StatusBadge tone="neutral">
                  {teacherOperationalSnapshot.recentAttendance.length} registro(s)
                </StatusBadge>
              </div>

              {teacherOperationalSnapshot.recentAttendance.length === 0 ? (
                <p className="mt-6 text-sm text-brand-gray-light">
                  Ainda nao ha registros recentes de presenca nas suas turmas.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {teacherOperationalSnapshot.recentAttendance.map((attendance) => (
                    <article
                      key={attendance.id}
                      className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {attendance.studentProfile.user.name}
                          </p>
                          <p className="mt-1 text-xs text-brand-gray-light">
                            {attendance.classSchedule.title} • {attendance.classSchedule.modality.name}
                          </p>
                        </div>
                        <StatusBadge tone={getAttendanceStatusTone(attendance.status)}>
                          {getAttendanceStatusLabel(attendance.status)}
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
                  <h2 className="text-xl font-bold text-white">Treinos recentes</h2>
                  <p className="mt-1 text-sm text-brand-gray-light">
                    Ultimas atribuicoes e acompanhamentos em aberto.
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/treinos">Abrir treinos</Link>
                </Button>
              </div>

              {teacherOperationalSnapshot.recentAssignments.length === 0 ? (
                <p className="mt-6 text-sm text-brand-gray-light">
                  Nenhum treino atribuido recentemente para o seu perfil.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {teacherOperationalSnapshot.recentAssignments.map((assignment) => (
                    <article
                      key={assignment.id}
                      className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {assignment.studentProfile.user.name}
                          </p>
                          <p className="mt-1 text-xs text-brand-gray-light">
                            {assignment.title} •{" "}
                            {assignment.trainingTemplate?.modality?.name ?? "treino livre"}
                          </p>
                        </div>
                        <StatusBadge tone={getTrainingAssignmentTone(assignment.status)}>
                          {getTrainingAssignmentStatusLabel(assignment.status)}
                        </StatusBadge>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>
          </section>
        </>
      ) : null}

      {session.user.role === UserRole.ADMIN && adminDashboardData ? (
        <>
          <AdvancedDashboardChart
            title="Receita e presenca"
            description="Comparativo executivo dos ultimos meses para acompanhar caixa e recorrencia operacional."
            primaryLabel="Faturamento"
            secondaryLabel="Presencas"
            primaryPoints={adminDashboardData.charts.revenueByMonth}
            secondaryPoints={adminDashboardData.charts.attendanceByMonth}
            primaryFormatter={(value) => formatCurrencyFromCents(value)}
          />

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SimpleBarChart
              title="Faturamento recente"
              description="Receita confirmada nos ultimos meses."
              points={adminDashboardData.charts.revenueByMonth}
              formatter={(value) => formatCurrencyFromCents(value)}
              tone="emerald"
            />
            <SimpleBarChart
              title="Presenca recente"
              description="Check-ins e check-outs dos ultimos dias."
              points={adminDashboardData.charts.attendanceByDay}
              tone="sky"
            />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Pagamentos recentes</h2>
                  <p className="mt-1 text-sm text-brand-gray-light">
                    Ultimos movimentos financeiros processados no sistema.
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/pagamentos">Abrir financeiro</Link>
                </Button>
              </div>

              {adminDashboardData.recentPayments.length === 0 ? (
                <p className="mt-6 text-sm text-brand-gray-light">
                  Nenhum pagamento recente para exibir.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {adminDashboardData.recentPayments.slice(0, 5).map((payment) => (
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
                          <StatusBadge
                            tone={
                              payment.status === "PAID"
                                ? "success"
                                : payment.status === "PENDING"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
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

            <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Estoque baixo</h2>
                  <p className="mt-1 text-sm text-brand-gray-light">
                    Produtos que ja merecem reposicao ou revisao.
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/produtos">Abrir produtos</Link>
                </Button>
              </div>

              {adminDashboardData.lowStockProducts.length === 0 ? (
                <p className="mt-6 text-sm text-brand-gray-light">
                  Nenhum alerta de estoque baixo no momento.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {adminDashboardData.lowStockProducts.map((product) => (
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
                  <h2 className="text-xl font-bold text-white">Vendas recentes</h2>
                  <p className="mt-1 text-sm text-brand-gray-light">
                    Ultimas vendas internas registradas no caixa.
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/vendas">Abrir vendas</Link>
                </Button>
              </div>

              {adminDashboardData.recentSales.length === 0 ? (
                <p className="mt-6 text-sm text-brand-gray-light">
                  Nenhuma venda recente para exibir.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {adminDashboardData.recentSales.slice(0, 5).map((sale) => (
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
                  <h2 className="text-xl font-bold text-white">Treinos e auditoria</h2>
                  <p className="mt-1 text-sm text-brand-gray-light">
                    Veja o que mudou recentemente e aprofunde na area admin.
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/admin">Abrir area admin</Link>
                </Button>
              </div>

              <div className="mt-6 space-y-3">
                {adminDashboardData.recentTrainings.slice(0, 3).map((training) => (
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
                  </article>
                ))}

                {adminDashboardData.recentAuditLogs.slice(0, 3).map((log) => (
                  <article
                    key={log.id}
                    className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone="info">{log.action}</StatusBadge>
                      <span className="text-sm font-semibold text-white">{log.entityType}</span>
                    </div>
                    <p className="mt-2 text-sm text-brand-gray-light">{log.summary}</p>
                  </article>
                ))}
              </div>
            </article>
          </section>
        </>
      ) : null}

      {session.user.role === UserRole.RECEPCAO && receptionDashboardData ? (
        <>
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SimpleBarChart
              title="Check-ins da semana"
              description="Volume recente de presencas registradas pela operacao."
              points={receptionDashboardData.charts.checkInsByDay}
              tone="sky"
            />

            <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Pagamentos pendentes</h2>
                  <p className="mt-1 text-sm text-brand-gray-light">
                    Proximos vencimentos para acompanhamento rapido do caixa.
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/pagamentos">Abrir pagamentos</Link>
                </Button>
              </div>

              {receptionDashboardData.upcomingPendingPayments.length === 0 ? (
                <p className="mt-6 text-sm text-brand-gray-light">
                  Nenhum vencimento pendente nos proximos registros.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {receptionDashboardData.upcomingPendingPayments.map((payment) => (
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
                            {payment.subscription.plan.name} - {payment.studentProfile.registrationNumber}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-white">
                            {formatCurrencyFromCents(payment.amountCents)}
                          </p>
                          <p className="mt-1 text-xs text-brand-gray-light">
                            Vence em {formatDate(payment.dueDate)}
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
                  <h2 className="text-xl font-bold text-white">Check-ins do dia</h2>
                  <p className="mt-1 text-sm text-brand-gray-light">
                    Ultimos alunos registrados na entrada hoje.
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/presenca">Abrir presenca</Link>
                </Button>
              </div>

              {receptionDashboardData.todayAttendance.length === 0 ? (
                <p className="mt-6 text-sm text-brand-gray-light">
                  Nenhum check-in registrado hoje.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {receptionDashboardData.todayAttendance.map((attendance) => (
                    <article
                      key={attendance.id}
                      className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {attendance.studentProfile.user.name}
                          </p>
                          <p className="mt-1 text-xs text-brand-gray-light">
                            {attendance.classSchedule.title} - {attendance.classSchedule.modality.name}
                          </p>
                        </div>
                        <StatusBadge tone={getAttendanceStatusTone(attendance.status)}>
                          {getAttendanceStatusLabel(attendance.status)}
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
                  <h2 className="text-xl font-bold text-white">Vendas e cadastros recentes</h2>
                  <p className="mt-1 text-sm text-brand-gray-light">
                    O que a recepcao precisa acompanhar sem sair do painel.
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/relatorios">Abrir relatorios</Link>
                </Button>
              </div>

              <div className="mt-6 space-y-3">
                {receptionDashboardData.recentSales.slice(0, 3).map((sale) => (
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

                {receptionDashboardData.recentStudents.slice(0, 3).map((student) => (
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
            </article>
          </section>
        </>
      ) : null}

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">{moduleSectionTitle}</h2>
            <p className="mt-1 text-sm text-brand-gray-light">
              {moduleSectionDescription}
            </p>
          </div>
          <div className="rounded-full border border-brand-gray-mid px-3 py-1 text-xs text-brand-gray-light">
            {moduleCards.length} modulo(s)
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {moduleCards.map((moduleCard) => (
            <Link
              key={moduleCard.href}
              href={moduleCard.href}
              className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-5 transition hover:border-brand-red/40 hover:bg-brand-black/60"
            >
              <h3 className="text-lg font-bold text-white">{moduleCard.title}</h3>
              <p className="mt-2 text-sm text-brand-gray-light">
                {moduleCard.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Avisos do painel</h2>
            <p className="mt-1 text-sm text-brand-gray-light">
              Comunicados publicados para o seu perfil.
            </p>
          </div>
          <div className="rounded-full border border-brand-gray-mid px-3 py-1 text-xs text-brand-gray-light">
            {announcements.length} aviso(s)
          </div>
        </div>

        {announcements.length === 0 ? (
          <p className="mt-6 text-sm text-brand-gray-light">
            Nenhum aviso publicado para o seu perfil neste momento.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {announcements.map((announcement) => {
              const expired = Boolean(
                announcement.expiresAt &&
                  announcement.expiresAt.getTime() <= Date.now(),
              );

              return (
                <Link
                  key={announcement.id}
                  href={`/dashboard/avisos/${announcement.id}`}
                  className="group block rounded-3xl border border-brand-gray-mid bg-brand-black/40 p-5 transition hover:border-brand-red/40 hover:bg-brand-black/60"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      tone={getAnnouncementTone({
                        isPinned: announcement.isPinned,
                        isPublished: announcement.isPublished,
                        expired,
                      })}
                    >
                      {announcement.isPublished
                        ? expired
                          ? "Expirado"
                          : "Publicado"
                        : "Rascunho"}
                    </StatusBadge>
                    {announcement.isPinned ? (
                      <StatusBadge tone="warning">Fixado</StatusBadge>
                    ) : null}
                    <StatusBadge tone="info">
                      {getAnnouncementTargetLabel(announcement.targetRole)}
                    </StatusBadge>
                  </div>

                  <h3 className="mt-4 line-clamp-2 text-lg font-bold text-white transition group-hover:text-brand-red">
                    {announcement.title}
                  </h3>

                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-brand-gray-light">
                    {announcement.excerpt ?? "Abra o aviso para ver o comunicado completo."}
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-3 border-t border-brand-gray-mid/70 pt-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-brand-gray-light">
                        Publicado em
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {formatDate(announcement.publishedAt ?? announcement.createdAt)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-brand-gray-light">
                        Expira em
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {announcement.expiresAt ? formatDate(announcement.expiresAt) : "Sem prazo"}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
