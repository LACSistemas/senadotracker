'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GraduationCap, HeartPulse, Route, ShieldAlert, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// Ícones resolvidos aqui dentro (componente client) e nunca passados como prop de um Server Component:
// referências de componente não são serializáveis através da fronteira server→client do React; só a
// chave (string) atravessa, o componente real é resolvido já no bundle do cliente.
const ICONS = { saude: HeartPulse, educacao: GraduationCap, seguranca: ShieldAlert, assistencia: Users, infraestrutura: Route } as const;

export interface FederativeArea {
  key: string; label: string; icon: keyof typeof ICONS; question: string;
  uniao: string; estados: string; municipios: string; shared: string; href: string;
}

/** "Quem cuida de quê" deixa de ser 3 cartões estáticos e vira uma pergunta por área de política pública
 * (mandato E7-B): escolher uma área troca o conteúdo abaixo, sem nova consulta — todo o texto institucional
 * já vem pronto do servidor (§12.2 do mandato permite texto validado quando não há base estruturada de
 * competências; nenhuma competência é inventada aqui, cada uma reflete CF/88 e as leis setoriais citadas
 * nos documentos de fase). Mesmo padrão de troca local já usado em `LegislativeHouseToggle`. */
export function FederativeExplorer({ areas }: { areas: FederativeArea[] }) {
  const [active, setActive] = useState(areas[0]?.key ?? '');
  const current = areas.find(a => a.key === active) ?? areas[0];
  if (!current) return null;
  const Icon = ICONS[current.icon];
  return (
    <div>
      <div role="group" aria-label="Área de política pública" className="flex flex-wrap gap-2">
        {areas.map(a => { const AreaIcon = ICONS[a.icon]; return (
          <button key={a.key} type="button" onClick={() => setActive(a.key)} aria-pressed={active === a.key}
            className={cn('focus-ring flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold', active === a.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')}>
            <AreaIcon size={16} aria-hidden /> {a.label}
          </button>
        ); })}
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border">
        <div className="flex items-start gap-3 border-b bg-muted/40 px-6 py-4">
          <Icon size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <p className="text-lg font-black leading-snug">{current.question}</p>
        </div>
        <div className="flex flex-col divide-y sm:flex-row sm:divide-x sm:divide-y-0">
          <div className="flex-1 bg-card p-6"><h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">União</h3><p className="mt-2 text-sm leading-6">{current.uniao}</p></div>
          <div className="flex-1 bg-background p-6"><h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">Estados</h3><p className="mt-2 text-sm leading-6">{current.estados}</p></div>
          <div className="flex-1 bg-card p-6"><h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">Municípios</h3><p className="mt-2 text-sm leading-6">{current.municipios}</p></div>
        </div>
        <div className="border-t bg-muted/40 px-6 py-4">
          <h3 className="text-xs font-black uppercase tracking-wide text-primary">Competências compartilhadas</h3>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{current.shared}</p>
        </div>
      </div>
      <Link href={current.href} className="focus-ring mt-5 inline-flex items-center gap-1 text-sm font-bold text-primary underline">Investigar {current.label} em profundidade →</Link>
    </div>
  );
}
