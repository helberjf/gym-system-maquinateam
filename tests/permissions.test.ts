import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

describe("role permissions smoke tests", () => {
  it("allows admin to access sensitive modules", () => {
    expect(hasPermission(UserRole.ADMIN, "accessAdminEndpoints")).toBe(true);
    expect(hasPermission(UserRole.ADMIN, "viewReports")).toBe(true);
    expect(hasPermission(UserRole.ADMIN, "managePayments")).toBe(true);
  });

  it("restricts financial access for professors and students", () => {
    expect(hasPermission(UserRole.PROFESSOR, "viewPayments")).toBe(false);
    expect(hasPermission(UserRole.PROFESSOR, "managePayments")).toBe(false);
    expect(hasPermission(UserRole.ALUNO, "accessAdminEndpoints")).toBe(false);
    expect(hasPermission(UserRole.ALUNO, "viewReports")).toBe(false);
  });

  it("keeps reception with operational but not full admin access", () => {
    expect(hasPermission(UserRole.RECEPCAO, "manageAttendance")).toBe(true);
    expect(hasPermission(UserRole.RECEPCAO, "viewReports")).toBe(true);
    expect(hasPermission(UserRole.RECEPCAO, "accessAdminEndpoints")).toBe(false);
  });
});
