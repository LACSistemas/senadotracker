# Identidade, beneficiários e escolas

- Códigos de beneficiário e município SIAFI são preservados como `source-native`; não são convertidos em pessoa jurídica sem evidência.
- CNPJ é apenas normalizado por dígitos e validação estrutural. Não há fuzzy matching de organizações.
- Escola exige código INEP exato. UEx, EEx e escola são papéis distintos; não são colapsados.
- `entity_id` só é preenchido quando o cadastro determinístico existe. Ausência de vínculo é cobertura parcial, não entidade inexistente.
- CPF, quando presente em fonte, não vira superfície de produto; a camada canônica prefere identificador protegido.
- PNAE/PNATE do Portal não são distribuídos para escolas. PDDE Info é a única publicação escolar desta onda.
