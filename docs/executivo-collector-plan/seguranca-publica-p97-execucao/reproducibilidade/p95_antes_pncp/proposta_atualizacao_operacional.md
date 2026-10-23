# Proposta operacional de atualização — Finanças da Segurança (P9.5)

**Não há scheduler configurado nesta onda.** Esta é a proposta para autorização posterior; todos os comandos são idempotentes (mesmo RAW → `NO_CHANGE`) e retomáveis.

| Fonte | Publicação na origem | Cadência proposta | Comando | Observação |
|---|---|---|---|---|
| Siconfi DCA I-E / I-G | anual (abril do ano seguinte; retificações a qualquer tempo) | mensal, de abril a dezembro; exercício anterior + dois anteriores (retificações) | `financas-fetch.ts dca-ie <ano-2>-<ano-1> all` + `financas-pilot.ts publish dca …` | pacotes fechados já coletados são reutilizados por hash; retificação muda o pacote da UF e republica só aquela fatia |
| Siconfi RREO 02 | bimestral (30 dias após o bimestre) | a cada bimestre, no dia 1º do 2º mês seguinte | `financas-fetch.ts rreo02 <ano> all` | o coletor escolhe sozinho o último bimestre vencido; ano corrente é preliminar |
| Portal da Transparência (execução mensal, orçamento) | mensal | dia 5 de cada mês | `financas-fed.ts fetch <ano> <ano>` + `publish` | mês corrente é parcial e se atualiza por hash; downloads espaçados (o WAF bloqueia o IP após dezenas de arquivos) |
| PNCP contratos | contínua | semanal para o mês corrente e o anterior; trimestral para o ano corrente inteiro (retificações) | `pncp-fetch.ts <ano> <ano>` + `contratos-pilot.ts pncp <ano>` | mês fechado é reutilizado; mês corrente e anterior são sempre refeitos |
| Transferegov (MJSP) | diária | mensal | `contratos-pilot.ts transfers` | arquivo cumulativo; mudança de situação/valor republica as fatias afetadas |
| TCE-RS | anual (remessas durante o ano) | mensal | `financas-rs.ts publish <ano-1> <ano>` | o exercício é o da data da operação: remessa tardia de um ano cai no ano certo, então os dois anos anteriores são republicados |
| TCE-PE | contínua | mensal | `financas-pe.ts publish <ano-1> <ano>` | ano corrente: um instantâneo por dia |

## Salvaguardas obrigatórias antes de cada rodada

1. `assertVolume` (GUID do SSD) e `assertPgHeadroom` (≥ 20 GiB livres no C:) já abortam sem gravar.
2. `pg_dump -n civica_exec` antes de rodadas que republiquem mais de um exercício (o log de mudanças NÃO sofre retenção destrutiva nesta onda; a política de retenção do `exec_change_log` precisa de decisão própria).
3. Fingerprints de Saúde e P9.1–P9.4 (`prisional-g0.ts`) antes e depois: devem ser idênticos.
4. Falhas de uma fonte não bloqueiam as demais (cada comando é independente).

## O que o scheduler NÃO deve fazer

Não rodar duas coletas do mesmo host em paralelo sem o limitador (Siconfi: 429; Portal: bloqueio 405), não apagar RAW, não deflacionar valores, não fundir fontes.
