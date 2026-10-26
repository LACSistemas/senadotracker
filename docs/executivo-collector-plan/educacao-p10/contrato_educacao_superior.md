# Contrato da Educação Superior · G12

Estado: **PASS_WITH_CAVEATS** · Fase consumidora: P10.8 (independente de P10.1) · Provas: `censo_superior_listing.json`, `censo_superior_2024_headers.json`, `censo_superior_2023_identidade.json`, `censo_superior_tamanhos.json`, `inep_paginas_links.json`.

## 1. Fonte e histórico
- Página: `https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-da-educacao-superior`; arquivos `https://download.inep.gov.br/microdados/microdados_censo_da_educacao_superior_AAAA.zip`, **1995 a 2024 (30 edições, todas HTTP 200; 750 MB no total)**. Último ano: **2024** (457 MB).
- Sinopse Estatística da Educação Superior: 2024 e anteriores (33 links) em `…/sinopses-estatisticas/educacao-superior`.
- Formato 2023/2024: `MICRODADOS_ED_SUP_IES_AAAA.CSV` (uma linha por IES) e `MICRODADOS_CADASTRO_CURSOS_AAAA.CSV` (uma linha por oferta de curso), `;`, ISO-8859-1, dicionário XLSX. Em 2024 o CSV de cursos (453 MB) é **STORED** no ZIP (Range exato); em 2023 está comprimido (37 MB → 393 MB). Em 2010 há `MICRODADOS_CADASTRO_IES/CURSOS`.
- Colunas: IES 84 (2024), Cursos 223 (2024): `CO_IES`, `CO_CURSO`, `CO_MUNICIPIO`, `TP_REDE`, `TP_CATEGORIA_ADMINISTRATIVA`, `TP_ORGANIZACAO_ACADEMICA`, `TP_GRAU_ACADEMICO`, `TP_MODALIDADE_ENSINO`, `TP_NIVEL_ACADEMICO`, `CO_CINE_*`; medidas `QT_VG_*` (vagas), `QT_INSCRITO_*`, `QT_ING_*` (63), `QT_MAT_*` (52), `QT_CONC_*` (52), `QT_SIT_*`; docentes na IES (`QT_DOC_TOTAL`, `QT_DOC_EXE`… 31 colunas) e técnicos (`QT_TEC_*` 15). **Agregado por oferta/IES; sem aluno individual.**

## 2. Identidade
| Entidade | Chave | Medido |
|---|---|---|
| IES | `CO_IES` | 2023: **2.580 linhas = 2.580 códigos distintos** (único); `CO_MANTENEDORA` identifica a mantenedora |
| Curso (oferta) | `CO_IES` + `CO_CURSO` + `CO_MUNICIPIO` + `TP_MODALIDADE_ENSINO` (+…) | 2023: **671.610 linhas**, `CO_CURSO` com 46.317 valores distintos, **10.509 códigos repetidos** (o mesmo código aparece em vários municípios/modalidades); a chave `(IES, curso, município, modalidade)` dá 671.149 distintos de 671.610 (**461 linhas com par repetido**: há outra dimensão ainda não identificada) |
- **Linha do arquivo ≠ curso.** Contar linhas como "cursos" erra. `QT_CURSO` existe como coluna.
- Soma de matrículas 2023 (`QT_MAT`) = **9.977.217** (graduação).
- **Não reaproveitar a identidade de escola básica**: IES e curso têm códigos e ciclos próprios (e-MEC/INEP); município da IES (`CO_MUNICIPIO_IES`) é a sede, o do curso é o local de oferta. Tabelas separadas (ver `arquitetura_educacao_modelo_d.md`).

## 3. Medidas e regras
- Vagas, inscritos, ingressantes, matrículas, concluintes: contagens por oferta; modalidades (presencial/EaD) e recortes por sexo/cor/idade/deficiência são sensíveis e cruzados (G14).
- Aditividade: matrícula é **vínculo aluno-curso** (um aluno em dois cursos conta duas vezes). Σ cursos = IES = município vale para `QT_MAT` do mesmo ano **na mesma modalidade/nível** (a reconciliar com a Sinopse da Educação Superior).
- Docentes de IES são da IES, não do curso; não somar com docentes da educação básica.
- Município onde se oferta ≠ município da sede; EaD tem polos (município do polo pode ser o do curso).

## 4. Indicadores de qualidade e fluxo (INEP)
Páginas existem (`indicadores-de-qualidade-da-educacao-superior`, `…-fluxo-…`, `…-trajetoria-…`; CPC/IGC/Enade): **não avaliados nesta fase** (`NOT_EVALUATED`). Regra provisória: não misturar com os microdados do Censo.

## 5. Contrato do coletor (P10.8)
Descobrir links na página; `HEAD` + hash; RAW `D:\Civica\raw\inep\censo_superior\AAAA\`; para 2024 usar Range sobre a entrada CSV (453 MB) se necessário; leitura em fluxo; whitelist de colunas; publicar `exec_edu_ies` / `exec_edu_ies_year` / `exec_edu_course_offer_year`; reconciliar com a Sinopse. **Volume:** ZIPs 1995–2024 = 750 MB; descompactado do ano de 2023 = 393 MB (linhas de curso 672 mil).

## 6. Limitações
- Edições anteriores a 2009–2010 têm layouts distintos (não lidas).
- Chave de oferta com 461 duplicatas a esclarecer.
- CPC/IGC/Enade e e-MEC fora do escopo desta fase.
