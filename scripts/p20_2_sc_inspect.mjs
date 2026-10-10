const u='https://portalelegis.alesc.sc.gov.br/proposicoes/processo-legislativo?ano=2026&page=1'; const r=await fetch(u); const b=await r.text();
for(const re of [/page=\d+/g,/pagination[\s\S]{0,3000}/gi,/card-title[\s\S]{0,1200}/gi,/total[^<]{0,100}/gi]) console.log(re, [...b.matchAll(re)].slice(0,20).map(x=>x[0].slice(0,1200)));
