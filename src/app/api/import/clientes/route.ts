import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { getPreset } from "@/lib/verticais/presets";

const AUTOMOTIVO_SLUGS = new Set([
  "athos-motors", "mais-carros", "matheus-multimarcas", "senna-motors",
  "victor", "vicenza", "caldaro", "naninha-moveis",
]);

const AGENCIA_INTERNA = new Set(["agencia-lorem", "rafa-nogueira"]);

interface ImportClient {
  slug: string;
  nome: string;
  contato?: string;
  vencimento?: number;
  vencimentos?: number[];
  meta_account_id?: string;
  whatsapp_grupo_id?: string;
  valor_mensal?: number;
}

/**
 * Importa em lote a lista de clientes do scripts/config-clientes.json.
 * Auto-marca clientes "automotivos" e cria pipelines + automacoes do preset.
 *
 * POST body: { clientes: [...] } (ou body vazio = usa lista hardcoded abaixo)
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  let body: { clientes?: ImportClient[] } = {};
  try { body = await req.json(); } catch {}

  const clientes = body.clientes || HARDCODED_LIST;
  const service = await createServiceClient();
  const inboundDomain = process.env.LEADS_INBOUND_DOMAIN || "leads.gruponogueiramkt.com";

  const results: { slug: string; status: string; id?: string; error?: string }[] = [];

  for (const c of clientes) {
    try {
      const isAutomotivo = AUTOMOTIVO_SLUGS.has(c.slug);
      const isAgencia = AGENCIA_INTERNA.has(c.slug);
      const vertical = isAutomotivo ? "automotivo" : isAgencia ? "agencia" : "comercial";
      const preset = getPreset(vertical);

      const { data: existing } = await service.from("clientes")
        .select("id").eq("tenant_id", m.tenant_id).eq("slug", c.slug).maybeSingle();
      if (existing) {
        results.push({ slug: c.slug, status: "skipped (ja existe)", id: existing.id });
        continue;
      }

      const { data: created, error } = await service.from("clientes").insert({
        tenant_id: m.tenant_id,
        slug: c.slug,
        nome: c.nome,
        contato_nome: c.contato || null,
        ticket_mensal: c.valor_mensal || 0,
        vencimento: c.vencimento || c.vencimentos?.[0] || null,
        vencimentos_extra: c.vencimentos?.slice(1) || [],
        status: "ativo",
        vertical,
        modules: preset.modules,
        email_inbound: `${c.slug}@${inboundDomain}`,
        data_inicio: new Date().toISOString().slice(0, 10),
      }).select().single();

      if (error) { results.push({ slug: c.slug, status: "error", error: error.message }); continue; }

      // 2. Cria pipelines + stages do preset
      for (let i = 0; i < preset.pipelines.length; i++) {
        const pp = preset.pipelines[i];
        const { data: pipe } = await service.from("pipelines").insert({
          tenant_id: m.tenant_id, cliente_id: created.id,
          name: pp.name, vertical, is_default: i === 0,
        }).select().single();
        if (pipe) {
          await service.from("pipeline_stages").insert(pp.stages.map((s, j) => ({
            pipeline_id: pipe.id, name: s.name, color: s.color, position: s.position ?? j,
            is_won: s.is_won || false, is_lost: s.is_lost || false, sla_minutes: s.sla_minutes || null,
          })));
        }
      }

      // 3. Automacoes do preset
      for (const auto of preset.automations) {
        await service.from("automations").insert({
          tenant_id: m.tenant_id, cliente_id: created.id,
          name: auto.name, trigger: auto.trigger,
          trigger_config: auto.trigger_config, conditions: auto.conditions || [], actions: auto.actions,
          is_active: true,
        });
      }

      // 4. Integracao Meta Ads se tiver account_id
      if (c.meta_account_id && c.meta_account_id !== "act_PREENCHER") {
        await service.from("integrations").insert({
          tenant_id: m.tenant_id, cliente_id: created.id,
          provider: "meta_ads",
          account_id: c.meta_account_id,
          is_connected: true,
        });
      }

      results.push({ slug: c.slug, status: "created", id: created.id });
    } catch (e: unknown) {
      results.push({ slug: c.slug, status: "error", error: e instanceof Error ? e.message : "erro" });
    }
  }

  return NextResponse.json({ total: results.length, results });
}

// fallback list (extraida do scripts/config-clientes.json em 2026-04)
const HARDCODED_LIST: ImportClient[] = [
  { slug: "cleber-castro", nome: "Cleber Castro", contato: "Cleber", vencimento: 1, valor_mensal: 2800, meta_account_id: "act_PREENCHER" },
  { slug: "santana", nome: "Santana", vencimento: 2, valor_mensal: 2000 },
  { slug: "matheus-multimarcas", nome: "Matheus Multimarcas", contato: "WhatsApp", vencimentos: [5, 28], valor_mensal: 2500 },
  { slug: "dr-helio", nome: "DR HELIO", contato: "Portal", vencimento: 5, valor_mensal: 2500 },
  { slug: "caldaro", nome: "Caldaro", vencimento: 2, valor_mensal: 2500 },
  { slug: "carla-stoler", nome: "Carla Stoler", vencimentos: [7, 9], valor_mensal: 2500 },
  { slug: "dignissima", nome: "Dignissima", vencimento: 10, valor_mensal: 2750 },
  { slug: "dra-isabella", nome: "Dra Isabella Ferro", contato: "Isabella", vencimento: 10, valor_mensal: 1000 },
  { slug: "beleza-terapeutica", nome: "Beleza Terapeutica", contato: "Deborah Gouvea", vencimento: 11, valor_mensal: 700, meta_account_id: "act_9338713149479964" },
  { slug: "agencia-lorem", nome: "Agencia Lorem", contato: "Amanda", vencimento: 19, valor_mensal: 900 },
  { slug: "sobrancelha", nome: "Sobrancelha", vencimento: 13, valor_mensal: 4197, meta_account_id: "act_994960984319886" },
  { slug: "natan", nome: "NATAN", contato: "Rafael", vencimento: 15, valor_mensal: 1200 },
  { slug: "portal-group", nome: "Portal Group", contato: "Junior e Carla", vencimento: 15, valor_mensal: 1500 },
  { slug: "naninha-moveis", nome: "Naninha Moveis", vencimento: 16, valor_mensal: 2500 },
  { slug: "enlace-noivas", nome: "ENLACE NOIVAS", contato: "Thaisa", vencimento: 21, valor_mensal: 1200 },
  { slug: "vicenza", nome: "Vicenza", contato: "Andre", vencimento: 27, valor_mensal: 2000 },
  { slug: "victor", nome: "Victor Automoveis", vencimento: 9, valor_mensal: 1750 },
  { slug: "inviolavel", nome: "Inviolavel", contato: "Grupo", vencimento: 30, valor_mensal: 1200 },
  { slug: "farmacia-douglas", nome: "Farmacia Douglas", vencimento: 1, valor_mensal: 750 },
  { slug: "senna-motors", nome: "Senna Motors", vencimento: 3, valor_mensal: 1750 },
  { slug: "asa", nome: "ASA", vencimento: 30, valor_mensal: 1400 },
  { slug: "instituto-gourmet", nome: "Instituto Gourmet", vencimento: 5, valor_mensal: 3000 },
  { slug: "mais-carros", nome: "Mais Carros", vencimento: 10, valor_mensal: 1750 },
  { slug: "quintanilha", nome: "Quintanilha", vencimento: 11, valor_mensal: 1700, meta_account_id: "act_735494971309244" },
  { slug: "oxy-studio", nome: "Oxy Studio", vencimento: 11, valor_mensal: 700, meta_account_id: "act_641821106432462" },
  { slug: "athos-motors", nome: "Athos Motors", vencimento: 11, valor_mensal: 1500, meta_account_id: "act_1499123907239834" },
  { slug: "cuidare", nome: "Cuidare", vencimento: 24, valor_mensal: 1700 },
  { slug: "vidracaria", nome: "Vidracaria", contato: "Emmanuel", vencimento: 25, valor_mensal: 1200 },
  { slug: "junior-soares", nome: "Junior Soares", vencimento: 30, valor_mensal: 2000 },
  { slug: "grow", nome: "Grow", contato: "Rodolfo", vencimento: 30, valor_mensal: 3500 },
  { slug: "rafa-nogueira", nome: "Rafa Nogueira", contato: "Rafa", vencimento: 30, valor_mensal: 0, meta_account_id: "act_1457708059280155" },
  { slug: "sicredi-celeiro-centro-oeste", nome: "Sicredi Celeiro Centro Oeste", vencimento: 30, valor_mensal: 0, meta_account_id: "act_411266327455499" },
];
