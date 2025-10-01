import { Shield, Users, FileCheck, ClipboardCheck, Clock, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: FileCheck,
    title: "Central Policy Repository",
    description: "One live version, automatic archiving. Search and access policies instantly on any device."
  },
  {
    icon: Users,
    title: "Targeted Distribution",
    description: "Assign policies to specific groups and roles. Track real-time attestation status and completion."
  },
  {
    icon: Shield,
    title: "Immutable Audit Trail",
    description: "Complete logs of who received, opened, and signed. Timestamp and version tracking for defensible records."
  },
  {
    icon: ClipboardCheck,
    title: "Comprehension Testing",
    description: "Attach assessments to policies. Record pass/fail scores alongside signatures for compliance proof."
  },
  {
    icon: Clock,
    title: "Simple Workflow",
    description: "Streamlined Draft → Review → Publish process. Lightweight approval chain without complex routing."
  },
  {
    icon: Lock,
    title: "Compliance Ready",
    description: "Export audit reports in seconds. Show exactly who saw what, when, and their comprehension scores."
  }
];

const Features = () => {
  return (
    <section className="py-24 bg-gradient-to-b from-background to-secondary/20" id="features">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl font-bold text-foreground">
            Everything You Need for Policy Compliance
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Built specifically for public safety and healthcare teams who must prove policy compliance under audits and investigations.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl group"
            >
              <CardContent className="p-8 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center group-hover:scale-110 transition-transform">
                  <feature.icon className="h-7 w-7 text-primary-foreground" />
                </div>
                
                <h3 className="text-xl font-bold text-foreground">
                  {feature.title}
                </h3>
                
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
