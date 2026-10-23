# Validação visual (P9.8)

Método: servidor Next **de produção isolado** (cópia em `C:\Projetos\build_p98`, porta 3102, banco publicado em leitura), Chrome real via Playwright, capturas em `capturas/` (desktop 1440 e mobile 390 de 17 territórios; seções de 8 territórios; estados de dado e interações). O servidor do usuário (porta 3000) e o `.next` do repositório não foram tocados.

## Passes de revisão (o que a inspeção das capturas encontrou e o que foi corrigido)
Cada item abaixo nasceu de olhar uma captura real, não de teste automático:

| # | Achado na captura | Correção |
|---|---|---|
| 1 | Cartão de destaque do panorama com ~600 px de vazio (grade de 12 colunas com `row-span-2`) | grade de cartões de mesma altura; comparação trocada de texto longo por **régua** (faixa central, mediana, território) com a frase completa recolhida |
| 2 | Texto da comparação ocupava 6 linhas por cartão | `BenchRuler` + legenda curta do grupo |
| 3 | Sparkline do gasto começava com trecho plano em zero (anos sem taxa viravam 0) | só anos com valor entram na tendência |
| 4 | "Grupo: 27 as 27 unidades da federação" | grupo redigido "unidades da federação" |
| 5 | Parágrafo de contexto do capítulo de criminalidade com 5 linhas (fonte + só-estado + comparação) | fonte vai para "Fontes e limites"; contexto fica com a comparação e o aviso de só-estado |
| 6 | "Efetivo existente × quadro previsto" na página do município sem dizer que é do estado | título "— estado de X" |
| 7 | Eixo Y sem unidade (R$ 75 = milhões?) | linha "Unidade: …" sob o título de todo gráfico |
| 8 | Capítulo prisional repetia a mesma frase no texto e numa caixa | caixa só aparece quando **não** há unidade |
| 9 | Rótulos do eixo "2017º sem. 1" e sobrepostos no fim | rótulo por ano com espaçamento mínimo; nome longo ("1º semestre de 2017") no tooltip |
| 10 | "O que este número é" (Recife) com texto de contrato interno cortado no meio da palavra | definição escrita por opção (unidade, regra de zero, composto) |
| 11 | Ano de fonte de eventos aparecia como "parcial" (círculo vazado) só porque faltava mês sem registro | completude do ano passa a ser a **cobertura da fonte na UF**, não a presença de linha municipal |
| 12 | Distribuição misturava homicídios com estupros | só categorias exclusivas do mesmo grupo, fonte e unidade |
| 13 | Linha e faixa de comparação atravessavam 2022–2023 (sem população) | segmentos interrompidos onde falta ano |
| 14 | Mobile: primeira tela era só moldura (título + lede + abas), KPI abaixo da dobra | lede curto e títulos menores; KPI aparece antes de 1.400 px (teste E2E) |

## Estados de dado exibidos (capturas)
`estado_suprimido_recife_estupro`, `estado_suprimido_saopaulo_estupro` (categoria sensível: nota de supressão), `estado_composto_rio_cvli` (indicador composto: "não é a soma"), `estado_lacuna_altorionovo_roubo` (município pequeno: lacuna ≠ zero), `taxa_com_faixa_vitoria_roubo` (faixa de comparação + "sem população"), `comparar_vitoria_serra`, `mobile_vitoria_criminalidade(_taxa)`.

## Limitações honestas desta validação
- A avaliação de "ritmo e hierarquia" é minha, por inspeção das imagens; não houve teste com usuários.
- O quadro prisional de Alto Rio Novo e de municípios sem unidade foi validado por texto e por E2E, não por captura dedicada.
- Quedas bruscas do RENAEST (2018→2020) refletem cobertura do reporte; a página avisa, mas o gráfico em si não distingue cobertura de queda real.
