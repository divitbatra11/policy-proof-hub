import { Shield, Users, FileCheck, ClipboardCheck, Clock, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: FileCheck,
    title: "Central Policy Library",
    description: "Single source for all policies with automatic versioning and archiving. Easy access across all teams."
  },
  {
    icon: Users,
    title: "Team Distribution",
    description: "Assign policies to Community Corrections teams and regions. Track who has received and acknowledged each policy."
  },
  {
    icon: Shield,
    title: "Complete Documentation",
    description: "Full audit trail of all policy changes, distributions, and acknowledgments. Maintain compliance records."
  },
  {
    icon: ClipboardCheck,
    title: "Policy Approval Workflow",
    description: "Streamlined draft, review, and approval process. Track policy through development lifecycle."
  },
  {
    icon: Clock,
    title: "Version Control",
    description: "Track all policy iterations with change histories. Understand what changed and when."
  },
  {
    icon: Lock,
    title: "Secure & Organized",
    description: "Controlled access by role. Categorize policies for easy navigation and management."
  }
];

const Features = () => {
  return (
    <section className="py-24 bg-gradient-to-b from-background to-secondary/20" id="features">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl font-bold text-foreground">
            Tools for Effective Policy Management
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Built for the Community Corrections Branch to streamline policy development, distribution, and tracking across all teams.
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
