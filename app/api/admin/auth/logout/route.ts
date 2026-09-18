import { ADMIN_COOKIE_NAME } from "@/lib/auth/admin-session";
import { successResponse } from "@/lib/api-response";

export async function POST() {
  const response = successResponse(null, "Admin logged out successfully.");
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
