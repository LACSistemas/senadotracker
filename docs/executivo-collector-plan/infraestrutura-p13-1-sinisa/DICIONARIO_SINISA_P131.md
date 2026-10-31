# Dicionário SINISA P13.1

## Códigos publicados (referência 2024)

| Família | Código | Unidade | Grão | Observação |
|---|---|---|---|---|
| Água | IAG0001 | Percentual | município/UF/Brasil | atendimento da população total com rede |
| Água | IAG0002 | Percentual | município/UF/Brasil | atendimento da população urbana com rede |
| Água | IAG2006 | l/hab/dia | município/UF/Brasil | consumo total médio per capita |
| Água | IAG2013 | Percentual | município/UF/Brasil | perdas totais na distribuição |
| Esgoto | IES0001 | Percentual | município/UF/Brasil | população total com rede coletora |
| Esgoto | IES0002 | Percentual | município/UF/Brasil | população urbana com rede coletora |
| Esgoto | IES0007 | Percentual | município/UF/Brasil | domicílios com coleta e tratamento |
| Esgoto | IES0008 | Percentual | município/UF/Brasil | domicílios urbanos com coleta e tratamento |
| Resíduos | IRS0001 | Percentual | município | população total com coleta domiciliar |
| Resíduos | IRS0002 | Percentual | município | população urbana com coleta domiciliar |
| Resíduos | IRS0005 | Percentual | município | população total com coleta seletiva |
| Resíduos | IRS3002 | Percentual | município | disposição final inadequada |
| Drenagem | IAP0001 | Percentual | município | vias públicas pavimentadas na área urbana |
| Drenagem | IAP0002 | Percentual | município | vias com redes pluviais subterrâneas |
| Drenagem | IGR0001 | Percentual | município | domicílios sujeitos a risco de inundação |
| Drenagem | IGR0002 | Percentual | município | população impactada por eventos hidrológicos |
| Gestão | OGM3004 | sim/não → 1/0 | município | plano de saneamento básico |
| Gestão | OGM3013 | sim/não → 1/0 | município | PMGIRS |
| Gestão | OGM3201 | sim/não → 1/0 | município | conselho municipal de saneamento |
| Gestão | OGM3301 | sim/não → 1/0 | município | participação em consórcio público |

As linhas de gestão foram codificadas deterministicamente: `Sim=1`, `Não=0`; respostas vazias/não aplicáveis permanecem `NULL`. Strings como “Não calculado”, “Div/0” e “Não informado” permanecem `NULL` com flag de qualidade; zero observado na fonte continua zero válido.

O bloco abaixo é o registro histórico de candidatos anterior à leitura integral; o bloco publicado acima é a fonte de verdade da execução P13.1.

| Família | Indicadores candidatos | Unidade/fórmula | Estado |
|---|---|---|---|
| água | atendimento total/urbano; produção; consumo; perdas; consumo per capita; rede/intermitência | confirmar no glossário | LAYOUT_VERIFIED=NO |
| esgoto | coleta total/urbana; coletado; tratado; proporção tratada; rede; solução individual | confirmar no glossário | LAYOUT_VERIFIED=NO |
| resíduos | coleta domiciliar/urbana; frequência; seletiva; massa; destino; recuperação | confirmar no glossário | LAYOUT_VERIFIED=NO |
| drenagem | infraestrutura; planejamento; manejo; risco/ocorrência; manutenção | confirmar no glossário | LAYOUT_VERIFIED=NO |
| gestão | plano; titularidade; regulação; regionalização; instrumentos; soluções alternativas | confirmar no glossário | LAYOUT_VERIFIED=NO |

Regras bloqueantes: não somar percentuais; não fazer média simples para UF/Brasil; não confundir produção, consumo, coleta e tratamento; ausência não é zero; prestador regional não é município.
