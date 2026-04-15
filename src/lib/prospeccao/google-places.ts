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
export async function searchPlaces(query: string, maxResults = 50, regionCode = "BR", languageCode = "pt-BR"): Promise<PlaceResult[]> {
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
    pageSize: Math.min(maxResults, 20),
    languageCode,
    regionCode,
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

/** Normaliza telefone pra formato wa.me (country code + numero). */
export function phoneToWhatsApp(phone?: string, country = "BR"): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const cc = country === "US" ? "1" : "55";
  if (digits.startsWith(cc)) return digits;
  // numero ja vem com +55/+1 do Google (internationalPhoneNumber) entao raramente entra aqui
  if (digits.length >= 10) return `${cc}${digits}`;
  return null;
}
