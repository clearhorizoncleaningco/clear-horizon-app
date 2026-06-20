import { Suspense } from "react";
import Image from "next/image";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import logo from "../../../public/brand/04_alt_stacked_1.png";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Image src={logo} alt="Clear Horizon Cleaning Co." className="h-24 w-auto" priority />
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to the estimating platform</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-48" />}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">Clean Spaces. Better Places.</p>
      </div>
    </main>
  );
}
