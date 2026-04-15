/**
 * Google Places API (New) integration.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 *
 * Rate: free tier $200/month credit. Text Search = $32/1000 req, Details = $17/1000 req.
 * 50 empresas completas = 50 details requests = ~$0.85.
 */

const BASE = "https://places.googleapis.com/v1";

export interface PlaceResult {
  place_id: string;
  nome: string;
  endereco: string;
  telefone?: string;
  website?: string;
  rating?: number;
  reviews_count?: number;
  categoria?: string;
  latitude?: number;
  longitude?: number;
  google_maps_url?: string;
}

async function placesFetch<T>(path: string, body: object, fieldMask: string): Promise<T> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY ausente — configurar no Vercel");

  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Google Places ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json();
}

/** Text Search: busca empresas por termo livre + cidade. */
export async function searchPlaces(query: string, maxResults = 50): Promise<PlaceResult[]> {
  const fieldMask = [
    "places.id", "places.displayName", "places.formattedAddress",
    "places.internationalPhoneNumber", "places.nationalPhoneNumber",
    "places.websiteUri", "places.rating", "places.userRatingCount",
    "places.types", "places.location", "places.googleMapsUri",
  ].join(",");

  type RawPlace = {
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    internationalPhoneNumber?: string;
    nationalPhoneNumber?: string;
    websiteUri?: string;
    rating?: number;
    userRatingCount?: number;
    types?: string[];
    location?: { latitude?: number; longitude?: number };
    googleMapsUri?: string;
  };
  const data = await placesFetch<{ places?: RawPlace[] }>("/places:searchText", {
    textQuery: query,
    pageSize: Math.min(maxResults, 20),  // max 20 por pagina na API nova
    languageCode: "pt-BR",
    regionCode: "BR",
  }, fieldMask);

  return (data.places || []).map((p) => ({
    place_id: p.id,
    nome: p.displayName?.text || "sem nome",
    endereco: p.formattedAddress || "",
    telefone: p.internationalPhoneNumber || p.nationalPhoneNumber,
    website: p.websiteUri,
    rating: p.rating,
    reviews_count: p.userRatingCount,
    categoria: p.types?.[0],
    latitude: p.location?.latitude,
    longitude: p.location?.longitude,
    google_maps_url: p.googleMapsUri,
  }));
}

/** Normaliza telefone BR pra formato wa.me (55 + DDD + numero). */
export function phoneToWhatsApp(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55")) return digits;
  if (digits.length >= 10) return `55${digits}`;
  return null;
}
