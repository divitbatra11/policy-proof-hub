import { Card, CardContent } from "@/components/ui/card";
import Navigation from "@/components/Navigation";

const teamMembers = [
  {
    name: "PPDU Manager",
    role: "Policy Leadership",
    bio: "Leads policy development initiatives and ensures alignment with Community Corrections Branch priorities.",
    initials: "PM"
  },
  {
    name: "Senior Policy Analyst",
    role: "Research & Analysis",
    bio: "Coordinates research, stakeholder engagement, and comprehensive policy draft reviews.",
    initials: "PA"
  },
  {
    name: "Documentation Specialist",
    role: "Process Coordination",
    bio: "Maintains templates, version control, publication workflows, and compliance documentation.",
    initials: "DS"
  },
  {
    name: "Implementation Coordinator",
    role: "Operational Rollout",
    bio: "Manages policy rollout, team training, and operational adoption across all Community Corrections regions.",
    initials: "IC"
  },
];

const MeetTheTeam = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <section className="py-24 bg-gradient-to-b from-background to-secondary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 space-y-4">
            <h1 className="text-5xl font-bold text-foreground">
              Meet the PPDU Team
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The dedicated team at the Policy and Programs Development Unit supporting 
              policy excellence and program development for the Community Corrections Branch.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {teamMembers.map((member, index) => (
              <Card key={index} className="border-2 hover:shadow-xl transition-all">
                <CardContent className="p-8 space-y-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto">
                    <span className="text-2xl font-bold text-primary-foreground">
                      {member.initials}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-foreground">
                      {member.name}
                    </h3>
                    <p className="text-sm text-primary font-semibold mt-1">
                      {member.role}
                    </p>
                  </div>

                  <p className="text-muted-foreground leading-relaxed text-sm">
                    {member.bio}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-16 p-8 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/20 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-foreground text-center mb-4">
              Our Mission
            </h2>
            <p className="text-muted-foreground text-center leading-relaxed">
              The PPDU is committed to developing, implementing, and maintaining clear, 
              consistent policies and programs that support operational excellence across 
              the Community Corrections Branch. We work collaboratively with all regions 
              and operational areas to ensure policies are effective, accessible, and 
              aligned with the branch's strategic goals.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MeetTheTeam;
