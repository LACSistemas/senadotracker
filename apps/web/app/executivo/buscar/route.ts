import { NextResponse, type NextRequest } from 'next/server';
import { isUf, loadStates } from '@/lib/exec-territory';

function stripAccents(s: string) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }

/** Resolve "estado ou município" com um único redirect HTTP — sem índice de busca novo, sem JS de
 * cliente. UF por sigla ou nome vai para `/estados/{uf}`; qualquer outro termo vai para a busca de
 * município já existente e madura em `/municipios?q=`. */
export async function GET(request: NextRequest) {
  const term = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!term) return NextResponse.redirect(new URL('/executivo', request.url));
  if (isUf(term)) return NextResponse.redirect(new URL(`/estados/${term.toUpperCase()}`, request.url));
  const normalized = stripAccents(term.toLowerCase());
  const states = await loadStates();
  const match = states.find(s => stripAccents(s.name.toLowerCase()) === normalized);
  if (match) return NextResponse.redirect(new URL(`/estados/${match.uf}`, request.url));
  return NextResponse.redirect(new URL(`/municipios?q=${encodeURIComponent(term)}`, request.url));
}
