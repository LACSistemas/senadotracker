# Plano P11.1–P11.N

## P11.1 — validação ENEM municipal

Baixar 2023–2025 em D:, verificar headers/dicionários, medir presença de residência, escola, rede, notas e presença; produzir cobertura por UF/município; não persistir participante.

## P11.2 — IES e cursos

Reusar contrato P10.8, esclarecer as 461 duplicatas da chave 2023, validar 2024 e reconciliar com Sinopse por município.

## P11.3 — qualidade

Baixar planilhas CPC/IGC/Enade/IDD, versionar ciclos e ligar cursos somente por chave oficial.

## P11.4 — ProUni/FIES

Coletar CSVs MEC, auditar dicionários, separar bolsa/oferta/inscrição/resultado e aplicar supressão.

## P11.5 — CAPES

Catalogar datasets CKAN, licença, anos, chaves e cobertura territorial; começar por programas e conceitos.

## P11.6 — finanças

Mapear SIAFI/Portal/PNCP para órgãos federais; testar um estado e uma universidade antes de propor nacionalização.

## P11.7 — read layer

Somente após reconciliação: séries municipais, IES/ofertas, qualidade e programas com contratos de cobertura.

## P11.8–P11.N

Testes de carga, materializações, frontend e scheduler ficam fora desta investigação e só podem começar após gates de fonte, identidade, privacidade e armazenamento.

## Critério de passagem

READY_FOR_P11_1 = NO até que os arquivos ENEM atuais sejam lidos em D:, seus campos sejam comprovados e a política de publicação municipal seja aprovada.

