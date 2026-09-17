import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>User Login</CardTitle>
            <Badge variant="secondary">Phase 1</Badge>
          </div>
          <CardDescription>
            Candidate authentication with email/password and Google OAuth will be implemented in Phase 1.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
