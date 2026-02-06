import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const team = [
  { name: "Alex Morgan", role: "Director, PPDU", bio: "Leads policy strategy and governance." },
  { name: "Jordan Smith", role: "Policy Lead", bio: "Authors and maintains operational policies." },
  { name: "Taylor Green", role: "Program Manager", bio: "Coordinates program updates and rollouts." },
  { name: "Riley Chen", role: "Compliance Analyst", bio: "Manages audits and records." },
];

const MeetTheTeam = () => {
  return (
    <section className="py-24 bg-background" id="team">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold">Meet the PPDU Team</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            The Policy and Programs Development Unit supports the Community Corrections Branch.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {team.map((member) => (
            <Card key={member.name} className="p-6 text-center">
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center">
                  <Avatar>
                    <AvatarImage src="/src/assets/Picture1.png" alt={member.name} />
                    <AvatarFallback>{member.name.split(" ")[0].charAt(0)}</AvatarFallback>
                  </Avatar>
                </div>
                <div>
                  <div className="text-lg font-semibold">{member.name}</div>
                  <div className="text-sm text-muted-foreground">{member.role}</div>
                </div>
                <p className="text-sm text-muted-foreground">{member.bio}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MeetTheTeam;
