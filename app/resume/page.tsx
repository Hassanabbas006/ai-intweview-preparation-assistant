import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ResumePage() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Resume ATS Scanner</CardTitle>
            <Badge variant="neutral">Coming Soon</Badge>
          </div>
          <CardDescription>
            Resume upload, ATS match scoring, keyword gap analysis, and JD alignment suggestions.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
