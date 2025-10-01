import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

const benefits = [
  "99.9% uptime guarantee",
  "Export audit reports in under 5 seconds",
  "RBAC with encrypted data at rest and in transit",
  "Responsive web and mobile access"
];

const CTA = () => {
  return (
    <section className="py-24 bg-gradient-to-br from-primary to-primary-light text-primary-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl lg:text-5xl font-bold">
            Ready to Prove Compliance with Confidence?
          </h2>
          
          <p className="text-xl opacity-90 max-w-2xl mx-auto">
            Join public safety and healthcare organizations using PowerPolicy as their single source of truth 
            for policy management and compliance.
          </p>
          
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left my-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 flex-shrink-0 mt-0.5" />
                <span className="text-lg">{benefit}</span>
              </div>
            ))}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link to="/auth">
              <Button 
                size="lg" 
                variant="secondary" 
                className="text-lg group bg-white text-primary hover:bg-white/90"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg border-2 border-white text-white hover:bg-white/10"
              >
                Sign In
              </Button>
            </Link>
          </div>
          
          <p className="text-sm opacity-75">
            No credit card required • Set up in minutes • Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTA;
