# Contrato de privacidade da Educação · G14

Estado: **PASS** (a política está definida e medida; a implementação é da P10.1+) · Provas: `censo_privacidade_celulas_pequenas.json`, `censo_escolar_headers.json`, `siope_prova.json` (esquema), `contratos_fnde_programas.md`, `pncp_educacao_amostras*.json`.

## 1. Regra prioritária
**O Cívica não cria base individualizada de estudantes, professores ou gestores.** Todo dado persistido é agregado por escola, rede, município, UF ou instituição, ou é registro institucional (escola, IES, órgão, CNPJ de pessoa jurídica).

## 2. O que a fonte aberta realmente é
| Fonte | Nível público | Individual? |
|---|---|---|
| Censo Escolar 2007–2025 | **agregado por escola** (`QT_*`) | não |
| Censo da Educação Superior | agregado por IES/oferta de curso | não |
| Ideb, Saeb (resultados), INEP Indicadores | escola/município/UF/Brasil | não |
| **Microdados do Saeb** | estudante (anonimizado) | **sim → não ingerir** |
| SIOPE `Remuneracao_Siope` | profissional (nome, escola, salário) | **sim → proibido** |
| SIOPE `Dados_Gerais_..._Dados_Responsaveis` | agente (nome, e-mail, telefone, CNPJ) | **sim → proibido** |
| PDDE Info | escola/UEx; planilha "Contas UEx e EM" com **agência e conta** | dados bancários → não persistir |
| PNCP | contrato (fornecedor PJ ou **PF com CPF**; objeto com nomes de pessoas) | parcial |
| Obrasgov | obra (sem pessoas) | não |

## 3. Risco de reidentificação **medido** (Censo Escolar, arquivos oficiais)
- **`Tabela_Gestor_Escolar` 2025:** 180.540 escolas; **172.173 (95,4%) têm exatamente 1 gestor**, 6.633 têm 2, 1.734 têm 3. As 88 colunas (sexo, cor/raça, faixa etária, escolaridade, vínculo, forma de acesso ao cargo, deficiência, nacionalidade) são, na prática, **atributos de uma pessoa nomeável** (o diretor é público). **Decisão: a tabela de gestor não é ingerida na P10.**
- **Matrícula 2024:** 179.286 escolas com matrícula; **3.395 têm menos de 10 matrículas** e **571 menos de 5**. Células sensíveis pequenas (valor de 1 a 4): cor preta 55.470 (41% das escolas com algum aluno preto), indígena 25.684 (77%), amarela 47.861 (85%), educação especial 52.401 (36%), até 3 anos 11.013, feminino 3.980. Sexo/cor/idade/deficiência × escola identificam crianças em escola pequena.
- **Docentes:** 25.285 escolas (14,1%) têm 1 a 3 docentes: combinações de sexo/cor/idade/escolaridade/vínculo/deficiência podem apontar um professor.
- **Cadastro 2023–2024** traz endereço, bairro, CEP, DDD e telefone da escola; **2025 removeu** essas colunas (RIP do próprio INEP). Escola é pessoa jurídica pública/privada, mas telefone de escola privada pode ser pessoal.

## 4. Regras de persistência (whitelist)
1. **Escola:** código INEP, município (IBGE7), UF, dependência, rede, localização, situação, etapas ofertadas, matrícula/turma/docente **totais** e por **etapa**, infraestrutura (`IN_*`/`QT_*` não pessoais), nome da escola (da edição). **Não persistir:** endereço, número, complemento, bairro, CEP, DDD, telefone, e-mail, CNPJ de mantenedora de escola privada como atributo de pessoa (CNPJ é PJ; ok como identificador institucional se publicado pela fonte; revisar na P10.1).
2. **Não ingerir:** `Tabela_Gestor_Escolar`; qualquer coluna `*_FEM/_MASC/_BRANCA/_PRETA/_PARDA/_AMARELA/_INDIGENA/_ND/_PCD/_NACIO_*/_0_3…_60_MAIS` **no nível escola**; `QT_MAT_ESP` e variáveis de deficiência/AEE no nível escola; aluno/professor/gestor individual de qualquer fonte; microdados Saeb; `Remuneracao_Siope`; dados de responsáveis do SIOPE.
3. **Atributos sensíveis só agregados** em município/UF/Brasil e **apenas quando o valor ≥ 10**; abaixo disso a célula é **suprimida (NULL com flag `suprimida`)**, e a supressão complementar impede reconstituir a célula por subtração (se um total e todas as partes menos uma forem publicados, suprimir também a menor parte seguinte). Escola nunca recebe esses recortes.
4. **PNCP:** fornecedor só **PJ** (CPF/PF é descartado e o campo fica nulo); **o texto do objeto não é publicado** (há nomes de professores/pessoas no objeto, medidos nas amostras); persistir só códigos de classe, valor, datas, CNPJ do órgão, CNPJ do fornecedor PJ.
5. **PDDE Info:** persistir INEP, UEx (CNPJ de pessoa jurídica), programa, previsto/devido/pago, data; **descartar** banco/agência/conta; descartar nomes de dirigentes da UEx se aparecerem.
6. **Obras:** sem restrição de pessoas; endereço da obra só como município (endereço/CEP ausentes em 69% e dispensáveis).
7. **Logs e manifestos** não guardam linhas de dados individuais.
8. **Acesso restrito:** bases só disponíveis mediante autorização (ex.: microdados de aluno por SEDAP/INEP `servico-de-acesso-a-dados-protegidos-sedap`, citado na página do Ideb) **não são fontes abertas** e não entram.

## 5. Pequenas células em recortes `escola × ano × etapa × modalidade × característica`
- **Totais por etapa** (`QT_MAT_INF_CRE`, `…_FUND_AI`…): publicáveis por escola (não são características sensíveis).
- **Modalidade EJA/Profissional/Especial:** EJA e Profissional (oferta) publicáveis como totais; **Especial** (`QT_MAT_ESP`, `IN_ESPECIAL_EXCLUSIVA`) ao nível escola: só o indicador de **oferta** (a escola tem ou não classe especial); contagens ficam para município/UF com n ≥ 10.
- **Característica sensível:** só município/UF/Brasil, n ≥ 10, com supressão complementar.
- Escolas com < 5 matrículas: mostrar total com marca "escola muito pequena" e nenhuma abertura.

## 6. Testes obrigatórios (P10.1+)
- Teste de esquema: nenhuma coluna da lista proibida existe nas tabelas `exec_edu_*` (análogo ao teste de privacidade da P9.7).
- Teste de supressão: nenhuma célula 1–4 aparece em escola × característica; soma de partes ≠ total apenas quando a diferença é exatamente a parte suprimida.
- Teste de PNCP: nenhum CPF (11 dígitos) e nenhum `objeto` na tabela publicada.
- Teste de log: o log de mudanças não contém colunas banidas.

## 7. Limitações
- Não foi lida a RIP/Parecer da PFE do INEP (PDF no ZIP de 2025); a política acima é conservadora e deve ser conferida com ela na P10.1.
- A medição de células pequenas usa o Censo 2024 (CSV único); 2025 (tabelas separadas) deve repetir.
