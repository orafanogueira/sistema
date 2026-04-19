/**
 * Apify API wrapper — extratores de Instagram + Facebook Groups
 * Docs: https://docs.apify.com/api/v2
 */

const BASE = "https://api.apify.com/v2";

function apiKey(): string {
  const k = process.env.APIFY_API_KEY;
  if (!k) throw new Error("APIFY_API_KEY ausente no Vercel");
  return k;
}

function cleanUsername(input: string): string {
  let clean = input.trim();
  const match = clean.match(/instagram\.com\/([^/?]+)/);
  if (match) clean = match[1];
  clean = clean.replace("@", "").replace(/\//g, "");
  return clean;
}

export interface InstagramProfile {
  username: string;
  fullName: string;
  biography: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  email?: string;
  phone?: string;
  website?: string;
  profilePicUrl?: string;
  isVerified: boolean;
  isBusinessAccount: boolean;
  businessCategory?: string;
}

export interface FacebookGroupMember {
  name: string;
  profileUrl: string;
  id?: string;
  bio?: string;
}

export async function extractInstagramProfile(username: string): Promise<InstagramProfile[]> {
  const clean = cleanUsername(username);

  const r = await fetch(`${BASE}/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: [`https://www.instagram.com/${clean}/`],
      resultsType: "details",
      resultsLimit: 1,
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Apify IG profile ${r.status}: ${txt.slice(0, 200)}`);
  }

  return r.json();
}

export interface InstagramFollower {
  username: string;
  fullName?: string;
  profilePicUrl?: string;
  email?: string;
  phone?: string;
  website?: string;
  biography?: string;
  isBusinessAccount?: boolean;
  businessCategory?: string;
  followersCount?: number;
}

export async function extractInstagramFollowers(username: string, maxFollowers = 500): Promise<InstagramFollower[]> {
  const clean = cleanUsername(username);

  // Tenta actors específicos pra followers (community actors)
  const actors = [
    "reGe1ST3r~instagram-followers-scraper",
    "apify~instagram-followers-scraper",
    "zuzka~instagram-followers-scraper",
  ];

  let lastErr = "";
  for (const actor of actors) {
    try {
      const r = await fetch(`${BASE}/acts/${actor}/run-sync-get-dataset-items?token=${apiKey()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernames: [clean],
          resultsLimit: maxFollowers,
        }),
      });
      if (r.ok) return r.json();
      lastErr = `${actor}: ${r.status}`;
    } catch (e: unknown) {
      lastErr = `${actor}: ${e instanceof Error ? e.message : "erro"}`;
    }
  }

  // Fallback: usa instagram-scraper pegando posts e extrai quem interagiu
  const r = await fetch(`${BASE}/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: [`https://www.instagram.com/${clean}/`],
      resultsType: "posts",
      resultsLimit: Math.min(maxFollowers, 50),
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Nenhum actor de followers funcionou (${lastErr}). Fallback posts: ${r.status}: ${txt.slice(0, 150)}`);
  }

  const posts = await r.json();
  // extrai perfis únicos que comentaram/curtiram
  const profiles = new Map<string, InstagramFollower>();
  for (const post of posts as Array<Record<string, unknown>>) {
    const comments = (post.latestComments || []) as Array<{ ownerUsername?: string; ownerFullName?: string }>;
    for (const c of comments) {
      if (c.ownerUsername && !profiles.has(c.ownerUsername)) {
        profiles.set(c.ownerUsername, { username: c.ownerUsername, fullName: c.ownerFullName });
      }
    }
  }
  return Array.from(profiles.values());
}

/**
 * Enriquece uma lista de seguidores com dados de contato (email/phone/website).
 * Email e telefone só aparecem em perfis Business/Creator.
 * Processa em lotes de 20 perfis por chamada Apify pra não estourar timeout.
 */
export async function enrichFollowersWithContact(
  followers: InstagramFollower[],
  opts: { batchSize?: number; onlyWithContact?: boolean } = {}
): Promise<InstagramFollower[]> {
  const batchSize = opts.batchSize || 20;
  const enriched: InstagramFollower[] = [];

  for (let i = 0; i < followers.length; i += batchSize) {
    const batch = followers.slice(i, i + batchSize);
    const urls = batch.map((f) => `https://www.instagram.com/${f.username}/`);

    try {
      const r = await fetch(`${BASE}/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apiKey()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: urls,
          resultsType: "details",
          resultsLimit: batch.length,
        }),
      });

      if (!r.ok) {
        // em erro, mantém só os dados básicos da batch
        enriched.push(...batch);
        continue;
      }

      const details = (await r.json()) as Array<Record<string, unknown>>;
      for (const original of batch) {
        const match = details.find(
          (d) => String(d.username || "").toLowerCase() === original.username.toLowerCase()
        );

        if (!match) {
          enriched.push(original);
          continue;
        }

        const email =
          (match.businessEmail as string) ||
          (match.publicEmail as string) ||
          extractEmailFromBio((match.biography as string) || "") ||
          undefined;

        const phone =
          (match.businessPhoneNumber as string) ||
          (match.publicPhoneNumber as string) ||
          extractPhoneFromBio((match.biography as string) || "") ||
          undefined;

        enriched.push({
          username: original.username,
          fullName: (match.fullName as string) || original.fullName,
          profilePicUrl: (match.profilePicUrl as string) || original.profilePicUrl,
          biography: (match.biography as string) || undefined,
          email,
          phone,
          website: (match.externalUrl as string) || undefined,
          isBusinessAccount: (match.isBusinessAccount as boolean) || false,
          businessCategory: (match.businessCategoryName as string) || undefined,
          followersCount: (match.followersCount as number) || undefined,
        });
      }
    } catch {
      enriched.push(...batch);
    }
  }

  if (opts.onlyWithContact) {
    return enriched.filter((e) => e.email || e.phone);
  }
  return enriched;
}

function extractEmailFromBio(bio: string): string | undefined {
  const match = bio.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : undefined;
}

function extractPhoneFromBio(bio: string): string | undefined {
  // tenta pegar telefone BR: (11) 98765-4321, 11987654321, +5511987654321 etc
  const match = bio.match(/(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/);
  return match ? match[0].replace(/\D/g, "") : undefined;
}

export async function extractFacebookGroupMembers(groupUrl: string, maxMembers = 500): Promise<FacebookGroupMember[]> {
  const r = await fetch(`${BASE}/acts/apify~facebook-groups-scraper/run-sync-get-dataset-items?token=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startUrls: [{ url: groupUrl }],
      resultsLimit: maxMembers,
      scrapeGroupMembers: true,
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Apify FB group ${r.status}: ${txt.slice(0, 200)}`);
  }

  return r.json();
}
