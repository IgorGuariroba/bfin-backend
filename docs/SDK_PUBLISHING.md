# SDK Publishing Guide

Este guia explica como publicar novas versões do SDK no GitHub Packages.

## Versionamento Semântico

O SDK segue [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.x.x): Breaking changes na API ou estrutura do SDK
- **MINOR** (x.1.x): Novas features compatíveis com versões anteriores
- **PATCH** (x.x.1): Bug fixes e melhorias de documentação

### Quando incrementar cada parte:

**MAJOR (1.x.x)**
- Breaking changes na API (endpoints removidos ou modificados incompativelmente)
- Mudanças incompatíveis na estrutura do SDK
- Remoção de exports públicos
- Alterações que quebram código existente

**MINOR (x.1.x)**
- Novos endpoints na API
- Novas features no SDK
- Novos hooks ou métodos
- Melhorias compatíveis

**PATCH (x.x.1)**
- Bug fixes
- Correções de types TypeScript
- Melhorias de documentação
- Correções de segurança

## Como Publicar Nova Versão

### 1. Atualizar CHANGELOG.md

Adicione as notas de release em `sdk/CHANGELOG.md`:

```markdown
## [1.1.0] - 2024-01-15

### Added
- Novo endpoint de filtros de transações
- Hooks para busca avançada

### Fixed
- Correção no refresh de token
- Types do erro 401

### Changed
- Melhorias na documentação
```

### 2. Commit das Mudanças

```bash
git add .
git commit -m "feat: add transaction filters to SDK"
git push origin main
```

### 3. Criar Git Tag

```bash
# Criar tag com a versão
git tag v1.1.0

# Push da tag (isso dispara a publicação automática)
git push origin v1.1.0
```

### 4. Publicação Automática

O GitHub Actions automaticamente:
1. Gera o OpenAPI spec
2. Gera o SDK
3. Atualiza a versão no `package.json`
4. Publica no GitHub Packages
5. Cria GitHub Release

### 5. Verificar Publicação

1. Acesse: https://github.com/IgorGuariroba/bfin-backend/packages
2. Verifique se a versão foi publicada corretamente
3. Teste a instalação:

```bash
npm install @igorguariroba/bfin-sdk@1.1.0
```

## Publicação Manual (Se Necessário)

Se precisar publicar manualmente:

```bash
# Gerar SDK
npm run generate:openapi
npm run generate:sdk

# Ir para o diretório do SDK
cd sdk

# Atualizar versão
npm version 1.1.0 --no-git-tag-version

# Publicar (necessita estar autenticado no GitHub Packages)
npm publish
```

### Autenticação para Publicação Manual

Crie um Personal Access Token no GitHub com permissão `write:packages`:

1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Selecione `write:packages`
4. Adicione ao `.npmrc`:

```bash
echo "//npm.pkg.github.com/:_authToken=YOUR_TOKEN" >> ~/.npmrc
```

## Instalando SDK Publicado

### Para Usuários

**1. Configurar .npmrc:**
```bash
echo "@igorguariroba:registry=https://npm.pkg.github.com" >> ~/.npmrc
```

**2. Adicionar token (para repositórios privados):**
```bash
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> ~/.npmrc
```

**3. Instalar SDK:**
```bash
npm install @igorguariroba/bfin-sdk
```

### Token de Leitura

Os usuários precisam de um GitHub Personal Access Token com permissão `read:packages`:

1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Selecione `read:packages`
4. Copie o token e adicione ao `.npmrc`

## Exemplo de Fluxo Completo

### Nova Feature (MINOR)

```bash
# 1. Desenvolver a feature na API
# ... fazer mudanças no código

# 2. Testar localmente
npm run build

# 3. Atualizar CHANGELOG
vim sdk/CHANGELOG.md
# Adicionar seção [1.1.0] com as mudanças

# 4. Commit
git add .
git commit -m "feat: add transaction filters"
git push origin main

# 5. Criar e push tag
git tag v1.1.0
git push origin v1.1.0

# 6. Aguardar GitHub Actions publicar
# Verificar em: https://github.com/IgorGuariroba/bfin-backend/actions
```

### Bug Fix (PATCH)

```bash
# 1. Corrigir bug
# ... fazer correção

# 2. Atualizar CHANGELOG
vim sdk/CHANGELOG.md
# Adicionar seção [1.0.1] com correções

# 3. Commit
git commit -m "fix: token refresh logic"
git push origin main

# 4. Criar e push tag
git tag v1.0.1
git push origin v1.0.1
```

### Breaking Change (MAJOR)

```bash
# 1. Implementar breaking change
# ... fazer mudanças incompatíveis

# 2. Atualizar CHANGELOG com BREAKING CHANGES destacado
vim sdk/CHANGELOG.md
# Adicionar seção [2.0.0] com BREAKING CHANGES

# 3. Commit
git commit -m "feat!: redesign authentication flow

BREAKING CHANGE: Authentication now requires explicit token configuration"
git push origin main

# 4. Criar e push tag
git tag v2.0.0
git push origin v2.0.0
```

## Troubleshooting

### Erro de Autenticação ao Publicar

**Problema:** `npm ERR! 401 Unauthorized`

**Solução:**
1. Verificar se o token tem permissão `write:packages`
2. Verificar se o token está no `.npmrc`
3. Verificar se o scope está correto no `package.json`

### Versão Errada Publicada

**Solução:**
1. Ir para: https://github.com/IgorGuariroba/bfin-backend/packages
2. Clicar no package
3. Package settings → Delete package version
4. Criar nova tag e push

### SDK Não Atualiza Após Publicação

**Problema:** `npm install` instala versão antiga

**Solução:**
```bash
# Limpar cache do npm
npm cache clean --force

# Reinstalar
npm install @igorguariroba/bfin-sdk@latest
```

### Workflow Falha na Publicação

**Soluções:**
1. Verificar logs do GitHub Actions
2. Verificar se OpenAPI spec foi gerado corretamente
3. Verificar se todos os arquivos necessários estão no `files[]` do package.json
4. Testar publicação manual localmente

## Best Practices

1. **Sempre atualizar CHANGELOG.md** antes de criar tag
2. **Testar SDK localmente** antes de publicar
3. **Seguir semver estritamente** para não quebrar dependentes
4. **Documentar breaking changes** claramente no CHANGELOG
5. **Manter versões sincronizadas** com mudanças na API
6. **Revisar changes** antes de criar tag
7. **Não pular versões** (não ir de 1.0.0 para 1.2.0 diretamente)
8. **Testar instalação** após publicação

## Checklist de Publicação

- [ ] Mudanças testadas localmente
- [ ] CHANGELOG.md atualizado
- [ ] README atualizado (se necessário)
- [ ] Build local passa (`npm run build`)
- [ ] SDK gerado corretamente
- [ ] Versão semântica correta escolhida
- [ ] Breaking changes documentados
- [ ] Commit com mensagem descritiva
- [ ] Tag criada com versão correta
- [ ] GitHub Actions passou
- [ ] Package aparece no GitHub Packages
- [ ] Testada instalação do package
- [ ] Release notes criadas automaticamente

## Contato

Para dúvidas sobre publicação, abra uma issue em:
https://github.com/IgorGuariroba/bfin-backend/issues
