# Viabilidade do ENEM municipal

## Conclusão

É viável publicar estatística municipal de participantes e desempenho somente para a população e variáveis que o arquivo da edição efetivamente publicar. A página do INEP mantém os microdados do ENEM e os descreve como o menor nível de desagregação do exame, mas a política de privacidade determina supressão/anonimização de variáveis que permitam reidentificação.

### Três geografias que não podem ser confundidas

1. **Município de residência:** onde o participante declarou morar.
2. **Município da escola:** onde a escola frequentada está localizada, quando publicado.
3. **Município de aplicação:** onde fez a prova.

“Públicos de Vitória” deve significar uma destas populações explicitamente, nunca uma mistura.

## Vitória: respostas operacionais

| Pergunta | Resultado P11 |
|---|---|
| Quantos residentes de Vitória participaram? | Viável após validar campo municipal de residência e regra de presença. |
| Qual a média dos residentes? | Viável por área, com denominador de provas válidas e supressão de células pequenas. |
| Quantos estudavam em escola pública localizada em Vitória? | Não provado; requer município da escola + rede e não pode ser inferido do município de aplicação. |
| Qual escola individual teve melhor resultado? | Não publicar; ENEM por Escola foi descontinuado e o INEP não recomenda ranking escolar. |

## Regra de agregação proposta para P11.1

- participantes_confirmados: inscrição confirmada, presença conforme documentação da edição;
- presentes_area: somente presença válida na área;
- nota_media_area: média simples apenas entre notas não nulas e observações elegíveis;
- rede_publica: usar variável source-native, nunca inferir de nome da escola;
- min_cell_size: publicar SUPPRESSED abaixo de limiar aprovado juridicamente;
- guardar população-alvo, edição, filtro, denominador e cobertura junto do indicador.

## Limitações

- A edição 2025 não foi baixada integralmente nesta investigação.
- Não há prova atual de CO_MUNICIPIO_RESIDENCIA, CO_MUNICIPIO_ESC ou de todas as colunas de notas nas edições 2023–2025.
- Bases protegidas do INEP existem para pesquisa autorizada, mas não são fonte pública de produto.
- O código de escola não deve ser recuperado por cruzamento com Censo Escolar.

