"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { DOMAIN_OPTIONS } from "@/lib/constants/domains";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [domain, setDomain] = useState("Software_Engineering");
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    const t0 = performance.now();
    console.log("[Client Timing: Signup] Submitting registration form...");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, domain }),
      });

      const data = await res.json();
      const elapsed = Math.round(performance.now() - t0);

      if (!res.ok || data.error) {
        console.warn(`[Client Timing: Signup] Registration failed in ${elapsed}ms:`, data?.message);
        setError(data.message || "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      console.log(`[Client Timing: Signup] Registration successful in ${elapsed}ms. Redirecting to login.`);
      // Registration successful -> redirect to login with registered flag
      router.push("/login?registered=true");
    } catch (err) {
      const elapsed = Math.round(performance.now() - t0);
      console.error(`[Client Timing: Signup] Network error in ${elapsed}ms:`, err);
      setError("Network or server error. Please try again.");
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    const t0 = performance.now();
    console.log("[Client Timing: Google Signup] Initiating Google registration redirect...");
    setIsGoogleLoading(true);
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-14 sm:pt-4 bg-background transition-colors">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="font-heading font-bold text-2xl text-text-primary tracking-tight">
            AI Interview Prep
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Create your candidate account to start practicing
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Candidate Registration</CardTitle>
            <CardDescription>
              Prepare for your next technical interview with AI-powered mock rounds
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-input bg-error/15 border border-error/30 text-error text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-secondary">Email Address</label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-secondary">Target Domain / Track</label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="flex h-10 w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-soft"
                  disabled={loading}
                >
                  {DOMAIN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-secondary">Password (min 8 chars)</label>
                <PasswordInput
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-secondary">Confirm Password</label>
                <PasswordInput
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                isLoading={loading}
                loadingText="Creating Account..."
              >
                Sign Up
              </Button>
            </form>

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
              onClick={handleGoogleSignup}
              isLoading={isGoogleLoading}
              loadingText="Connecting to Google..."
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
          </CardContent>

          <CardFooter className="flex justify-center border-t border-border pt-4">
            <p className="text-xs text-text-secondary">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Log In
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
