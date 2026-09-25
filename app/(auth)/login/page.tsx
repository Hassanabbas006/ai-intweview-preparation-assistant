"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const resetSuccess = searchParams.get("reset") === "success";
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [requires2FA, setRequires2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Pre-flight check: verify credentials & check if 2FA code is needed
      const checkRes = await fetch("/api/auth/2fa/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          twoFactorCode: requires2FA ? twoFactorCode : undefined,
        }),
      });

      const checkData = await checkRes.json();

      if (!checkRes.ok || checkData.error) {
        setError(checkData.message || "Invalid credentials.");
        setLoading(false);
        return;
      }

      // If user has 2FA enabled and code is not yet provided:
      if (checkData.data?.requires2FA) {
        setRequires2FA(true);
        setError(null);
        setLoading(false);
        return;
      }

      // Pre-flight passed! Establish NextAuth candidate session
      const result = await signIn("credentials", {
        email,
        password,
        twoFactorCode: requires2FA ? twoFactorCode : undefined,
        redirect: false,
        callbackUrl,
      });

      if (!result || result.error) {
        setError("Authentication session creation failed. Please try again.");
        setLoading(false);
        return;
      }

      // Successful sign in
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Network or authentication error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-6">
        <h1 className="font-heading font-bold text-2xl text-text-primary tracking-tight">
          AI Interview Prep
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Sign in to your candidate account
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{requires2FA ? "Two-Factor Verification" : "Candidate Login"}</CardTitle>
          <CardDescription>
            {requires2FA
              ? "Enter the 6-digit code from your authenticator app to complete sign-in."
              : "Access your mock interview sessions and ATS resume reports."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {registered && !requires2FA && (
            <div className="mb-4 p-3 rounded-input bg-success/15 border border-success/30 text-success text-sm">
              Account created successfully! Please sign in with your credentials.
            </div>
          )}

          {resetSuccess && !requires2FA && (
            <div className="mb-4 p-3 rounded-input bg-success/15 border border-success/30 text-success text-sm">
              Password updated successfully! Please sign in with your new password.
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-input bg-error/15 border border-error/30 text-error text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!requires2FA ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Email Address</label>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-text-secondary">Password</label>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <PasswordInput
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">6-Digit Authenticator Code</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  className="text-center tracking-widest text-lg font-mono"
                  required
                  autoFocus
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => {
                    setRequires2FA(false);
                    setTwoFactorCode("");
                    setError(null);
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  ← Back to login
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Signing in..."
                : requires2FA
                ? "Verify Code & Sign In"
                : "Sign In"}
            </Button>
          </form>

          {!requires2FA && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-surface px-2 text-text-secondary">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                onClick={() => signIn("google", { callbackUrl })}
                disabled={loading}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Google
              </Button>
            </>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-xs text-text-secondary text-center">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline font-medium">
              Sign Up
            </Link>
          </p>
          <div className="pt-2 border-t border-border/50 w-full text-center">
            <Link href="/admin/login" className="text-xs text-text-secondary hover:text-primary transition-colors">
              Admin Portal Access →
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-14 sm:pt-4 bg-background transition-colors">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Suspense fallback={<div className="text-sm text-text-secondary">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
