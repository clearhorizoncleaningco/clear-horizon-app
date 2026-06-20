"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Feedback = { type: "error" | "info"; text: string } | null;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback>(
    searchParams.get("error")
      ? { type: "error", text: "Sign-in link was invalid or expired. Try again." }
      : null,
  );

  async function handlePasswordSignIn(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setFeedback(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setFeedback({ type: "error", text: error.message });
      setPending(false);
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  async function handleMagicLink() {
    if (!email) {
      setFeedback({ type: "error", text: "Enter your email first." });
      return;
    }
    setPending(true);
    setFeedback(null);

    const emailRedirectTo = `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(redirectTo)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });
    setPending(false);

    if (error) {
      setFeedback({ type: "error", text: error.message });
      return;
    }
    setFeedback({ type: "info", text: `Magic link sent to ${email}. Check your inbox.` });
  }

  return (
    <form onSubmit={handlePasswordSignIn} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@clearhorizoncleaners.com"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      {feedback ? (
        <p
          role="status"
          className={
            feedback.type === "error"
              ? "text-sm font-medium text-red-600 dark:text-red-400"
              : "text-sm font-medium text-brand-blue"
          }
        >
          {feedback.text}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={handleMagicLink}
        className="w-full"
      >
        Email me a magic link
      </Button>
    </form>
  );
}
