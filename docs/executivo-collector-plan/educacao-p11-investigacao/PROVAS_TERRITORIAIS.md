# Provas territoriais

## O que está provado

- civica_exec.exec_entity contém UF e municípios com IBGE e é o reuso territorial do P10.
- Censo Superior 2024 possui CO_MUNICIPIO_IES no arquivo institucional e CO_MUNICIPIO no arquivo de cursos.
- Sinopse Superior é explicitamente publicada por município.
- MEC indicadores de ensino superior oferecem código IBGE do município para cursos e IES.

## O que precisa de prova adicional

- e-MEC é fonte oficial de regulação, mas consulta pública web/JS; API ou extração em massa não foi comprovada.
- polos EaD podem exigir dimensão própria; não usar sede como proxy.
- CAPES/Sucupira precisa de crosswalk oficial para localização do programa e IES.
- ENEM deve distinguir residência, escola e aplicação; os campos atuais precisam ser lidos em D:.

## Regras de publicação

1. código IBGE primeiro; nome apenas como rótulo;
2. UF derivada do código/arquivo, não de texto livre;
3. sem fuzzy matching de IES, curso ou município;
4. UNRESOLVED e NOT_AVAILABLE visíveis em cobertura, não zero;
5. cada agregado guarda fonte, edição, unidade e população.

