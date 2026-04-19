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

export async function extractInstagramFollowers(username: string, maxFollowers = 500): Promise<Array<{ username: string; fullName?: string; profilePicUrl?: string }>> {
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
  const profiles = new Map<string, { username: string; fullName?: string }>();
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
