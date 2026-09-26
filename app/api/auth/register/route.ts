import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { successResponse, errorResponse } from "@/lib/api-response";

const RegisterSchema = z.object({
  email: z.string().email("Please provide a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters long."),
  domain: z.string().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const t0 = performance.now();
  try {
    const body = await req.json();
    const validation = RegisterSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.errors[0]?.message || "Invalid input data.";
      return errorResponse(firstError, 400);
    }

    const { email, password, domain } = validation.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if account already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return errorResponse("An account with this email already exists.", 409);
    }

    // Hash password with bcrypt
    const passwordHash = await hashPassword(password);

    // Create candidate user
    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        domain: domain || null,
        role: "USER",
        twoFactorEnabled: false,
      },
      select: {
        id: true,
        email: true,
        role: true,
        domain: true,
        createdAt: true,
      },
    });

    // Record registration audit log (STRICT RULE: NO IP ADDRESS LOGGING)
    await prisma.loginLog.create({
      data: {
        userId: newUser.id,
        method: "REGISTRATION",
        success: true,
      },
    });

    console.log(`[API Timing: Register] User registered in ${(performance.now() - t0).toFixed(1)}ms`);
    return successResponse(newUser, "Account created successfully. Please sign in.", 201);
  } catch (err) {
    console.error(`[API Timing: Register] Error after ${(performance.now() - t0).toFixed(1)}ms:`, err);
    return errorResponse("An error occurred during registration. Please try again.", 500, err);
  }
}
