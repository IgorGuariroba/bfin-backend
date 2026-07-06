# Conventional Commits com enforcement, sem versionamento automático

Commits, branches e títulos de PR seguem Conventional Commits (`tipo(escopo)?: assunto`; branches `tipo/slug-kebab`). O enforcement acontece em três pontos: hook commit-msg (regex leve no Lefthook — rejeitamos o commitlint por trazer ~150 pacotes para validar uma string), job de nome de branch no pre-commit, e o check obrigatório `pr-title` no CI. O último é o que importa de verdade: o repo squash-merga, então o título do PR é o commit que chega na main — validar só localmente deixaria o furo principal aberto.

**Semantic-release/SemVer ficou de fora deliberadamente**: o backend é um serviço de deploy contínuo — o `version` do package.json não tem consumidor, e tags/changelog automáticos seriam manutenção sem leitor. Os commits já padronizados permitem adotar semantic-release depois sem retrabalho, se um dia existir release publicada ou consumidor de versão.
