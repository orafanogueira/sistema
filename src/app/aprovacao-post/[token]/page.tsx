import { notFound } from "next/navigation";
import { AprovacaoClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AprovacaoPostPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = process.env.NEXT_PUBLIC_APP_URL || "https://app.gruponogueiramkt.com";
  const res = await fetch(`${url}/api/aprovacao-post/${token}`, { cache: "no-store" });
  if (!res.ok) notFound();
  const data = await res.json();
  return <AprovacaoClient token={token} data={data} />;
}
