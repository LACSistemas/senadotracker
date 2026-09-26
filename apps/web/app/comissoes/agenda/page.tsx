import Link from 'next/link';


import { commissionAgenda } from '@/lib/data';


import { Button } from '@/components/ui/button';


import { AgendaItems } from '@/components/agenda-items';


export const dynamic = 'force-dynamic';


type Q = Record<string, string | string[] | undefined>;


const one=(v:string|string[]|undefined)=>typeof v==='string'?v:undefined;


const day=(v:string)=>v.slice(0,10);


const fmtDay=(v:string)=>new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${day(v)}T12:00:00Z`));


const fmtTime=(v:string|null)=>v&&v.length>10?new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date(v)):'Horário não informado';


const fmtShort=(v:string)=>new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(`${day(v)}T12:00:00Z`));


function houseLabel(m:any){const b=m.bodies??[];if(b.some((x:any)=>String(x.house).toUpperCase()==='CONGRESSO')||/^CM/i.test(String(m.title||'')))return 'Congresso Nacional';if(b.some((x:any)=>String(x.house).toUpperCase()==='CAMARA'))return 'Câmara dos Deputados';if(b.some((x:any)=>String(x.house).toUpperCase()==='SENADO'))return 'Senado Federal';return m.source==='camara'?'Câmara dos Deputados':'Senado Federal'}


function meetingHeading(m:any){const title=String(m.title||'').trim(),description=String(m.description||'').trim();if(!title)return description||'Tipo de reunião não informado';if(!description)return title;const suffix=description.includes('-')?description.split('-').slice(1).join('-').trim():'';if(suffix&& !title.toLocaleLowerCase('pt-BR').includes(suffix.toLocaleLowerCase('pt-BR')))return `${title} · ${suffix}`;return title}


function bodyTitle(m:any){const names=(m.bodies??[]).map((b:any)=>b.name||b.sigla).filter(Boolean);return names.length?names.join(' · '):m.title||m.meeting_type_raw||'Reunião de comissão'}


export default async function AgendaPage({searchParams}:{searchParams:Promise<Q>}){const q=await searchParams,today=new Date().toISOString().slice(0,10),from=one(q.from)||today,to=one(q.to)||from,house=one(q.house),body=one(q.body);const result=commissionAgenda({from,to,...(house==='senado'||house==='camara'?{source:house}:{}),...(body?{body}:{})});if(result.status==='unavailable')return <main className="page-shell py-12"><h1>Agenda das comissões</h1><p>{result.message}</p></main>;const rows=JSON.parse(JSON.stringify(result.data)) as any[],camara=rows.filter(r=>r.source==='camara').length,senado=rows.filter(r=>r.source==='senado').length,grouped=new Map<string,any[]>();for(const r of rows){const k=day(String(r.scheduled_date||r.scheduled_start_at||''))||'sem-data';grouped.set(k,[...(grouped.get(k)||[]),r])}const href=(x:Record<string,string>)=>{const p=new URLSearchParams({from,to,...(house?{house}:{}),...x});return `/comissoes/agenda?${p}`};const period=`${fmtShort(from)}${from!==to?` a ${fmtShort(to)}`:''}`;return <main id="conteudo" className="page-shell py-10"><header><p className="text-sm font-bold uppercase tracking-widest text-primary">Agenda legislativa</p><h1 className="mt-2 text-4xl font-black">Agenda das comissões</h1><p className="mt-3 max-w-2xl text-muted-foreground">Acompanhe as reuniões e as matérias pautadas nas comissões da Câmara e do Senado.</p></header><nav className="mt-8 flex flex-wrap gap-2" aria-label="Período"><Link className="rounded-xl border px-4 py-2 text-sm font-bold" href={href({from:today,to:today})}>Hoje</Link><Link className="rounded-xl border px-4 py-2 text-sm font-bold" href={href({from:new Date(Date.now()+86400000).toISOString().slice(0,10),to:new Date(Date.now()+86400000).toISOString().slice(0,10)})}>Amanhã</Link><Link className="rounded-xl border px-4 py-2 text-sm font-bold" href={href({from:today,to:new Date(Date.now()+6*86400000).toISOString().slice(0,10)})}>Esta semana</Link><Link className="rounded-xl border px-4 py-2 text-sm font-bold" href={href({from:today,to:new Date(Date.now()+29*86400000).toISOString().slice(0,10)})}>Próximos 30 dias</Link></nav><form className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-3"><label className="text-sm font-semibold">Casa<select name="house" defaultValue={house||''} className="mt-1 h-10 rounded-lg border bg-background px-2"><option value="">Todas</option><option value="senado">Senado</option><option value="camara">Câmara</option></select></label><label className="text-sm font-semibold">De<input name="from" type="date" defaultValue={from} className="mt-1 h-10 rounded-lg border bg-background px-2"/></label><label className="text-sm font-semibold">Até<input name="to" type="date" defaultValue={to} className="mt-1 h-10 rounded-lg border bg-background px-2"/></label><Button className="h-10">Aplicar</Button></form><p className="mt-5 text-sm text-muted-foreground">{rows.length?<><strong className="text-foreground">{rows.length} reuniões</strong> entre {period} · Câmara {camara} · Senado {senado}</>:'Nenhuma reunião oficial encontrada para este período.'}</p><div className="mt-8 space-y-12">{[...grouped].map(([d,meetings])=><section key={d}><h2 className="border-b pb-3 text-2xl font-black">{d==='sem-data'?'Data não informada':fmtDay(d)}</h2><div className="mt-4 space-y-5">{meetings.map(m=><article key={m.id} className="grid gap-4 border-b pb-6 md:grid-cols-[100px_1fr]"><div className="text-lg font-black text-primary">{fmtTime(m.scheduled_start_at)}</div><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-bold">{m.bodies?.[0]?.id?<Link className="hover:text-primary" href={`/comissoes/${m.bodies[0].externalId}`}>{bodyTitle(m)}</Link>:bodyTitle(m)}</h3><span className="rounded-full bg-secondary px-2 py-1 text-xs">{houseLabel(m)}</span></div><p className="mt-2 text-sm font-semibold text-foreground">{meetingHeading(m)}</p><p className="mt-1 text-sm text-muted-foreground">{m.location||'Local não informado'}</p>{m.changes?.length?<details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold">Pauta atualizada · {m.changes.length} alterações</summary><ul className="mt-2 space-y-1">{m.changes.map((c:any)=><li key={`${c.type}:${c.occurredAt}:${c.itemId||''}`}>{c.type==='agenda_item_removed'?'− Item retirado da pauta':c.type==='agenda_item_restored'?'+ Item restaurado na pauta':c.type==='agenda_item_reordered'?'Ordem da pauta alterada':c.type==='meeting_time_changed'?`Horário alterado · ${c.previousValue||'não informado'} → ${c.currentValue||'não informado'}`:c.type==='meeting_location_changed'?'Local alterado':c.type==='meeting_status_changed'?'Situação da reunião alterada':'Metadados da reunião atualizados'} · {new Date(c.occurredAt).toLocaleString('pt-BR')}</li>)}</ul></details>:null}<div className="mt-4"><p className="text-xs font-semibold text-muted-foreground">{m.item_count} {m.item_count===1?'item':'itens'} em pauta</p><AgendaItems items={m.items} source={m.source}/></div></div></article>)}</div></section>)}</div></main>}
