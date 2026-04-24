import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

export const PERMISSIONS = {
  accessAdminEndpoints: [UserRole.ADMIN],
  viewStudents: [
    UserRole.ADMIN,
    UserRole.RECEPCAO,
    UserRole.PROFESSOR,
  ],
  manageStudents: [UserRole.ADMIN, UserRole.RECEPCAO],
  viewTeachers: [UserRole.ADMIN, UserRole.RECEPCAO, UserRole.PROFESSOR],
  manageTeachers: [UserRole.ADMIN],
  viewModalities: [
    UserRole.ADMIN,
    UserRole.RECEPCAO,
    UserRole.PROFESSOR,
  ],
  manageModalities: [UserRole.ADMIN],
  viewClassSchedules: [
    UserRole.ADMIN,
    UserRole.RECEPCAO,
    UserRole.PROFESSOR,
    UserRole.ALUNO,
  ],
  viewAttendance: [
    UserRole.ADMIN,
    UserRole.RECEPCAO,
    UserRole.PROFESSOR,
    UserRole.ALUNO,
  ],
  viewPlans: [UserRole.ADMIN, UserRole.RECEPCAO],
  managePlans: [UserRole.ADMIN],
  viewSubscriptions: [UserRole.ADMIN, UserRole.RECEPCAO, UserRole.ALUNO],
  manageSubscriptions: [UserRole.ADMIN, UserRole.RECEPCAO],
  viewPayments: [UserRole.ADMIN, UserRole.RECEPCAO, UserRole.ALUNO],
  viewTrainings: [UserRole.ADMIN, UserRole.PROFESSOR, UserRole.ALUNO],
  viewProducts: [UserRole.ADMIN, UserRole.RECEPCAO, UserRole.PROFESSOR],
  manageProducts: [UserRole.ADMIN, UserRole.RECEPCAO],
  viewSales: [UserRole.ADMIN, UserRole.RECEPCAO],
  manageSales: [UserRole.ADMIN, UserRole.RECEPCAO],
  viewStoreOrders: [
    UserRole.ADMIN,
    UserRole.RECEPCAO,
    UserRole.PROFESSOR,
    UserRole.ALUNO,
  ],
  manageStoreOrders: [UserRole.ADMIN, UserRole.RECEPCAO],
  manageCoupons: [UserRole.ADMIN, UserRole.RECEPCAO],
  managePayments: [UserRole.ADMIN, UserRole.RECEPCAO],
  manageAttendance: [
    UserRole.ADMIN,
    UserRole.RECEPCAO,
    UserRole.PROFESSOR,
  ],
  manageTrainings: [UserRole.ADMIN, UserRole.PROFESSOR],
  viewAnnouncements: [
    UserRole.ADMIN,
    UserRole.RECEPCAO,
    UserRole.PROFESSOR,
    UserRole.ALUNO,
  ],
  manageAnnouncements: [
    UserRole.ADMIN,
    UserRole.RECEPCAO,
    UserRole.PROFESSOR,
  ],
  manageClassSchedules: [
    UserRole.ADMIN,
    UserRole.RECEPCAO,
  ],
  viewReports: [UserRole.ADMIN, UserRole.RECEPCAO],
  uploadFiles: [UserRole.ADMIN, UserRole.RECEPCAO, UserRole.PROFESSOR],
  exportReports: [UserRole.ADMIN, UserRole.RECEPCAO],
  viewPhysicalAssessments: [
    UserRole.ADMIN,
    UserRole.RECEPCAO,
    UserRole.PROFESSOR,
    UserRole.ALUNO,
  ],
  managePhysicalAssessments: [
    UserRole.ADMIN,
    UserRole.RECEPCAO,
    UserRole.PROFESSOR,
  ],
  viewGamification: [
    UserRole.ADMIN,
    UserRole.RECEPCAO,
    UserRole.PROFESSOR,
    UserRole.ALUNO,
  ],
  viewFinancialReports: [UserRole.ADMIN],
  manageExpenses: [UserRole.ADMIN, UserRole.RECEPCAO],
  viewNutritionPlans: [
    UserRole.ADMIN,
    UserRole.RECEPCAO,
    UserRole.PROFESSOR,
    UserRole.ALUNO,
  ],
  manageNutritionPlans: [UserRole.ADMIN, UserRole.PROFESSOR],
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export function hasAnyRole(role: UserRole, roles: readonly UserRole[]) {
  return roles.includes(role);
}

export function hasPermission(role: UserRole, permission: PermissionKey) {
  const allowedRoles = PERMISSIONS[permission] as readonly UserRole[];
  return allowedRoles.includes(role);
}

export async function requireAuthenticatedSession(
  callbackUrl = "/dashboard",
) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(
        sanitizeCallbackUrl(callbackUrl),
      )}`,
    );
  }

  return session;
}

export async function requireRole(
  roles: UserRole[],
  callbackUrl = "/dashboard",
) {
  const session = await requireAuthenticatedSession(callbackUrl);

  if (!hasAnyRole(session.user.role, roles)) {
    redirect("/dashboard");
  }

  return session;
}

export async function requirePermission(
  permission: PermissionKey,
  callbackUrl = "/dashboard",
) {
  const session = await requireAuthenticatedSession(callbackUrl);

  if (!hasPermission(session.user.role, permission)) {
    redirect("/dashboard");
  }

  return session;
}

export async function requireApiRole(roles: UserRole[]) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new UnauthorizedError("Nao autorizado.");
  }

  if (!hasAnyRole(session.user.role, roles)) {
    throw new ForbiddenError("Acesso negado.");
  }

  return session;
}

export async function requireApiPermission(permission: PermissionKey) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new UnauthorizedError("Nao autorizado.");
  }

  if (!hasPermission(session.user.role, permission)) {
    throw new ForbiddenError("Acesso negado.");
  }

  return session;
}
