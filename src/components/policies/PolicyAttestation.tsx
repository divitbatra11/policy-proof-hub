import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, FileSignature } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PolicyAttestationProps {
  policy: any;
  userId: string;
  onAttestationComplete: () => void;
}

const PolicyAttestation = ({ policy, userId, onAttestationComplete }: PolicyAttestationProps) => {
  const [hasRead, setHasRead] = useState(false);
  const [understands, setUnderstands] = useState(false);
  const [complies, setComplies] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAttest = async () => {
    if (!hasRead || !understands || !complies) {
      toast.error("Please confirm all statements before signing");
      return;
    }

    setLoading(true);
    try {
      // Create attestation record
      const { error: attestationError } = await supabase
        .from("attestations")
        .insert({
          user_id: userId,
          policy_version_id: policy.current_version_id,
          ip_address: "0.0.0.0", // In production, get real IP
          user_agent: navigator.userAgent
        });

      if (attestationError) throw attestationError;

      toast.success("Policy signed successfully!");
      onAttestationComplete();
    } catch (error: any) {
      toast.error("Failed to sign policy");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileSignature className="h-6 w-6 text-primary" />
          <CardTitle>Sign Policy</CardTitle>
        </div>
        <CardDescription>
          Please review and acknowledge the policy by checking the boxes below
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-6 border-2 border-primary/20 rounded-lg bg-primary/5 space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="read"
              checked={hasRead}
              onCheckedChange={(checked) => setHasRead(checked as boolean)}
            />
            <label htmlFor="read" className="text-sm font-medium leading-relaxed cursor-pointer">
              I confirm that I have read and reviewed the entire policy document.
            </label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="understand"
              checked={understands}
              onCheckedChange={(checked) => setUnderstands(checked as boolean)}
            />
            <label htmlFor="understand" className="text-sm font-medium leading-relaxed cursor-pointer">
              I understand the contents of this policy and how it applies to my role.
            </label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="comply"
              checked={complies}
              onCheckedChange={(checked) => setComplies(checked as boolean)}
            />
            <label htmlFor="comply" className="text-sm font-medium leading-relaxed cursor-pointer">
              I agree to comply with all requirements outlined in this policy.
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground">
            Your signature will be recorded with timestamp and IP address for audit purposes.
          </div>
        </div>

        <Button
          onClick={handleAttest}
          disabled={loading || !hasRead || !understands || !complies}
          className="w-full"
          size="lg"
        >
          <CheckCircle2 className="h-5 w-5 mr-2" />
          {loading ? "Signing..." : "Sign Policy"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default PolicyAttestation;
