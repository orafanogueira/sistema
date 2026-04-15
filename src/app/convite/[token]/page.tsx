import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { AceitarConvite } from "./client";

export const dynamic = "force-dynamic";

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = process.env.NEXT_PUBLIC_APP_URL || "https://app.gruponogueiramkt.com";
  const res = await fetch(`${url}/api/team-invites/${token}`, { cache: "no-store" });
  if (!res.ok) notFound();
  const data = await res.json();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_center,rgba(0,85,204,.15),transparent_60%)]">
      <Card className="w-full max-w-md p-8">
        <CardContent className="p-0 text-center">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 to-cyan mx-auto mb-6" />
          <div className="text-xs uppercase tracking-wider text-cyan font-bold mb-2">Convite recebido</div>
          <h1 className="text-2xl font-black mb-2">Voce foi convidado pra {data.tenant?.name}</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Convite pra {data.email} com papel <b>{data.role}</b>
            {data.team && ` no time de ${data.team}`}.
          </p>
          <AceitarConvite token={token} email={data.email} />
        </CardContent>
      </Card>
    </div>
  );
}
