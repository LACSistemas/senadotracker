# Privacidade e armazenamento

- Banco alvo permanece `projetoeleitor_db`; esta fase executou **zero escrita** e `POSTGRES_GROWTH_BYTES=0`.
- RAW/staging futuros devem ficar em `D:\Civica`; nenhum download foi feito nesta investigação.
- MMGD pode conter nome do titular e identificadores de unidade consumidora: persistir apenas agregados municipais/UF por padrão; titular/CNPJ somente se houver finalidade pública e revisão LGPD.
- ANP revendedores e instalações portuárias contêm endereço, CNPJ e operador: limitar exposição ao necessário e separar evidência bruta de read model.
- Barragens e infraestrutura crítica: publicar localização e categoria conforme fonte oficial, sem inferir risco probabilístico ou expor dados operacionais sensíveis não publicados.
- Microdados pessoais de Censo não entram no domínio; usar agregados oficiais.
