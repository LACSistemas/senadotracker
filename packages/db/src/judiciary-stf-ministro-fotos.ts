/**
 * Fotos oficiais dos Ministros do STF (ativos e aposentados) que aparecem na divulgação de remuneração
 * do próprio STF (P14.10, `jud_stf_rendimento_mensal`) — mapeadas pela mesma `matricula` usada naquela
 * tabela. Fonte: a página individual de cada Ministro em
 * portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=<id> (esse `id` de ministro é um
 * cadastro histórico diferente da matrícula de folha — cada entrada abaixo foi resolvida comparando o
 * nome completo nas duas fontes, confirmado em 2026-11-06). Referência estática por natureza: a
 * composição do STF muda raramente (indicação presidencial + aprovação do Senado); atualizar à mão
 * se/quando um Ministro novo tomar posse ou um nome estiver ausente aqui.
 */
export interface StfMinistroFoto { nomeDeGuerra: string; fotoUrl: string; perfilUrl: string }

export const STF_MINISTRO_FOTOS: Readonly<Record<string, StfMinistroFoto>> = {
  '58': { nomeDeGuerra: 'Alexandre de Moraes', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=2921', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=50' },
  '60': { nomeDeGuerra: 'André Mendonça', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=3102', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=52' },
  '46': { nomeDeGuerra: 'Cezar Peluso', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=703', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=37' },
  '47': { nomeDeGuerra: 'Ayres Britto', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=704', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=38' },
  '13': { nomeDeGuerra: 'Carlos Velloso', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=724', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=29' },
  '50': { nomeDeGuerra: 'Cármen Lúcia', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=3041', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=42' },
  '61': { nomeDeGuerra: 'Cristiano Zanin', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=3161', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=53' },
  '43': { nomeDeGuerra: 'Ellen Gracie', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=681', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=35' },
  '49': { nomeDeGuerra: 'Ricardo Lewandowski', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=2661', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=41' },
  '48': { nomeDeGuerra: 'Eros Grau', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=706', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=40' },
  '62': { nomeDeGuerra: 'Flávio Dino', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=3181', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=54' },
  '44': { nomeDeGuerra: 'Gilmar Mendes', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=701', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=36' },
  '32': { nomeDeGuerra: 'Ilmar Galvão', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=723', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=31' },
  '45': { nomeDeGuerra: 'Joaquim Barbosa', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=705', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=39' },
  '52': { nomeDeGuerra: 'Dias Toffoli', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=2662', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=44' },
  '11': { nomeDeGuerra: 'Celso de Mello', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=684', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=28' },
  '4': { nomeDeGuerra: 'Francisco Rezek', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=721', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=21' },
  '2': { nomeDeGuerra: 'Néri da Silveira', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=802', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=17' },
  '59': { nomeDeGuerra: 'Nunes Marques', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=3062', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=51' },
  '56': { nomeDeGuerra: 'Luís Roberto Barroso', fotoUrl: 'https://portal.stf.jus.br/util/imagem.asp?tamanho=miniatura&id=3141', perfilUrl: 'https://portal.stf.jus.br/ostf/ministros/verMinistro.asp?periodo=STF&id=48' },
};
