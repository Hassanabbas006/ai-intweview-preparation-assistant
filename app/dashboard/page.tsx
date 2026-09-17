import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function UserDashboardPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Candidate Dashboard</CardTitle>
            <Badge variant="primary">Phase 1/2</Badge>
          </div>
          <CardDescription>
            Candidate dashboard with interview history and ATS reports.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
