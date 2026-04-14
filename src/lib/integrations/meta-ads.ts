/**
 * Meta Ads integration (Marketing API).
 * Reaproveita logica dos scripts Python (gerar-relatorio.py, sicredi-relatorio.py).
 */

const BASE = "https://graph.facebook.com";
const DEFAULT_VERSION = process.env.META_API_VERSION || "v20.0";

export interface MetaInsights {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  actions: { action_type: string; value: string }[];
  cost_per_action_type: { action_type: string; value: string }[];
  inline_link_clicks?: number;
  campaign_name?: string;
  date_start?: string;
  date_stop?: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  objective?: string;
  status: string;
  effective_status?: string;
  created_time?: string;
}

export class MetaAdsClient {
  constructor(
    private token: string,
    private accountId: string,
    private version: string = DEFAULT_VERSION
  ) {}

  private async get<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    const url = new URL(`${BASE}/${this.version}/${path}`);
    url.searchParams.set("access_token", this.token);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
    }
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Meta API ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  }

  async account() {
    return this.get<{ id: string; name: string; currency: string; account_status: number; business_name?: string }>(
      this.accountId,
      { fields: "name,currency,account_status,business_name,timezone_name" }
    );
  }

  async campaigns(): Promise<MetaCampaign[]> {
    const res = await this.get<{ data: MetaCampaign[]; paging?: { next?: string } }>(
      `${this.accountId}/campaigns`,
      { fields: "id,name,objective,status,effective_status,created_time", limit: 200 }
    );
    return res.data;
  }

  async insights(opts: {
    since: string;
    until: string;
    level?: "account" | "campaign" | "adset" | "ad";
    campaignIds?: string[];
    fields?: string;
  }): Promise<MetaInsights[]> {
    const fields =
      opts.fields ||
      "campaign_name,spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type,inline_link_clicks";
    const params: Record<string, unknown> = {
      time_range: { since: opts.since, until: opts.until },
      fields,
      level: opts.level || "account",
      limit: 500,
    };
    if (opts.campaignIds?.length) {
      params.filtering = [{ field: "campaign.id", operator: "IN", value: opts.campaignIds }];
    }
    const res = await this.get<{ data: MetaInsights[] }>(`${this.accountId}/insights`, params);
    return res.data;
  }

  async insightsMonthly(opts: { since: string; until: string; campaignIds?: string[] }) {
    const params: Record<string, unknown> = {
      time_range: { since: opts.since, until: opts.until },
      fields: "spend,impressions,clicks,actions,cost_per_action_type",
      level: "account",
      time_increment: "monthly",
      limit: 500,
    };
    if (opts.campaignIds?.length) {
      params.filtering = [{ field: "campaign.id", operator: "IN", value: opts.campaignIds }];
    }
    const res = await this.get<{ data: (MetaInsights & { date_start: string; date_stop: string })[] }>(
      `${this.accountId}/insights`,
      params
    );
    return res.data;
  }
}

/** Extrai valor de um action_type especifico. */
export function extractAction(insights: MetaInsights, type: string): number {
  const a = insights.actions?.find((x) => x.action_type === type);
  return a ? Math.round(parseFloat(a.value)) : 0;
}

/** Soma varios tipos de acao. */
export function sumActions(insights: MetaInsights, types: string[]): number {
  return insights.actions?.filter((a) => types.includes(a.action_type))
    .reduce((acc, a) => acc + parseFloat(a.value), 0) || 0;
}

/** Detecta o objetivo dominante da conta. */
export function dominantObjective(campaigns: { actions?: MetaInsights["actions"] }[]): string {
  const priority = [
    "onsite_conversion.messaging_conversation_started_7d",
    "lead",
    "complete_registration",
    "omni_purchase",
    "link_click",
    "post_engagement",
  ];
  const totals: Record<string, number> = {};
  for (const c of campaigns) {
    for (const a of c.actions || []) totals[a.action_type] = (totals[a.action_type] || 0) + parseFloat(a.value);
  }
  for (const p of priority) if ((totals[p] || 0) > 0) return p;
  return "link_click";
}
