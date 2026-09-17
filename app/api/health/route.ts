import { successResponse } from "@/lib/api-response";

export async function GET() {
  return successResponse(
    {
      status: "healthy",
      phase: "Phase 0: Foundation",
      timestamp: new Date().toISOString(),
    },
    "Service is operational"
  );
}
