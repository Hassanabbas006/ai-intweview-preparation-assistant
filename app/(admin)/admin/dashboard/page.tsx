import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboardPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Admin Analytics Dashboard</CardTitle>
            <Badge variant="primary">Phase 8</Badge>
          </div>
          <CardDescription>
            Admin management and analytics at /admin/dashboard will be implemented in Phase 8.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
