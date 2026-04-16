import { beforeEach, describe, expect, it, vi } from "vitest";
import * as adminAuditLogRoute from "@/app/api/admin/audit-log/route";
import * as announcementsRoute from "@/app/api/announcements/route";
import * as announcementsIdRoute from "@/app/api/announcements/[id]/route";
import * as attendanceCheckInRoute from "@/app/api/attendance/check-in/route";
import * as attendanceCheckOutRoute from "@/app/api/attendance/check-out/route";
import * as classSchedulesRoute from "@/app/api/class-schedules/route";
import * as classSchedulesIdRoute from "@/app/api/class-schedules/[id]/route";
import * as modalitiesRoute from "@/app/api/modalities/route";
import * as modalitiesIdRoute from "@/app/api/modalities/[id]/route";
import * as reportsExportRoute from "@/app/api/reports/export/route";
import * as studentsRoute from "@/app/api/students/route";
import * as studentsIdRoute from "@/app/api/students/[id]/route";
import * as teachersRoute from "@/app/api/teachers/route";
import * as teachersIdRoute from "@/app/api/teachers/[id]/route";
import * as trainingAssignmentsRoute from "@/app/api/training-assignments/route";
import * as trainingAssignmentsIdRoute from "@/app/api/training-assignments/[id]/route";
import * as trainingTemplatesRoute from "@/app/api/training-templates/route";
import * as trainingTemplatesIdRoute from "@/app/api/training-templates/[id]/route";
import * as trainingTemplatesDuplicateRoute from "@/app/api/training-templates/[id]/duplicate/route";
import {
  expectRateLimitHeaders,
  jsonRequest,
  paramsContext,
  readJson,
} from "./helpers/api-route";

const mocks = vi.hoisted(() => {
  const session = {
    user: {
      id: "admin-1",
      role: "ADMIN",
    },
  };
  const viewer = {
    userId: "admin-1",
    role: "ADMIN",
    studentProfileId: null,
    teacherProfileId: null,
  };
  const rateLimitHeaders = new Headers({ "X-RateLimit-Limit": "99" });

  return {
    session,
    viewer,
    rateLimitHeaders,
    requireApiPermission: vi.fn(async () => session),
    requireApiRole: vi.fn(async () => session),
    getViewerContextFromSession: vi.fn(async () => viewer),
    enforceRateLimit: vi.fn(async () => ({
      headers: rateLimitHeaders,
    })),
    parseJsonBody: vi.fn(async (request: Request) => request.json()),
    parseSearchParams: vi.fn(
      (input: URLSearchParams | Record<string, unknown>) =>
        input instanceof URLSearchParams
          ? Object.fromEntries(input.entries())
          : input,
    ),
    prisma: {
      auditLog: {
        findMany: vi.fn(async () => [
          {
            id: "log-1",
            action: "USER_CREATED",
          },
        ]),
      },
    },
    createAnnouncement: vi.fn(async () => ({ id: "announcement-1" })),
    updateAnnouncement: vi.fn(async () => ({ id: "announcement-1" })),
    unpublishAnnouncement: vi.fn(async () => undefined),
    checkInStudent: vi.fn(async () => ({ id: "attendance-1" })),
    checkOutStudent: vi.fn(async () => ({ id: "attendance-1" })),
    createClassSchedule: vi.fn(async () => ({ id: "schedule-1" })),
    updateClassSchedule: vi.fn(async () => ({ id: "schedule-1" })),
    archiveClassSchedule: vi.fn(async () => undefined),
    createModality: vi.fn(async () => ({ id: "modality-1", slug: "jiu-jitsu" })),
    updateModality: vi.fn(async () => ({ id: "modality-1", slug: "jiu-jitsu" })),
    archiveModality: vi.fn(async () => undefined),
    exportReportCsv: vi.fn(async () => "name,email\nAna,ana@example.com"),
    createStudent: vi.fn(async () => ({
      student: {
        id: "student-1",
        registrationNumber: "STU-001",
      },
    })),
    updateStudent: vi.fn(async () => ({
      id: "student-1",
      registrationNumber: "STU-001",
    })),
    deactivateStudent: vi.fn(async () => undefined),
    createTeacher: vi.fn(async () => ({
      teacher: {
        id: "teacher-1",
        registrationNumber: "TEA-001",
      },
    })),
    updateTeacher: vi.fn(async () => ({
      id: "teacher-1",
      registrationNumber: "TEA-001",
    })),
    deactivateTeacher: vi.fn(async () => undefined),
    createTrainingAssignments: vi.fn(async () => [
      { id: "assignment-1" },
      { id: "assignment-2" },
    ]),
    updateTrainingAssignment: vi.fn(async () => ({ id: "assignment-1" })),
    createTrainingTemplate: vi.fn(async () => ({ id: "template-1" })),
    updateTrainingTemplate: vi.fn(async () => ({ id: "template-1" })),
    archiveTrainingTemplate: vi.fn(async () => undefined),
    duplicateTrainingTemplate: vi.fn(async () => ({ id: "template-2" })),
  };
});

vi.mock("@/lib/permissions", () => ({
  requireApiPermission: mocks.requireApiPermission,
  requireApiRole: mocks.requireApiRole,
}));

vi.mock("@/lib/academy/access", () => ({
  getViewerContextFromSession: mocks.getViewerContextFromSession,
}));

vi.mock("@/lib/rate-limit", () => ({
  adminLimiter: { key: "admin" },
  attachRateLimitHeaders: (response: Response, headers?: HeadersInit) => {
    if (!headers) {
      return response;
    }

    const nextHeaders = new Headers(headers);
    nextHeaders.forEach((value, key) => {
      response.headers.set(key, value);
    });

    return response;
  },
  enforceRateLimit: mocks.enforceRateLimit,
  mutationLimiter: { key: "mutation" },
  reportLimiter: { key: "report" },
}));

vi.mock("@/lib/validators", async () => {
  const actual = await vi.importActual<typeof import("@/lib/validators")>(
    "@/lib/validators",
  );

  return {
    ...actual,
    parseJsonBody: mocks.parseJsonBody,
    parseSearchParams: mocks.parseSearchParams,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/academy/service", () => ({
  checkInStudent: mocks.checkInStudent,
  checkOutStudent: mocks.checkOutStudent,
  createClassSchedule: mocks.createClassSchedule,
  updateClassSchedule: mocks.updateClassSchedule,
  archiveClassSchedule: mocks.archiveClassSchedule,
  createModality: mocks.createModality,
  updateModality: mocks.updateModality,
  archiveModality: mocks.archiveModality,
  createStudent: mocks.createStudent,
  updateStudent: mocks.updateStudent,
  deactivateStudent: mocks.deactivateStudent,
  createTeacher: mocks.createTeacher,
  updateTeacher: mocks.updateTeacher,
  deactivateTeacher: mocks.deactivateTeacher,
}));

vi.mock("@/lib/training/service", () => ({
  createAnnouncement: mocks.createAnnouncement,
  updateAnnouncement: mocks.updateAnnouncement,
  unpublishAnnouncement: mocks.unpublishAnnouncement,
  createTrainingAssignments: mocks.createTrainingAssignments,
  updateTrainingAssignment: mocks.updateTrainingAssignment,
  createTrainingTemplate: mocks.createTrainingTemplate,
  updateTrainingTemplate: mocks.updateTrainingTemplate,
  archiveTrainingTemplate: mocks.archiveTrainingTemplate,
  duplicateTrainingTemplate: mocks.duplicateTrainingTemplate,
}));

vi.mock("@/lib/reports/service", () => ({
  exportReportCsv: mocks.exportReportCsv,
}));

describe("Academy API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns recent admin audit logs", async () => {
    const response = await adminAuditLogRoute.GET(
      new Request("https://example.com/api/admin/audit-log"),
    );
    const body = await readJson<{
      ok: boolean;
      logs: Array<{ id: string; action: string }>;
    }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.logs[0]?.id).toBe("log-1");
  });

  const createCases = [
    {
      name: "creates announcements",
      handler: announcementsRoute.POST,
      request: jsonRequest("https://example.com/api/announcements", {
        title: "Novo aviso",
      }),
      expectedStatus: 201,
      expectedKey: "announcementId",
      expectedValue: "announcement-1",
    },
    {
      name: "registers student check-ins",
      handler: attendanceCheckInRoute.POST,
      request: jsonRequest("https://example.com/api/attendance/check-in", {
        studentProfileId: "student-1",
      }),
      expectedStatus: 201,
      expectedKey: "attendanceId",
      expectedValue: "attendance-1",
    },
    {
      name: "registers student check-outs",
      handler: attendanceCheckOutRoute.POST,
      request: jsonRequest("https://example.com/api/attendance/check-out", {
        attendanceId: "attendance-1",
      }),
      expectedStatus: 200,
      expectedKey: "attendanceId",
      expectedValue: "attendance-1",
    },
    {
      name: "creates class schedules",
      handler: classSchedulesRoute.POST,
      request: jsonRequest("https://example.com/api/class-schedules", {
        modalityId: "modality-1",
      }),
      expectedStatus: 201,
      expectedKey: "classScheduleId",
      expectedValue: "schedule-1",
    },
    {
      name: "creates modalities",
      handler: modalitiesRoute.POST,
      request: jsonRequest("https://example.com/api/modalities", {
        name: "Jiu-Jitsu",
      }),
      expectedStatus: 201,
      expectedKey: "modalityId",
      expectedValue: "modality-1",
    },
    {
      name: "creates students",
      handler: studentsRoute.POST,
      request: jsonRequest("https://example.com/api/students", {
        email: "aluno@example.com",
      }),
      expectedStatus: 201,
      expectedKey: "studentId",
      expectedValue: "student-1",
    },
    {
      name: "creates teachers",
      handler: teachersRoute.POST,
      request: jsonRequest("https://example.com/api/teachers", {
        email: "prof@example.com",
      }),
      expectedStatus: 201,
      expectedKey: "teacherId",
      expectedValue: "teacher-1",
    },
    {
      name: "creates training assignments",
      handler: trainingAssignmentsRoute.POST,
      request: jsonRequest("https://example.com/api/training-assignments", {
        trainingTemplateId: "template-1",
      }),
      expectedStatus: 201,
      expectedKey: "assignmentIds",
      expectedValue: ["assignment-1", "assignment-2"],
    },
    {
      name: "creates training templates",
      handler: trainingTemplatesRoute.POST,
      request: jsonRequest("https://example.com/api/training-templates", {
        name: "Treino A",
      }),
      expectedStatus: 201,
      expectedKey: "templateId",
      expectedValue: "template-1",
    },
  ] as const;

  for (const testCase of createCases) {
    it(testCase.name, async () => {
      const response = await testCase.handler(testCase.request);
      const body = await readJson<Record<string, unknown>>(response);

      expect(response.status).toBe(testCase.expectedStatus);
      expectRateLimitHeaders(response);
      expect(body.ok).toBe(true);
      expect(body[testCase.expectedKey]).toEqual(testCase.expectedValue);
    });
  }

  const updateCases = [
    {
      name: "updates announcements",
      handler: announcementsIdRoute.PATCH,
      request: jsonRequest("https://example.com/api/announcements/announcement-1", {
        title: "Aviso atualizado",
      }),
      expectedKey: "announcementId",
      expectedValue: "announcement-1",
    },
    {
      name: "updates class schedules",
      handler: classSchedulesIdRoute.PATCH,
      request: jsonRequest("https://example.com/api/class-schedules/schedule-1", {
        startsAt: "2026-04-16T18:00:00.000Z",
      }),
      expectedKey: "classScheduleId",
      expectedValue: "schedule-1",
    },
    {
      name: "updates modalities",
      handler: modalitiesIdRoute.PATCH,
      request: jsonRequest("https://example.com/api/modalities/modality-1", {
        name: "Jiu-Jitsu Advanced",
      }),
      expectedKey: "modalityId",
      expectedValue: "modality-1",
    },
    {
      name: "updates students",
      handler: studentsIdRoute.PATCH,
      request: jsonRequest("https://example.com/api/students/student-1", {
        email: "aluno+novo@example.com",
      }),
      expectedKey: "studentId",
      expectedValue: "student-1",
    },
    {
      name: "updates teachers",
      handler: teachersIdRoute.PATCH,
      request: jsonRequest("https://example.com/api/teachers/teacher-1", {
        email: "prof+novo@example.com",
      }),
      expectedKey: "teacherId",
      expectedValue: "teacher-1",
    },
    {
      name: "updates training assignments",
      handler: trainingAssignmentsIdRoute.PATCH,
      request: jsonRequest(
        "https://example.com/api/training-assignments/assignment-1",
        {
          notes: "Ajuste de carga",
        },
      ),
      expectedKey: "assignmentId",
      expectedValue: "assignment-1",
    },
    {
      name: "updates training templates",
      handler: trainingTemplatesIdRoute.PATCH,
      request: jsonRequest("https://example.com/api/training-templates/template-1", {
        name: "Treino A atualizado",
      }),
      expectedKey: "templateId",
      expectedValue: "template-1",
    },
  ] as const;

  for (const testCase of updateCases) {
    it(testCase.name, async () => {
      const response = await testCase.handler(
        testCase.request,
        paramsContext({ id: "resource-1" }),
      );
      const body = await readJson<Record<string, unknown>>(response);

      expect(response.status).toBe(200);
      expectRateLimitHeaders(response);
      expect(body.ok).toBe(true);
      expect(body[testCase.expectedKey]).toEqual(testCase.expectedValue);
    });
  }

  const deleteCases = [
    {
      name: "unpublishes announcements",
      handler: announcementsIdRoute.DELETE,
    },
    {
      name: "archives class schedules",
      handler: classSchedulesIdRoute.DELETE,
    },
    {
      name: "archives modalities",
      handler: modalitiesIdRoute.DELETE,
    },
    {
      name: "deactivates students",
      handler: studentsIdRoute.DELETE,
    },
    {
      name: "deactivates teachers",
      handler: teachersIdRoute.DELETE,
    },
    {
      name: "archives training templates",
      handler: trainingTemplatesIdRoute.DELETE,
    },
  ] as const;

  for (const testCase of deleteCases) {
    it(testCase.name, async () => {
      const response = await testCase.handler(
        new Request("https://example.com/api/resource/resource-1", {
          method: "DELETE",
        }),
        paramsContext({ id: "resource-1" }),
      );
      const body = await readJson<{ ok: boolean; message: string }>(response);

      expect(response.status).toBe(200);
      expectRateLimitHeaders(response);
      expect(body.ok).toBe(true);
      expect(body.message.length).toBeGreaterThan(0);
    });
  }

  it("duplicates training templates", async () => {
    const response = await trainingTemplatesDuplicateRoute.POST(
      new Request("https://example.com/api/training-templates/template-1/duplicate", {
        method: "POST",
      }),
      paramsContext({ id: "template-1" }),
    );
    const body = await readJson<{ ok: boolean; templateId: string }>(response);

    expect(response.status).toBe(201);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.templateId).toBe("template-2");
  });

  it("exports reports as CSV", async () => {
    const response = await reportsExportRoute.GET(
      new Request("https://example.com/api/reports/export?kind=students"),
    );

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(await response.text()).toContain("name,email");
  });
});
