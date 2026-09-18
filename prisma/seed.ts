import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;

  // STRICT REQUIREMENT: No hardcoded fallback password in code
  if (!adminPassword || adminPassword.trim() === "") {
    console.error("=================================================================");
    console.error("FATAL ERROR: ADMIN_SEED_PASSWORD environment variable is not set!");
    console.error("Per security rules, no hardcoded password fallback is permitted.");
    console.error("Please add ADMIN_SEED_PASSWORD=<your_secure_password> to your .env file.");
    console.error("=================================================================");
    process.exit(1);
  }

  const adminEmail = "admin@interviewprep.ai";

  console.log(`\n🌱 Starting seed for Admin account: ${adminEmail}...`);

  // Hash the admin password with bcrypt
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Generate a dedicated base32 TOTP secret for mandatory 2FA
  const totpSecret = speakeasy.generateSecret({
    length: 20,
    name: `AI Interview Prep Admin (${adminEmail})`,
    issuer: "AI Interview Prep Admin",
  });

  if (!totpSecret.base32) {
    throw new Error("Failed to generate TOTP secret for admin.");
  }

  // Upsert the superadmin record
  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      twoFactorEnabled: true, // Mandatory 2FA per architecture
      twoFactorSecret: totpSecret.base32,
      role: "SUPERADMIN",
    },
    create: {
      email: adminEmail,
      passwordHash,
      twoFactorEnabled: true,
      twoFactorSecret: totpSecret.base32,
      role: "SUPERADMIN",
    },
  });

  console.log(`✅ Admin account seeded successfully with ID: ${admin.id}`);
  console.log("\n=================================================================");
  console.log("🔐 ADMIN 2FA GOOGLE AUTHENTICATOR SETUP");
  console.log("=================================================================");
  console.log(`Admin Email:        ${adminEmail}`);
  console.log(`TOTP Base32 Secret: ${totpSecret.base32}`);
  console.log(`OTPAuth URL:        ${totpSecret.otpauth_url}`);
  console.log("-----------------------------------------------------------------");
  console.log("👉 To configure Google Authenticator / 1Password:");
  console.log(`   1. Open your authenticator app`);
  console.log(`   2. Select 'Enter a setup key' or 'Manual entry'`);
  console.log(`   3. Account name: Admin (${adminEmail})`);
  console.log(`   4. Key:          ${totpSecret.base32}`);
  console.log(`   5. Type of key:  Time based`);
  console.log("=================================================================\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
