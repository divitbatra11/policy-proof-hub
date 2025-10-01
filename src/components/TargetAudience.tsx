import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const audiences = [
  {
    title: "Law Enforcement",
    roles: ["Police Departments", "Sheriff's Offices", "State Patrol"],
    useCase: "Maintain defensible use-of-force and pursuit policies with complete audit trails."
  },
  {
    title: "Fire & EMS",
    roles: ["Fire Departments", "EMS Services", "Emergency Management"],
    useCase: "Ensure all personnel acknowledge updated safety protocols and training requirements."
  },
  {
    title: "911 Communications",
    roles: ["Dispatch Centers", "PSAP Operations", "Call Centers"],
    useCase: "Track protocol updates and verify comprehension across all shift rotations."
  },
  {
    title: "Healthcare Teams",
    roles: ["Hospitals", "Clinics", "Care Facilities"],
    useCase: "Prove HIPAA and clinical policy compliance during audits and investigations."
  }
];

const TargetAudience = () => {
  return (
    <section className="py-24 bg-card" id="who-we-serve">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl font-bold text-foreground">
            Built for Mission-Critical Organizations
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            PowerPolicy serves public safety and healthcare teams who need defensible proof of policy compliance.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {audiences.map((audience, index) => (
            <Card key={index} className="border-2 hover:shadow-xl transition-all">
              <CardContent className="p-8 space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-4">
                    {audience.title}
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {audience.roles.map((role, roleIndex) => (
                      <Badge key={roleIndex} variant="secondary" className="text-sm">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="border-l-4 border-primary pl-4">
                  <p className="text-muted-foreground italic">
                    "{audience.useCase}"
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TargetAudience;
