"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShieldAlert, LogOut, Users, Activity, BarChart3, Clock, CheckCircle2 } from "lucide-react";

interface AdminData {
  adminId: string;
  email: string;
  role: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAdmin() {
      try {
        const res = await fetch("/api/admin/auth/me");
        const data = await res.json();
        if (res.ok && !data.error) {
          setAdmin(data.data);
        } else {
          router.push("/admin/login");
        }
      } catch {
        router.push("/admin/login");
      } finally {
        setLoading(false);
      }
    }
    fetchAdmin();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <p className="text-sm text-text-secondary animate-pulse">Verifying isolated admin session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 transition-colors">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top bar */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-border gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-card bg-primary/10 border border-primary/20 text-primary">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-heading text-text-primary">Admin Control Center</h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Authenticated as <span className="font-mono font-medium text-text-primary">{admin?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2 border-error/30 text-error hover:bg-error/10"
            >
              <LogOut className="w-4 h-4" />
              Admin Sign Out
            </Button>
          </div>
        </header>

        {/* Security & Scope confirmation card */}
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Privileged Session Scope</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="warning">{admin?.role || "SUPERADMIN"}</Badge>
                <Badge variant="success">TOTP 2FA Verified</Badge>
              </div>
            </div>
            <CardDescription>
              Session isolated strictly from candidate auth scope. Expiring in 8 hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-surface border border-border rounded-input flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <div>
                  <p className="font-medium text-text-primary">Zero IP Logging</p>
                  <p className="text-text-secondary">All logins audited without IP addresses.</p>
                </div>
              </div>
              <div className="p-3 bg-surface border border-border rounded-input flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-text-primary">8-Hour Lifetime</p>
                  <p className="text-text-secondary">Tight cookie expiration for security.</p>
                </div>
              </div>
              <div className="p-3 bg-surface border border-border rounded-input flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-warning" />
                <div>
                  <p className="font-medium text-text-primary">Mandatory 2FA</p>
                  <p className="text-text-secondary">Enforced on all administrator logins.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analytics preview cards (Phase 8 placeholder) */}
        <div>
          <h2 className="text-lg font-bold font-heading text-text-primary mb-4">Management Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> User Directory
                  </CardTitle>
                  <Badge variant="secondary">Phase 8</Badge>
                </div>
                <CardDescription>
                  View registered candidates, domains, 2FA status, and account actions.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" /> Interview Analytics
                  </CardTitle>
                  <Badge variant="secondary">Phase 8</Badge>
                </div>
                <CardDescription>
                  Track mock interview sessions across HR, Aptitude, Managerial, and Domain.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" /> ATS Scan Metrics
                  </CardTitle>
                  <Badge variant="secondary">Phase 8</Badge>
                </div>
                <CardDescription>
                  Monitor resume score distribution and job-targeted vs general scans.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
