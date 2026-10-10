import { readFileSync, writeFileSync } from 'node:fs';
const path='artifacts/P20_1_source_map.json';
const j=JSON.parse(readFileSync(path,'utf8'));
j.phase='P20.2'; j.generatedAt=new Date().toISOString();
j.providers.MG={provider:'almg_open_data',mode:'official 2026 bulk CSV',resources:['https://dadosabertos.almg.gov.br/arquivo/proposicoes/download?ano=2026&tipo=CSV'],status:'OPERATIONALLY_PROVEN'};
j.providers.SC={provider:'alesc_elegis',mode:'official e-Legis HTML complete pagination',resources:['https://portalelegis.alesc.sc.gov.br/proposicoes/processo-legislativo?ano=2026&page=1'],status:'OPERATIONALLY_PROVEN'};
j.providers.PE={provider:'alepe_open_data',mode:'official XML APIs, legislatura 20 filtered to 2026',resources:['https://dadosabertos.alepe.pe.gov.br/api/v1/proposicoes/projetos/?legislatura=20','https://dadosabertos.alepe.pe.gov.br/api/v1/proposicoes/indicacoes/?legislatura=20','https://dadosabertos.alepe.pe.gov.br/api/v1/proposicoes/requerimentos/?legislatura=20'],status:'OPERATIONALLY_PROVEN'};
for(const x of j.historicalAvailability??[]){if(['MG','SC','PE','SP'].includes(x.house)){x.earliest_known_year=x.house==='SP'?1947:2026;x.latest_known_year=2026;x.acquisition_model='active official revision'}}
writeFileSync('artifacts/P20_2_source_map.json',JSON.stringify(j,null,2));
