#!/bin/bash
# P10.1 — para cada edição 2007–2025: copia só a planilha xlsx da Sinopse (Range) para o staging no D:, extrai a tabela de estabelecimentos e apaga a planilha.
# Uso: bash sinopse_batch.sh <ano> [<ano> ...]      (executar a partir da raiz do repositório)
set -u
S=D:/Civica/staging/educacao/sinopse
E=docs/executivo-collector-plan/educacao-p101-execucao/evidencias/sinopse
R=docs/executivo-collector-plan/educacao-p101-execucao/reproducibilidade
B=https://download.inep.gov.br
mkdir -p "/d/Civica/staging/educacao/sinopse" "$E"
for y in "$@"; do
  if [ "$y" -ge 2023 ]; then u="$B/dados_abertos/sinopses_estatisticas/sinopse_estatistica_censo_escolar_$y.zip"
  elif [ "$y" -ge 2020 ]; then u="$B/dados_abertos/sinopses_estatisticas/sinopses_estatisticas_censo_escolar_$y.zip"
  elif [ "$y" -eq 2019 ]; then u="$B/informacoes_estatisticas/sinopses_estatisticas/sinopses_educacao_basica/sinopse_estatistica_educacao_basica_2019.zip"
  else u="$B/informacoes_estatisticas/sinopses_estatisticas/sinopses_educacao_basica/sinopse_estatistica_da_educacao_basica_$y.zip"; fi
  echo "== $y $u"
  if [ -f "$E/estab_$y.json" ]; then echo "   já extraído"; continue; fi
  python -I -X utf8 scripts/exec/inep_member_fetch.py "$u" "$S/$y" '/Sinopse[^/]*\.xlsx$' > "$E/fetch_$y.json" || { echo "   falha no download $y"; continue; }
  f=$(python -I -X utf8 -c "import json;print(json.load(open('$E/fetch_$y.json',encoding='utf-8'))['members'][0]['file'])")
  python -I -X utf8 $R/sinopse_estab.py "$f" "$E/estab_$y.json" || echo "   falha na extração $y"
  rm -f "$f"
done
