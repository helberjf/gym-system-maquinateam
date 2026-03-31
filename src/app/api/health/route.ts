import { successResponse } from "@/lib/errors";

export async function GET() {
  return successResponse({
    status: "ok",
    project: "Maquina Team Gym System",
    version: "0.1.0",
    phase: "Fase 4 - Base transversal de seguranca",
    timestamp: new Date().toISOString(),
  });
}
