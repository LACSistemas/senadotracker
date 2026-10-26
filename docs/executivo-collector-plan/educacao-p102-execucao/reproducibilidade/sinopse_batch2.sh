#!/bin/bash
# P10.2 — para cada edição: copia só a planilha xlsx da Sinopse (Range) para o staging no D:, extrai as tabelas 1.1/1.2 (matrículas) e 4.1/4.2 (turmas) e apaga a planilha.
# Uso: bash sinopse_batch2.sh <ano> [<ano> ...]      (executar a partir da raiz do repositório)
set -u
S=D:/Civica/staging/educacao/sinopse2
E=docs/executivo-collector-plan/educacao-p102-execucao/evidencias/sinopse
R=docs/executivo-collector-plan/educacao-p102-execucao/reproducibilidade
B=https://download.inep.gov.br
mkdir -p "/d/Civica/staging/educacao/sinopse2" "$E"
for y in "$@"; do
  if [ "$y" -ge 2023 ]; then u="$B/dados_abertos/sinopses_estatisticas/sinopse_estatistica_censo_escolar_$y.zip"
  elif [ "$y" -ge 2020 ]; then u="$B/dados_abertos/sinopses_estatisticas/sinopses_estatisticas_censo_escolar_$y.zip"
  elif [ "$y" -eq 2019 ]; then u="$B/informacoes_estatisticas/sinopses_estatisticas/sinopses_educacao_basica/sinopse_estatistica_educacao_basica_2019.zip"
  else u="$B/informacoes_estatisticas/sinopses_estatisticas/sinopses_educacao_basica/sinopse_estatistica_da_educacao_basica_$y.zip"; fi
  echo "== $y"
  if [ -f "$E/t42_$y.json" ]; then echo "   já extraído"; continue; fi
  python -I -X utf8 scripts/exec/inep_member_fetch.py "$u" "$S/$y" '/Sinopse[^/]*\.xlsx$' > "$E/fetch2_$y.json" || { echo "   falha no download $y"; continue; }
  f=$(python -I -X utf8 -c "import json;print(json.load(open('$E/fetch2_$y.json',encoding='utf-8'))['members'][0]['file'])")
  python -I -X utf8 $R/sinopse_tabela.py "$f" 'Matr.culas da Educa..o B.sica, por Etapa de Ensino' "$E/t11_$y.json"
  python -I -X utf8 $R/sinopse_tabela.py "$f" 'Matr.culas da Educa..o B.sica, por Localiza..o' "$E/t12_$y.json"
  python -I -X utf8 $R/sinopse_tabela.py "$f" 'Turmas da Educa..o B.sica, por Etapa de Ensino' "$E/t41_$y.json"
  python -I -X utf8 $R/sinopse_tabela.py "$f" 'Turmas da Educa..o B.sica, por Localiza..o' "$E/t42_$y.json"
  rm -f "$f"
done
