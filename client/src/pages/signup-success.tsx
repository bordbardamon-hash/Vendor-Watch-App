import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { APP_NAME } from "@/lib/labels";
import { Link } from "wouter";

export default function SignupSuccess() {
  useEffect(() => {
    const confetti = () => {
      const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];
      for (let i = 0; i < 50; i++) {
        const confettiPiece = document.createElement('div');
        confettiPiece.style.cssText = `
          position: fixed;
          width: 10px;
          height: 10px;
          background: ${colors[Math.floor(Math.random() * colors.length)]};
          left: ${Math.random() * 100}vw;
          top: -10px;
          opacity: 0.8;
          pointer-events: none;
          z-index: 1000;
          animation: fall ${2 + Math.random() * 2}s linear forwards;
        `;
        document.body.appendChild(confettiPiece);
        setTimeout(() => confettiPiece.remove(), 4000);
      }
    };

    const style = document.createElement('style');
    style.textContent = `
      @keyframes fall {
        to {
          transform: translateY(100vh) rotate(720deg);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    confetti();

    return () => style.remove();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-sidebar flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-sidebar-border text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Welcome to {APP_NAME}!</CardTitle>
          <CardDescription className="text-base">
            Your account has been created and your 14-day free trial has started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-sidebar/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium">What's next?</p>
            <ul className="text-muted-foreground text-left space-y-1">
              <li>1. Sign in with your Replit account</li>
              <li>2. Explore the monitoring dashboard</li>
              <li>3. Configure your vendor alerts</li>
            </ul>
          </div>

          <Link href="/">
            <Button className="w-full" size="lg" data-testid="button-go-to-dashboard">
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>

          <p className="text-xs text-muted-foreground">
            Your trial lasts 14 days. You won't be charged until the trial ends.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
