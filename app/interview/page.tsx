import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function InterviewConfigPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Mock Interview Configuration</CardTitle>
            <Badge variant="primary">Phase 2</Badge>
          </div>
          <CardDescription>
            Interview setup (HR, Aptitude, Managerial, Domain) will be implemented in Phase 2.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
