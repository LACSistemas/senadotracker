const r=await fetch('https://dadosabertos.almg.gov.br/api/ajuda/swagger');const b=await r.text();for(const m of b.matchAll(/href="([^"]+)"[^>]*>([^<]+)<\/a>/gi))console.log(m[1],m[2].trim());
