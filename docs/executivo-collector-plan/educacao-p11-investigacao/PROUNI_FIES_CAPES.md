# ProUni, FIES e CAPES

## ProUni

O portal de dados abertos do MEC lista arquivos anuais de 2017–2026 com bolsas concedidas e perfil agregado por região, UF, município, IES, curso, modalidade, turno e tipo. A camada canônica deve guardar bolsa integral/parcial, concessão e ano, sem expor CPF ou atributos individuais. O arquivo histórico menciona perfil do beneficiário; qualquer célula pequena deve ser suprimida.

## FIES

O MEC disponibiliza ofertas, inscrições e relatórios de resultados de processos seletivos principalmente entre 2019 e 2022. O dicionário define ano, semestre, grupo de preferência, classificação e situação. “Vaga ofertada”, “inscrição”, “pré-seleção”, “contrato” e “desembolso” são fatos distintos; o dataset aberto não autoriza afirmar o último sem fonte financeira adicional.

## CAPES/Sucupira

Sucupira cobre programas stricto sensu, áreas, modalidade acadêmica/profissional, conceito e situação de reconhecimento. O portal de dados abertos CAPES mantém conjuntos de programas, produção e concessão de bolsas. Lato sensu não é avaliado pela CAPES da mesma forma; não misturar os universos.

## Chaves e território

Usar código oficial do programa/IES e crosswalk para CO_IES quando comprovado. Município de um programa não deve ser inferido do nome da universidade. Produção, docentes e bolsas têm cobertura e anonimização próprias.

