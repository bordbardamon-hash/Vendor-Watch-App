import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Key, AlertCircle } from "lucide-react";

export default function Verify2FA() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);

  const verifyMutation = useMutation({
    mutationFn: async ({ token, useRecovery }: { token: string; useRecovery: boolean }) => {
      const res = await fetch("/api/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, useRecovery }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Verification failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.remainingCodes !== undefined) {
        toast({
          title: "Verified with Recovery Code",
          description: `You have ${data.remainingCodes} recovery codes remaining.`,
          className: "bg-amber-500 border-amber-500 text-white"
        });
      }
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    verifyMutation.mutate({ token: code.trim(), useRecovery });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            {useRecovery 
              ? "Enter one of your recovery codes to access your account."
              : "Enter the 6-digit code from your authenticator app to continue."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder={useRecovery ? "XXXX-XXXX" : "000000"}
                value={code}
                onChange={(e) => {
                  if (useRecovery) {
                    setCode(e.target.value.toUpperCase());
                  } else {
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  }
                }}
                className="text-center text-lg tracking-widest h-12"
                autoFocus
                data-testid="input-2fa-login-code"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={!code.trim() || verifyMutation.isPending}
              data-testid="button-2fa-login-verify"
            >
              {verifyMutation.isPending ? "Verifying..." : "Verify"}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-sidebar-border">
            <button
              type="button"
              onClick={() => {
                setUseRecovery(!useRecovery);
                setCode('');
              }}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center"
              data-testid="button-toggle-recovery-mode"
            >
              {useRecovery ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Use authenticator app instead
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  Lost your device? Use a recovery code
                </>
              )}
            </button>
          </div>

          {useRecovery && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-500">
                  Each recovery code can only be used once. After using it, consider regenerating new codes in your settings.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
