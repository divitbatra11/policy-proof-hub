import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { Link } from "react-router-dom";

const Navigation = () => {
  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">PowerPolicy</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-foreground hover:text-primary transition-colors font-medium">
              Features
            </a>
            <a href="#who-we-serve" className="text-foreground hover:text-primary transition-colors font-medium">
              Who We Serve
            </a>
            <a href="#pricing" className="text-foreground hover:text-primary transition-colors font-medium">
              Pricing
            </a>
            <a href="#resources" className="text-foreground hover:text-primary transition-colors font-medium">
              Resources
            </a>
          </div>
          
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" className="font-medium">
                Sign In
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="font-medium">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
