import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function InterviewSessionPage({
  params,
}: {
  params: { sessionId: string };
}) {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active Interview Session: {params.sessionId}</CardTitle>
            <Badge variant="primary">Phase 2</Badge>
          </div>
          <CardDescription>
            Live streaming chat interview engine will be implemented in Phase 2.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
