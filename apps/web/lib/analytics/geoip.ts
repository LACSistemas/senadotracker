import { open, type CityResponse, type Reader } from 'maxmind';
import { join } from 'node:path';

let readerPromise: Promise<Reader<CityResponse> | null> | null = null;

function loadReader(): Promise<Reader<CityResponse> | null> {
  if (!readerPromise) {
    const path = join(process.cwd(), '..', '..', 'geoip', 'GeoLite2-City.mmdb');
    readerPromise = open<CityResponse>(path).catch(() => null);
  }
  return readerPromise;
}

export interface GeoLocation { country: string | null; uf: string | null; city: string | null }

const NO_LOCATION: GeoLocation = { country: null, uf: null, city: null };

/** Resolve país/UF/cidade a partir do IP do visitante. Nunca lança: se o banco GeoLite2 ainda não foi
 * baixado (`npm run geoip:update`) ou o IP não resolve, devolve tudo null silenciosamente. */
export async function lookupGeo(ip: string | null): Promise<GeoLocation> {
  if (!ip) return NO_LOCATION;
  const reader = await loadReader();
  if (!reader) return NO_LOCATION;
  try {
    const result = reader.get(ip);
    const country = result?.country?.iso_code ?? null;
    const subdivisionCode = result?.subdivisions?.[0]?.iso_code ?? null;
    const uf = country === 'BR' && subdivisionCode ? subdivisionCode.replace(/^BR-/, '') : null;
    const city = result?.city?.names?.['pt-BR'] ?? result?.city?.names?.en ?? null;
    return { country, uf, city };
  } catch {
    return NO_LOCATION;
  }
}

/** `x-forwarded-for` pode trazer uma cadeia "cliente, proxy1, proxy2"; o primeiro IP é o do visitante. */
export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return headers.get('x-real-ip');
}
