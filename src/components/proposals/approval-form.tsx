"use client";

import { useActionState } from "react";
import { submitApprovalAction, type ApprovalFormState } from "@/app/approve/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Lightweight e-approval (BUILD_SPEC §G): "I agree" checkbox + typed name. The
 * server action records the timestamp + IP. On success the page revalidates to
 * the approved confirmation view.
 */
export function ApprovalForm({ token, expiresAt }: { token: string; expiresAt: string }) {
  const [state, formAction, pending] = useActionState<ApprovalFormState, FormData>(
    submitApprovalAction,
    { ok: false },
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-brand-gold/60 bg-brand-gold/5 p-5">
      <div>
        <h2 className="text-lg font-semibold">Approve this proposal</h2>
        <p className="text-sm text-muted-foreground">
          Valid until {new Date(expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
        </p>
      </div>

      <input type="hidden" name="token" value={token} />

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="agree"
          className="mt-0.5 h-5 w-5 accent-[var(--primary)]"
          aria-label="I agree to the proposal and terms"
        />
        <span>
          I agree to this proposal and its Terms &amp; Conditions. I understand that typing my name
          and submitting this form is my electronic signature.
        </span>
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signerName">Type your full name to sign</Label>
        <Input id="signerName" name="signerName" placeholder="Jane Doe" autoComplete="name" required />
      </div>

      {state.error ? <p className="text-sm font-medium text-red-600 dark:text-red-400">{state.error}</p> : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Submitting…" : "I agree — approve proposal"}
      </Button>
    </form>
  );
}
