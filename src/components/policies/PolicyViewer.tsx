import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PolicyViewerProps {
  policy: any;
}

const PolicyViewer = ({ policy }: PolicyViewerProps) => {
  const currentVersion = policy.policy_versions?.find(
    (v: any) => v.id === policy.current_version_id
  );

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName;
      link.click();
      toast.success("Download started");
    } catch (error) {
      toast.error("Failed to download file");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "default";
      case "draft": return "secondary";
      case "review": return "outline";
      case "archived": return "destructive";
      default: return "default";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-3xl">{policy.title}</CardTitle>
              <CardDescription className="text-base">
                {policy.description}
              </CardDescription>
            </div>
            <Badge variant={getStatusColor(policy.status)} className="text-sm">
              {policy.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Created by:</span>
              <span className="font-medium">{policy.created_by_profile?.full_name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Created:</span>
              <span className="font-medium">{format(new Date(policy.created_at), "PPP")}</span>
            </div>
            {policy.category && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Category:</span>
                <span className="font-medium">{policy.category}</span>
              </div>
            )}
            {currentVersion && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Version:</span>
                <span className="font-medium">{currentVersion.version_number}</span>
              </div>
            )}
          </div>

          {currentVersion && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Version Document</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{currentVersion.file_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(currentVersion.file_size / 1024).toFixed(2)} KB
                      </p>
                      {currentVersion.published_at && (
                        <p className="text-xs text-muted-foreground">
                          Published: {format(new Date(currentVersion.published_at), "PPP")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleDownload(currentVersion.file_url, currentVersion.file_name)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
                {currentVersion.change_summary && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-1">Change Summary:</p>
                    <p className="text-sm text-muted-foreground">{currentVersion.change_summary}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PolicyViewer;
