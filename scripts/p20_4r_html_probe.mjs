const b=await (await fetch('https://sapl.al.ro.leg.br/sessao/1650/presenca')).text();
for(const term of ['presenca_ativos','id="parlamentar"','name="parlamentar"']){const i=b.indexOf(term);console.log(term,i,i>=0?b.slice(Math.max(0,i-1000),i+2500):'')}
