const u='https://dadosabertos.almg.gov.br/ws/ajuda/api/proposicoes?formato=swagger';const r=await fetch(u);const b=await r.text();console.log(r.status,r.headers.get('content-type'),b.slice(0,1000));
