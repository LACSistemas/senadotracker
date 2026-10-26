#!/bin/bash
# P10.3 — para cada edição: copia só a planilha xlsx da Sinopse (Range) para o staging no D:, extrai as tabelas 2.1 (docentes por etapa) e 2.2 (docentes por localização e dependência) e apaga a planilha.
# Uso: bash sinopse_docentes_batch.sh <ano> [<ano> ...]      (a partir da raiz do repositório)
set -u
S=D:/Civica/staging/educacao/sinopse3
E=docs/executivo-collector-plan/educacao-p103-execucao/evidencias/sinopse
R=docs/executivo-collector-plan/educacao-p102-execucao/reproducibilidade
B=https://download.inep.gov.br
mkdir -p "/d/Civica/staging/educacao/sinopse3" "$E"
for y in "$@"; do
  if [ "$y" -ge 2023 ]; then u="$B/dados_abertos/sinopses_estatisticas/sinopse_estatistica_censo_escolar_$y.zip"
  elif [ "$y" -ge 2020 ]; then u="$B/dados_abertos/sinopses_estatisticas/sinopses_estatisticas_censo_escolar_$y.zip"
  elif [ "$y" -eq 2019 ]; then u="$B/informacoes_estatisticas/sinopses_estatisticas/sinopses_educacao_basica/sinopse_estatistica_educacao_basica_2019.zip"
  else u="$B/informacoes_estatisticas/sinopses_estatisticas/sinopses_educacao_basica/sinopse_estatistica_da_educacao_basica_$y.zip"; fi
  echo "== $y"
  if [ -f "$E/t22_$y.json" ]; then echo "   já extraído"; continue; fi
  python -I -X utf8 scripts/exec/inep_member_fetch.py "$u" "$S/$y" '/Sinopse[^/]*\.xlsx$' > "$E/fetch_doc_$y.json" || { echo "   falha no download $y"; continue; }
  f=$(python -I -X utf8 -c "import json;print(json.load(open('$E/fetch_doc_$y.json',encoding='utf-8'))['members'][0]['file'])")
  python -I -X utf8 $R/sinopse_tabela.py "$f" 'N.mero de Docentes da Educa..o B.sica, por Etapa de Ensino' "$E/t21_$y.json"
  python -I -X utf8 $R/sinopse_tabela.py "$f" 'N.mero de Docentes da Educa..o B.sica, por Localiza..o' "$E/t22_$y.json"
  rm -f "$f"
done
