import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Calendar, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface PolicyVersionComparisonProps {
  policyId: string;
  versions: any[];
}

const PolicyVersionComparison = ({ policyId, versions }: PolicyVersionComparisonProps) => {
  const [leftVersion, setLeftVersion] = useState<string>(
    versions[versions.length - 2]?.id || ""
  );
  const [rightVersion, setRightVersion] = useState<string>(
    versions[versions.length - 1]?.id || ""
  );

  const sortedVersions = [...versions].sort((a, b) => b.version_number - a.version_number);
  const leftVersionData = versions.find(v => v.id === leftVersion);
  const rightVersionData = versions.find(v => v.id === rightVersion);

  const handleDownload = (fileUrl: string, fileName: string) => {
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

  if (versions.length < 2) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Not enough versions to compare. Create at least 2 versions to use this feature.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Version Comparison</CardTitle>
          <CardDescription>
            Compare two versions side by side to see what changed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Earlier Version</label>
              <Select value={leftVersion} onValueChange={setLeftVersion}>
                <SelectTrigger>
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {sortedVersions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      Version {version.version_number}
                      {version.published_at && 
                        ` - ${format(new Date(version.published_at), "PP")}`
                      }
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ArrowRight className="h-6 w-6 text-muted-foreground mt-6" />

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Later Version</label>
              <Select value={rightVersion} onValueChange={setRightVersion}>
                <SelectTrigger>
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {sortedVersions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      Version {version.version_number}
                      {version.published_at && 
                        ` - ${format(new Date(version.published_at), "PP")}`
                      }
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Left Version */}
        {leftVersionData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Version {leftVersionData.version_number}</CardTitle>
                <Badge variant="secondary">Earlier</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <FileText className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{leftVersionData.file_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(leftVersionData.file_size / 1024).toFixed(2)} KB
                  </p>
                  {leftVersionData.published_at && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(leftVersionData.published_at), "PPP")}
                    </div>
                  )}
                </div>
              </div>

              {leftVersionData.change_summary && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Changes:</p>
                  <p className="text-sm text-muted-foreground">
                    {leftVersionData.change_summary}
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleDownload(leftVersionData.file_url, leftVersionData.file_name)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Right Version */}
        {rightVersionData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Version {rightVersionData.version_number}</CardTitle>
                <Badge>Latest</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <FileText className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{rightVersionData.file_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(rightVersionData.file_size / 1024).toFixed(2)} KB
                  </p>
                  {rightVersionData.published_at && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(rightVersionData.published_at), "PPP")}
                    </div>
                  )}
                </div>
              </div>

              {rightVersionData.change_summary && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Changes:</p>
                  <p className="text-sm text-muted-foreground">
                    {rightVersionData.change_summary}
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleDownload(rightVersionData.file_url, rightVersionData.file_name)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparison Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <span className="text-sm font-medium">Version Number</span>
              <div className="flex gap-4">
                <span className="text-sm text-muted-foreground">
                  {leftVersionData?.version_number || "-"}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {rightVersionData?.version_number || "-"}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center p-3 border rounded-lg">
              <span className="text-sm font-medium">File Size</span>
              <div className="flex gap-4">
                <span className="text-sm text-muted-foreground">
                  {leftVersionData ? `${(leftVersionData.file_size / 1024).toFixed(2)} KB` : "-"}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {rightVersionData ? `${(rightVersionData.file_size / 1024).toFixed(2)} KB` : "-"}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center p-3 border rounded-lg">
              <span className="text-sm font-medium">Published Date</span>
              <div className="flex gap-4">
                <span className="text-sm text-muted-foreground">
                  {leftVersionData?.published_at 
                    ? format(new Date(leftVersionData.published_at), "PP")
                    : "-"}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {rightVersionData?.published_at 
                    ? format(new Date(rightVersionData.published_at), "PP")
                    : "-"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PolicyVersionComparison;
