import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import { hasPermission } from "@/lib/permissions";

const guestOnlyPaths = [
  "/login",
  "/cadastro",
  "/reenvio-confirmacao",
  "/esqueci-senha",
];

const dashboardPermissionRoutes = [
  { prefix: "/dashboard/admin", permission: "accessAdminEndpoints" as const },
  { prefix: "/dashboard/alunos", permission: "viewStudents" as const },
  { prefix: "/dashboard/professores", permission: "viewTeachers" as const },
  { prefix: "/dashboard/modalidades", permission: "viewModalities" as const },
  { prefix: "/dashboard/turmas", permission: "viewClassSchedules" as const },
  { prefix: "/dashboard/presenca", permission: "viewAttendance" as const },
  { prefix: "/dashboard/planos", permission: "viewPlans" as const },
  { prefix: "/dashboard/assinaturas", permission: "viewSubscriptions" as const },
  { prefix: "/dashboard/pagamentos", permission: "viewPayments" as const },
  { prefix: "/dashboard/treinos", permission: "viewTrainings" as const },
  { prefix: "/dashboard/produtos", permission: "viewProducts" as const },
  { prefix: "/dashboard/vendas", permission: "viewSales" as const },
  { prefix: "/dashboard/avisos", permission: "viewAnnouncements" as const },
  { prefix: "/dashboard/relatorios", permission: "viewReports" as const },
];

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const isLoggedIn = Boolean(req.auth?.user);
  const role = req.auth?.user?.role;

  if (pathname.startsWith("/dashboard") && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set(
      "callbackUrl",
      sanitizeCallbackUrl(pathname),
    );
    return NextResponse.redirect(loginUrl);
  }

  if (
    isLoggedIn &&
    guestOnlyPaths.some((path) => pathname === path)
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  for (const route of dashboardPermissionRoutes) {
    if (
      pathname.startsWith(route.prefix) &&
      (!role || !hasPermission(role, route.permission))
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/cadastro",
    "/reenvio-confirmacao",
    "/esqueci-senha",
  ],
};
