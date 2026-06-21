import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { listAuditLogs } from "@/lib/audit/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage() {
  const { profile } = await requireProfile();
  if (!profile) return null;
  if (profile.role !== "Admin") redirect("/dashboard");

  const logs = await listAuditLogs(profile.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="text-muted-foreground">
          Every pricing change, who made it, and the old → new value.{" "}
          <Link href="/admin/pricing" className="text-primary hover:underline">Pricing settings →</Link>
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pricing changes</CardTitle>
          <CardDescription>{logs.length} most recent entries.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No pricing changes recorded yet. Edits made in Admin → Pricing will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {logs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-start justify-between gap-2 px-6 py-3">
                  <div className="min-w-0">
                    <div className="font-medium">{log.summary}</div>
                    <div className="text-xs text-muted-foreground">
                      {log.entity}
                      {log.entityLabel ? ` · ${log.entityLabel}` : ""} · {log.action}
                      {log.actorEmail ? ` · by ${log.actorEmail}` : ""}
                    </div>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={log.createdAt.toISOString()}>
                    {log.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
