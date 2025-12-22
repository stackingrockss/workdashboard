import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Headphones,
  Building2,
  FileText,
  Target,
  Users,
  Sparkles,
  ArrowRight,
  Briefcase,
} from "lucide-react";

const features = [
  {
    icon: Headphones,
    title: "Call Intelligence",
    description:
      "AI extracts key insights, objections, and next steps from every sales call via Gong and Granola.",
  },
  {
    icon: Building2,
    title: "Account Research",
    description:
      "Automatically gather SEC filings, earnings transcripts, news, and competitive intelligence.",
  },
  {
    icon: FileText,
    title: "Document Generation",
    description:
      "Generate proposals, business cases, and mutual action plans with AI in seconds.",
  },
  {
    icon: Target,
    title: "Pipeline Management",
    description:
      "Visual Kanban board with customizable stages, forecast tracking, and quarterly views.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Comments, mentions, shared views, and organizational charts for seamless teamwork.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Insights",
    description:
      "Gemini-powered intelligence that helps you prepare for every meeting and close deals faster.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-6xl">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-semibold text-xl">
            <Briefcase className="h-6 w-6" />
            <span>Briefcase</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
          </nav>

          {/* CTAs */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-6">
            AI-Powered Deal Intelligence
          </Badge>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Win More Enterprise Deals with{" "}
            <span className="text-primary">AI-Powered Intelligence</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Briefcase combines call insights, account research, and document generation to help
            enterprise sales teams close bigger deals faster.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/auth/login">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#features">See How It Works</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold tracking-tight mb-4">
              Everything you need to close enterprise deals
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From first call to signed contract, Briefcase keeps you prepared and informed.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="bg-background">
                  <CardHeader>
                    <div className="p-2 w-fit rounded-lg bg-primary/10 mb-3">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight mb-4">
            Ready to accelerate your enterprise sales?
          </h2>
          <p className="text-muted-foreground mb-8">
            Join sales teams who use Briefcase to close deals faster with AI-powered intelligence.
          </p>
          <Button size="lg" asChild>
            <Link href="/auth/login">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4 mt-auto">
        <div className="container mx-auto max-w-6xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 font-semibold">
            <Briefcase className="h-5 w-5" />
            <span>Briefcase</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {new Date().getFullYear()} Briefcase. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
