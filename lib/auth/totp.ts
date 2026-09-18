import speakeasy from "speakeasy";
import QRCode from "qrcode";

export interface TotpSecretResult {
  secret: string; // Base32 encoded secret
  otpauthUrl: string;
}

/**
 * Generates a base32 TOTP secret compatible with Google Authenticator.
 */
export function generateTotpSecret(email: string, issuer = "AI Interview Prep"): TotpSecretResult {
  const secretObj = speakeasy.generateSecret({
    length: 20,
    name: `${issuer} (${email})`,
    issuer,
  });

  if (!secretObj.base32 || !secretObj.otpauth_url) {
    throw new Error("Failed to generate TOTP secret");
  }

  return {
    secret: secretObj.base32,
    otpauthUrl: secretObj.otpauth_url,
  };
}

/**
 * Generates a Data URL for the QR code to be scanned by authenticator apps.
 */
export async function generateQrCode(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

/**
 * Verifies a 6-digit TOTP token against the base32 secret.
 * Uses a window of 1 (allows +/- 30 seconds clock drift).
 */
export function verifyTotp(secret: string, token: string): boolean {
  // Normalize token (remove spaces if user entered them)
  const cleanToken = token.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanToken)) {
    return false;
  }

  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: cleanToken,
    window: 1,
  });
}
