"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Shield, KeyRound, Lock, ArrowLeft } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Submit Credentials
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.message || "Invalid administrative credentials.");
        setLoading(false);
        return;
      }

      setChallengeToken(data.data.challengeToken);
      setStep("totp");
      setLoading(false);
    } catch {
      setError("A network error occurred while reaching the admin authentication service.");
      setLoading(false);
    }
  };

  // Step 2: Submit 2FA TOTP Code
  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeToken,
          totpCode,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.message || "Invalid 2FA authentication code.");
        setLoading(false);
        return;
      }

      // Successful verification -> redirect to privileged admin dashboard
      router.push("/admin/dashboard");
      router.refresh();
    } catch {
      setError("A network error occurred during TOTP verification.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background transition-colors">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-input bg-primary/10 text-primary mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="font-heading font-bold text-2xl text-text-primary tracking-tight">
            Administrative Portal
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Privileged system console & security administration
          </p>
        </div>

        <Card className="border-primary/20 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                {step === "credentials" ? "Admin Authentication" : "2FA Security Challenge"}
              </CardTitle>
              <Badge variant="primary">Restricted</Badge>
            </div>
            <CardDescription>
              {step === "credentials"
                ? "Step 1 of 2: Enter your administrative email and password."
                : "Step 2 of 2: Enter your 6-digit TOTP code to establish an isolated admin session."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-input bg-error/15 border border-error/30 text-error text-sm">
                {error}
              </div>
            )}

            {step === "credentials" ? (
              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Admin Email</label>
                  <Input
                    type="email"
                    placeholder="admin@interviewprep.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="username"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Password</label>
                  <PasswordInput
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Verifying credentials..." : "Continue to 2FA Verification"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleTotpSubmit} className="space-y-4">
                <div className="p-3 rounded-card bg-primary/10 border border-primary/20 space-y-1">
                  <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-primary" /> Step 2: Time-based OTP Check
                  </p>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    Admin access strictly mandates two-factor verification. Enter the rotating 6-digit code from Google Authenticator.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">6-Digit Security Code</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="123456"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    className="text-center tracking-widest text-xl font-mono"
                    required
                    autoFocus
                    disabled={loading}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setStep("credentials");
                      setTotpCode("");
                      setChallengeToken(null);
                    }}
                    disabled={loading}
                    className="w-1/3"
                  >
                    Back
                  </Button>
                  <Button type="submit" className="w-2/3" disabled={loading}>
                    {loading ? "Authorizing..." : "Authorize Session"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>

          <CardFooter className="pt-3 border-t border-border flex justify-center text-xs text-text-secondary">
            <span className="flex items-center gap-1 text-[11px]">
              <Lock className="w-3 h-3 text-warning" /> 8-Hour Scoped Session &bull; Zero IP Logging
            </span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
