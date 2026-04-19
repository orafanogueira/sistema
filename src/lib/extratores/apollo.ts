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

/** Busca pessoas no LinkedIn por cargo/empresa/localização */
export async function searchPeople(opts: {
  job_titles?: string[];
  location?: string;
  industry?: string;
  company_name?: string;
  per_page?: number;
  page?: number;
}): Promise<{ contacts: ApolloContact[]; total: number }> {
  const r = await fetch(`${BASE}/mixed_people/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey() },
    body: JSON.stringify({
      person_titles: opts.job_titles || [],
      person_locations: opts.location ? [opts.location] : [],
      q_organization_name: opts.company_name || undefined,
      organization_industry_tag_ids: opts.industry ? [opts.industry] : undefined,
      per_page: opts.per_page || 25,
      page: opts.page || 1,
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
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
