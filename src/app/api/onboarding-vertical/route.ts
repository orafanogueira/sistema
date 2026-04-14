import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPreset, type Vertical } from "@/lib/verticais/presets";

/**
 * Aplica preset de uma vertical em um cliente (ou no tenant todo).
 * Cria pipelines + estagios + templates + automacoes default.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { vertical, cliente_id } = (await req.json()) as { vertical: Vertical; cliente_id?: string };
  const preset = getPreset(vertical);

  // 1. atualiza vertical e modules
  if (cliente_id) {
    await supabase.from("clientes").update({ vertical, modules: preset.modules }).eq("id", cliente_id);
  } else {
    await supabase.from("tenants").update({ vertical, modules: preset.modules }).eq("id", m.tenant_id);
  }

  // 2. cria pipelines + stages
  for (let i = 0; i < preset.pipelines.length; i++) {
    const pp = preset.pipelines[i];
    const { data: pipe } = await supabase.from("pipelines").insert({
      tenant_id: m.tenant_id, cliente_id: cliente_id || null,
      name: pp.name, vertical, is_default: i === 0,
    }).select().single();

    if (pipe) {
      await supabase.from("pipeline_stages").insert(pp.stages.map((s, j) => ({
        pipeline_id: pipe.id, name: s.name, color: s.color, position: s.position ?? j,
        is_won: s.is_won || false, is_lost: s.is_lost || false, sla_minutes: s.sla_minutes || null,
      })));
    }
  }

  // 3. templates
  for (const tpl of preset.templates) {
    await supabase.from("followup_templates").insert({
      tenant_id: m.tenant_id, name: tpl.name, channel: tpl.channel, category: tpl.category,
      subject: tpl.subject || null, body: tpl.body, vertical,
    });
  }

  // 4. automacoes
  for (const auto of preset.automations) {
    await supabase.from("automations").insert({
      tenant_id: m.tenant_id, cliente_id: cliente_id || null,
      name: auto.name, trigger: auto.trigger,
      trigger_config: auto.trigger_config, conditions: auto.conditions || [], actions: auto.actions,
      is_active: true,
    });
  }

  return NextResponse.json({ ok: true, vertical, applied: preset.label });
}
