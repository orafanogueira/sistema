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
  email?: string;
  phone?: string;
  postContent?: string; // conteúdo do post que fez (pra dar contexto)
  postDate?: string;
  totalPosts?: number;   // quantos posts fez no grupo
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
  const url = `https://www.instagram.com/${clean}/`;

  // O Apify não tem mais actor público estável de "followers" (community actors foram removidos).
  // A realidade: extrair quem INTERAGE (comentários/curtidas) nos posts recentes.
  // Quanto mais posts, mais comentadores únicos captamos.

  // Estratégia: pedir MUITOS posts pra pegar o máximo de comentadores únicos.
  const postsNeeded = Math.min(Math.ceil(maxFollowers / 15), 100); // ~15 comentários por post

  const profiles = new Map<string, InstagramFollower>();
  const errors: string[] = [];

  // 1ª tentativa: actor principal apify~instagram-scraper com posts + latestComments
  try {
    const r = await fetch(`${BASE}/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [url],
        resultsType: "posts",
        resultsLimit: postsNeeded,
        addParentData: false,
      }),
    });

    if (r.ok) {
      const posts = (await r.json()) as Array<Record<string, unknown>>;
      for (const post of posts) {
        const comments = (post.latestComments || []) as Array<{ ownerUsername?: string; ownerFullName?: string }>;
        for (const c of comments) {
          if (c.ownerUsername && !profiles.has(c.ownerUsername)) {
            profiles.set(c.ownerUsername, { username: c.ownerUsername, fullName: c.ownerFullName });
          }
        }
        // alguns posts trazem taggedUsers tbm
        const tagged = (post.taggedUsers || []) as Array<{ username?: string; full_name?: string }>;
        for (const t of tagged) {
          if (t.username && !profiles.has(t.username)) {
            profiles.set(t.username, { username: t.username, fullName: t.full_name });
          }
        }
      }
    } else {
      errors.push(`instagram-scraper posts: ${r.status} ${(await r.text()).slice(0, 120)}`);
    }
  } catch (e: unknown) {
    errors.push(`instagram-scraper posts: ${e instanceof Error ? e.message : "erro"}`);
  }

  // 2ª tentativa: puxa comments separadamente (mais comentadores por post)
  if (profiles.size < maxFollowers) {
    try {
      const r = await fetch(`${BASE}/acts/apify~instagram-comment-scraper/run-sync-get-dataset-items?token=${apiKey()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: [url],
          resultsLimit: maxFollowers * 2,
        }),
      });
      if (r.ok) {
        const comments = (await r.json()) as Array<Record<string, unknown>>;
        for (const c of comments) {
          const u = (c.ownerUsername || c.username) as string;
          const n = (c.ownerFullName || c.fullName) as string;
          if (u && !profiles.has(u)) {
            profiles.set(u, { username: u, fullName: n });
          }
        }
      } else {
        errors.push(`comment-scraper: ${r.status}`);
      }
    } catch (e: unknown) {
      errors.push(`comment-scraper: ${e instanceof Error ? e.message : "erro"}`);
    }
  }

  const result = Array.from(profiles.values()).slice(0, maxFollowers);

  if (result.length === 0) {
    throw new Error(`Não consegui extrair interações de @${clean}. Erros: ${errors.join(" | ").slice(0, 300)}`);
  }

  return result;
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

        const bio = (match.biography as string) || "";
        const website = (match.externalUrl as string) || undefined;

        let email =
          (match.businessEmail as string) ||
          (match.publicEmail as string) ||
          extractEmailFromBio(bio) ||
          undefined;

        const phone =
          (match.businessPhoneNumber as string) ||
          (match.publicPhoneNumber as string) ||
          extractPhoneFromBio(bio) ||
          undefined;

        // último recurso: raspa o website procurando email na home
        if (!email && website && website.startsWith("http")) {
          email = await extractEmailFromWebsite(website);
        }

        enriched.push({
          username: original.username,
          fullName: (match.fullName as string) || original.fullName,
          profilePicUrl: (match.profilePicUrl as string) || original.profilePicUrl,
          biography: bio || undefined,
          email,
          phone,
          website,
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
  if (!bio) return undefined;
  // remove emojis e caracteres especiais que colam no email
  const clean = bio.replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/gu, " ");
  const match = clean.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : undefined;
}

function extractPhoneFromBio(bio: string): string | undefined {
  if (!bio) return undefined;
  // BR: vários formatos — (11) 98765-4321, 11987654321, +5511987654321, 11 9 8765 4321
  const patterns = [
    /\+?55\s?\(?\d{2}\)?\s?9?\s?\d{4}[-\s]?\d{4}/,
    /\(?\d{2}\)?\s?9\s?\d{4}[-\s]?\d{4}/,
    /\b\d{2}\s?9\d{8}\b/,
    /\bwa\.me\/(\d+)/i,
    /\bapi\.whatsapp\.com\/send\?phone=(\d+)/i,
  ];
  for (const p of patterns) {
    const m = bio.match(p);
    if (m) {
      const digits = (m[1] || m[0]).replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 13) return digits;
    }
  }
  return undefined;
}

/**
 * Tenta extrair email da página inicial do site externo do perfil (quando IG tem link).
 * Usa Apify web-scraper; só chama se o perfil tiver website e ainda não tivermos email.
 */
async function extractEmailFromWebsite(url: string): Promise<string | undefined> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ContactScraper/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return undefined;
    const html = await r.text();
    return extractEmailFromBio(html);
  } catch {
    return undefined;
  }
}

export async function extractFacebookGroupMembers(groupUrl: string, maxMembers = 500): Promise<FacebookGroupMember[]> {
  // Realidade 2026: grupos FB limitaram muito extração direta de membros.
  // Estratégia: extrair POSTS recentes (funciona em grupos públicos) e agregar autores.
  // Quem posta ativamente = lead mais quente que membro silencioso.

  const membersMap = new Map<string, FacebookGroupMember>();
  const errors: string[] = [];

  // 1ª tentativa: actor de posts do grupo (mais confiável)
  try {
    const r = await fetch(`${BASE}/acts/apify~facebook-groups-scraper/run-sync-get-dataset-items?token=${apiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: [{ url: groupUrl }],
        resultsLimit: Math.min(maxMembers * 2, 200),
      }),
    });

    if (r.ok) {
      const posts = (await r.json()) as Array<Record<string, unknown>>;

      for (const post of posts) {
        const authorName = (post.user as Record<string, unknown>)?.name as string
          || (post.authorName as string)
          || (post.ownerName as string);
        const authorUrl = (post.user as Record<string, unknown>)?.profileUrl as string
          || (post.authorUrl as string)
          || (post.ownerUrl as string);
        const postText = (post.text as string) || (post.message as string) || "";
        const postDate = (post.time as string) || (post.date as string);

        if (!authorName) continue;

        // extrai email/telefone do texto do post
        const emailInPost = extractEmailFromBio(postText);
        const phoneInPost = extractPhoneFromBio(postText);

        const key = authorUrl || authorName;
        const existing = membersMap.get(key);

        if (existing) {
          existing.totalPosts = (existing.totalPosts || 1) + 1;
          // mantém o melhor contato que achou
          if (!existing.email && emailInPost) existing.email = emailInPost;
          if (!existing.phone && phoneInPost) existing.phone = phoneInPost;
          // se post novo é mais longo, atualiza
          if (postText.length > (existing.postContent?.length || 0)) {
            existing.postContent = postText.slice(0, 400);
            existing.postDate = postDate;
          }
        } else {
          membersMap.set(key, {
            name: authorName,
            profileUrl: authorUrl || "",
            email: emailInPost,
            phone: phoneInPost,
            postContent: postText.slice(0, 400),
            postDate,
            totalPosts: 1,
          });
        }

        // também coleta comentadores (engajamento ainda maior)
        const comments = (post.comments as Array<Record<string, unknown>>) || [];
        for (const c of comments.slice(0, 10)) {
          const cName = (c.user as Record<string, unknown>)?.name as string || (c.authorName as string);
          const cUrl = (c.user as Record<string, unknown>)?.profileUrl as string || (c.authorUrl as string);
          const cText = (c.text as string) || "";
          if (!cName) continue;
          const cKey = cUrl || cName;
          if (!membersMap.has(cKey)) {
            membersMap.set(cKey, {
              name: cName,
              profileUrl: cUrl || "",
              email: extractEmailFromBio(cText),
              phone: extractPhoneFromBio(cText),
              postContent: cText.slice(0, 200),
              totalPosts: 0,
            });
          }
        }
      }
    } else {
      errors.push(`fb-groups: ${r.status} ${(await r.text()).slice(0, 120)}`);
    }
  } catch (e: unknown) {
    errors.push(`fb-groups: ${e instanceof Error ? e.message : "erro"}`);
  }

  const result = Array.from(membersMap.values()).slice(0, maxMembers);

  if (result.length === 0) {
    throw new Error(`Não consegui extrair do grupo. Grupo pode ser privado ou ter limitação. Erros: ${errors.join(" | ").slice(0, 300)}`);
  }

  return result;
}
