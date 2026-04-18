/**
 * Email via Resend (resend.com)
 * Env: RESEND_API_KEY
 * Free tier: 100 emails/dia, 3000/mes
 * Se RESEND_API_KEY ausente, loga no console e nao falha
 */

interface SendEmailOpts {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(opts: SendEmailOpts): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { sent: false, error: "RESEND_API_KEY ausente no Vercel" };
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: opts.from || "Nogueira OS <onboarding@resend.dev>",
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { sent: false, error: `Resend ${r.status}: ${txt.slice(0, 300)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "erro" };
  }
}

export function conviteEmailHtml(params: {
  nomeConvidado: string;
  tenantName: string;
  role: string;
  team?: string;
  inviteUrl: string;
  convidadoPor?: string;
}): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 50px; height: 50px; background: linear-gradient(135deg, #0055cc, #06b6d4); border-radius: 12px;"></div>
        <h2 style="margin: 16px 0 4px; color: #fff; font-size: 20px;">Nogueira OS</h2>
      </div>
      <div style="background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 12px; padding: 30px; color: #e0e0e0;">
        <h1 style="font-size: 22px; margin: 0 0 12px; color: #fff;">Você foi convidado!</h1>
        <p style="color: #a0a0c0; margin: 0 0 20px;">
          ${params.convidadoPor ? `<b>${params.convidadoPor}</b> te convidou pra` : "Você foi convidado pra"}
          <b style="color: #06b6d4;"> ${params.tenantName}</b>
        </p>
        <div style="background: #0d0d1a; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <div style="font-size: 13px; color: #a0a0c0;">Email: <b style="color: #fff;">${params.nomeConvidado}</b></div>
          <div style="font-size: 13px; color: #a0a0c0;">Cargo: <b style="color: #fff;">${params.role}</b></div>
          ${params.team ? `<div style="font-size: 13px; color: #a0a0c0;">Time: <b style="color: #fff;">${params.team}</b></div>` : ""}
        </div>
        <a href="${params.inviteUrl}" style="display: block; text-align: center; background: linear-gradient(135deg, #0055cc, #06b6d4); color: #fff; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Aceitar convite
        </a>
        <p style="font-size: 12px; color: #666; margin: 16px 0 0; text-align: center;">
          Expira em 14 dias. Se você não esperava esse convite, ignore.
        </p>
      </div>
    </div>
  `;
}
