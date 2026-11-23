"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock, Mail, ArrowRight, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both your email address and password.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      if (!data.session) {
        setErrorMessage("No active session returned. Please check Supabase Auth settings.");
        setIsLoading(false);
        return;
      }

      toast.success("Signed in! Opening workspace...");
      window.location.assign("/");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to reach Supabase. Check .env.local and restart npm run dev."
      );
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8f9fa] px-4 py-12">
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
        style={{
          background: "radial-gradient(circle, #4b8f9a 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full opacity-15 blur-3xl"
        style={{
          background: "radial-gradient(circle, #084154 0%, transparent 70%)",
        }}
      />

      <div className="glass-card relative z-10 w-full max-w-md rounded-2xl p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size="lg"/>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-[#084154]">
            Founder & Team Sign In
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Access your consulting pipeline, client profiles, and projects.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/90 p-3.5 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-5">
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              Email Address
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="founder@yourfirm.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="h-11 bg-white/90 pl-10 focus-visible:ring-[#4b8f9a]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              Password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="h-11 bg-white/90 pl-10 focus-visible:ring-[#4b8f9a]"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="brand-gradient h-11 w-full rounded-xl font-semibold text-white shadow-md transition-opacity hover:opacity-95"
          >
            {isLoading ? (
              "Signing in..."
            ) : (
              <span className="flex items-center justify-center gap-2">
                Sign In to Workspace
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Authorized personnel only · Protected by Supabase Auth
        </p>
      </div>
    </div>
  );
}