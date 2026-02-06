import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const audiences = [
  {
    title: "Community Corrections Leadership",
    roles: ["Provincial Office", "Regional Offices", "Management Team"],
    useCase: "Develop and distribute policies to all Community Corrections teams with full documentation and tracking."
  },
  {
    title: "Community Corrections Officers",
    roles: ["Officers", "Supervisors", "Field Staff"],
    useCase: "Access current policies, acknowledge receipt, and stay informed of all policy updates and changes."
  },
  {
    title: "Program Managers",
    roles: ["Program Development", "Operations", "Quality Assurance"],
    useCase: "Track policy effectiveness, manage program updates, and ensure consistent implementation across regions."
  },
  {
    title: "Administrative Support",
    roles: ["HR", "Compliance", "Records Management"],
    useCase: "Maintain complete records of all policy distributions and acknowledgments for compliance and audits."
  }
];

const TargetAudience = () => {
  return (
    <section className="py-24 bg-card" id="who-we-serve">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl font-bold text-foreground">
            Designed for Community Corrections Branch
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            PPDU is built for all teams in the Community Corrections Branch to collaborate on policy development and implementation.
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
