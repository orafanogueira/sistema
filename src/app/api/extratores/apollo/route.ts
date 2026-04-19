import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchPeople, searchOrganizations, enrichContact } from "@/lib/extratores/apollo";

export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const {
    tipo,
    job_titles,
    location,
    industry,
    industry_keywords,
    company_name,
    keywords,
    per_page,
    linkedin_url,
    first_name,
    last_name,
  } = await req.json();

  try {
    if (tipo === "empresas") {
      const result = await searchOrganizations({ name: company_name, location, industry, per_page });
      return NextResponse.json(result);
    }

    if (tipo === "enriquecer") {
      const contact = await enrichContact({ first_name, last_name, organization_name: company_name, linkedin_url });
      return NextResponse.json({ contact });
    }

    // default: busca pessoas
    const result = await searchPeople({
      job_titles: job_titles ? (Array.isArray(job_titles) ? job_titles : [job_titles]) : [],
      location,
      industry,
      industry_keywords,
      company_name,
      keywords,
      per_page: per_page || 25,
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro", { status: 500 });
  }
}
