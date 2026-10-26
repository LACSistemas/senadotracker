#!/bin/bash
# P10.2 — publicação em PRODUÇÃO (banco do .env), uma edição por vez, com medição de armazenamento antes e depois de cada uma e replay final.
# Pré-requisitos já cumpridos: backup + restauração isolada, piloto e backfill completos em cluster isolado, reconciliação sem divergência.
# Uso (a partir da raiz do repositório): bash docs/executivo-collector-plan/educacao-p102-execucao/reproducibilidade/p102_producao.sh
set -u
unset EXEC_DATABASE_URL EDU_WAL_DIR
T="npx tsx scripts/exec/educacao-pilot.ts"
$T migrate 2>&1 | grep applied
$T fetch 2025 2>&1 | grep -E '"member"|Error' | cut -c1-160
$T register-docs 2>&1 | grep -c '"doc"'
$T measure p102-prod-antes >/dev/null 2>&1
for y in 2025 2024 2023 2022 2021 2020 2019 2018 2017 2016 2015 2014 2013 2012 2011 2010 2009 2008 2007; do
  $T measure p102-pre-$y >/dev/null 2>&1
  $T oferta-publish $y 2>&1 | grep -E "\"year\":$y,\"rowsIn\"|Error|FAILED"
  $T measure p102-pos-$y >/dev/null 2>&1
done
echo "== replay de todas as edicoes"
$T oferta-publish all 2>&1 | grep -E '^\{"year"' | cut -c1-300
$T measure p102-prod-depois >/dev/null 2>&1
echo FIM
