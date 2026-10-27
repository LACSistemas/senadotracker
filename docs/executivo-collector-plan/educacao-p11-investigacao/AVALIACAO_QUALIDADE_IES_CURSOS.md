# Qualidade de IES e cursos

## Fontes e unidades

| Indicador | Unidade | Janela | Regra |
|---|---|---|---|
| IGC | IES | triênio | não interpretar como nota anual isolada |
| CPC | curso | ciclo Enade | combina desempenho, valor agregado e insumos |
| Conceito Enade | curso | ciclo | resultado do exame |
| IDD | curso | ciclo | diferença entre observado e esperado |
| Fluxo/trajetória | coorte/curso/IES | coorte | não é ranking de qualidade |

O INEP publica indicadores em escala contínua e níveis, com ciclos de três anos. O Censo Superior e os indicadores são fontes complementares: não substituir um pelo outro nem calcular IGC a partir do Censo sem a metodologia oficial.

## Publicação segura

- mostrar valor, ano/ciclo, unidade, fonte e cobertura;
- separar ausência de conceito de conceito baixo;
- não ordenar instituições nacionalmente por indicador sem denominador e elegibilidade;
- manter cursos sem avaliação como NOT_EVALUATED, não zero;
- ligar curso ao CO_CURSO/e-MEC somente por chave oficial validada.

## Próxima validação

P11.3 deve baixar planilhas oficiais de CPC/IGC/Enade/IDD em D:, medir cobertura por curso e reconciliar a chave com o Censo 2024 e e-MEC.

