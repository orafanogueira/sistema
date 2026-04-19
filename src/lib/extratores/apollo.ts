/**
 * Apollo.io API wrapper — busca leads no LinkedIn + enriquecimento
 * Docs: https://apolloio.github.io/apollo-api-docs/
 */

const BASE = "https://api.apollo.io/v1";

function apiKey(): string {
  const k = process.env.APOLLO_API_KEY;
  if (!k) throw new Error("APOLLO_API_KEY ausente no Vercel");
  return k;
}

export interface ApolloContact {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string;
  email?: string;
  linkedin_url?: string;
  phone_numbers?: Array<{ raw_number: string; type: string }>;
  organization_name?: string;
  city?: string;
  state?: string;
  country?: string;
  photo_url?: string;
}

export interface ApolloOrganization {
  id: string;
  name: string;
  website_url?: string;
  linkedin_url?: string;
  phone?: string;
  industry?: string;
  estimated_num_employees?: number;
  city?: string;
  state?: string;
  country?: string;
}

/** Busca pessoas no LinkedIn por cargo/empresa/localização/indústria/keywords
 *  Usa o novo endpoint people/search (mixed_people foi deprecado)
 */
export async function searchPeople(opts: {
  job_titles?: string[];
  location?: string;
  industry?: string;
  industry_keywords?: string;     // nicho em texto livre
  company_name?: string;
  keywords?: string;              // termo livre
  per_page?: number;
  page?: number;
}): Promise<{ contacts: ApolloContact[]; total: number }> {
  const body: Record<string, unknown> = {
    per_page: opts.per_page || 25,
    page: opts.page || 1,
  };

  if (opts.job_titles && opts.job_titles.length > 0) body.person_titles = opts.job_titles;
  if (opts.location) body.person_locations = [opts.location];
  if (opts.company_name) body.q_organization_name = opts.company_name;
  if (opts.industry) body.organization_industry_tag_ids = [opts.industry];
  if (opts.industry_keywords) body.q_organization_keyword_tags = [opts.industry_keywords];
  if (opts.keywords) body.q_keywords = opts.keywords;

  const r = await fetch(`${BASE}/mixed_people/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey() },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const txt = await r.text();
    // se for o erro de deprecation, tenta endpoint novo
    if (r.status === 422 && txt.includes("deprecated")) {
      const r2 = await fetch(`${BASE}/people/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey() },
        body: JSON.stringify(body),
      });
      if (!r2.ok) {
        throw new Error(`Apollo people/search ${r2.status}: ${(await r2.text()).slice(0, 200)}`);
      }
      const data2 = await r2.json();
      return {
        contacts: data2.people || data2.contacts || [],
        total: data2.pagination?.total_entries || 0,
      };
    }
    throw new Error(`Apollo search ${r.status}: ${txt.slice(0, 200)}`);
  }

  const data = await r.json();
  return {
    contacts: data.people || data.contacts || [],
    total: data.pagination?.total_entries || 0,
  };
}

/** Enriquece contato (pega email + telefone) */
export async function enrichContact(opts: {
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  linkedin_url?: string;
}): Promise<ApolloContact | null> {
  const r = await fetch(`${BASE}/people/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey() },
    body: JSON.stringify(opts),
  });

  if (!r.ok) return null;
  const data = await r.json();
  return data.person || null;
}

/** Busca empresas */
export async function searchOrganizations(opts: {
  name?: string;
  location?: string;
  industry?: string;
  per_page?: number;
}): Promise<{ organizations: ApolloOrganization[]; total: number }> {
  const r = await fetch(`${BASE}/mixed_companies/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey() },
    body: JSON.stringify({
      q_organization_name: opts.name || undefined,
      organization_locations: opts.location ? [opts.location] : [],
      per_page: opts.per_page || 25,
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Apollo orgs ${r.status}: ${txt.slice(0, 200)}`);
  }

  const data = await r.json();
  return {
    organizations: data.organizations || data.accounts || [],
    total: data.pagination?.total_entries || 0,
  };
}
