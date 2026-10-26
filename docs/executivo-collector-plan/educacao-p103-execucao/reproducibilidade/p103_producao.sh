#!/bin/bash
# P10.3 — publicação em PRODUÇÃO (banco do .env), uma edição por vez, com medição de armazenamento antes e depois, e replay final.
# Pré-requisitos já cumpridos: backup + restauração isolada, piloto e backfill completos no cluster isolado, reconciliação sem divergência, RAW dos indicadores baixado e conferido (CRC).
# Uso (a partir da raiz do repositório): bash docs/executivo-collector-plan/educacao-p103-execucao/reproducibilidade/p103_producao.sh
set -u
unset EXEC_DATABASE_URL EDU_WAL_DIR
T="npx tsx scripts/exec/educacao-pilot.ts"
$T migrate 2>&1 | grep applied
$T ind-register 2>&1 | grep -E '^\{"registered"'
$T doc-prepare all 2>&1 | grep -E '^\{"prepared"'
$T measure p103-prod-antes >/dev/null 2>&1
echo "== infraestrutura"
for y in 2025 2024 2023 2022 2021 2020 2019 2018 2017 2016 2015 2014 2013 2012 2011 2010 2009 2008 2007; do
  $T measure p103-infra-pre-$y >/dev/null 2>&1
  $T infra-publish $y 2>&1 | grep -E '^\{"year"|FAILED|rror' | cut -c1-300
  $T measure p103-infra-pos-$y >/dev/null 2>&1
done
echo "== indicadores oficiais"
for y in 2025 2024 2023 2022 2021 2020 2019 2018 2017 2016 2015 2014 2013 2012 2011 2010 2009 2008 2007; do
  $T ind-publish $y 2>&1 | grep -E '^\{"year"|FAILED|rror' | cut -c1-300
  $T measure p103-ind-pos-$y >/dev/null 2>&1
done
echo "== docentes oficiais"
for y in 2025 2024 2023 2022 2021 2020 2019 2018 2017 2016 2015 2014 2013 2012 2011 2010 2009 2008 2007; do
  $T doc-publish $y 2>&1 | grep -E '"doc":"year"|FAILED|rror' | cut -c1-300
done
$T measure p103-prod-depois-carga >/dev/null 2>&1
echo "== replay de todas as edicoes"
$T infra-publish all 2>&1 | grep -E '^\{"year"' | cut -c1-260
$T ind-publish all 2>&1 | grep -E '^\{"year"' | cut -c1-260
$T doc-publish all 2>&1 | grep -E '"doc":"year"' | cut -c1-260
$T measure p103-prod-depois >/dev/null 2>&1
echo FIM
