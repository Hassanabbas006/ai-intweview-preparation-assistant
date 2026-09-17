import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-primary/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Admin Access</CardTitle>
            <Badge variant="warning">Isolated Auth Scope</Badge>
          </div>
          <CardDescription>
            Dedicated admin authentication at /admin/login with mandatory TOTP 2FA will be implemented in Phase 1.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
