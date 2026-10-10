const r=await fetch('https://portalelegis.alesc.sc.gov.br/proposicoes/processo-legislativo?ano=2026&page=1'); const b=await r.text();
for(const term of ['per_page','limit','items','pagina','quantidade','porPagina','pageSize','select']){const i=b.toLowerCase().indexOf(term.toLowerCase()); if(i>=0) console.log(term,b.slice(Math.max(0,i-500),i+1000));}
