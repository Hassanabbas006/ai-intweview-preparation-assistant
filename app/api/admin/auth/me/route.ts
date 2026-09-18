import { getAdminSession } from "@/lib/auth/admin-session";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return errorResponse("Unauthorized. Admin session required.", 401);
  }

  return successResponse(session, "Admin session verified.");
}
