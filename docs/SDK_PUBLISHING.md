# SDK Publishing Guide

Este guia explica como funciona a publicação automática do SDK no GitHub Packages.

## 🤖 Publicação Automática

**O SDK é publicado automaticamente** quando um PR é merged na branch `main`!

### Como Funciona

1. **PR Merged** → Dispara workflow de publicação
2. **Análise de Commits** → Determina tipo de versão (major, minor, patch)
3. **Bump Automático** → Incrementa versão baseado em conventional commits
4. **Publicação** → Publica no GitHub Packages
5. **Release** → Cria GitHub Release com changelog

### Conventional Commits

O versionamento é baseado em **conventional commits**:

| Commit Type | Exemplo | Versão |
|------------|---------|---------|
| `feat:` | `feat: add new endpoint` | **MINOR** (x.1.x) |
| `fix:` | `fix: resolve auth bug` | **PATCH** (x.x.1) |
| `feat!:` ou `BREAKING CHANGE:` | `feat!: redesign API` | **MAJOR** (1.x.x) |
| `chore:`, `docs:`, etc. | `docs: update README` | **PATCH** (x.x.1) |

### Exemplo de Fluxo

```bash
# 1. Criar branch e fazer mudanças
git checkout -b feat/add-filters
# ... fazer mudanças

# 2. Commit com conventional commits
git commit -m "feat: add transaction filters"

# 3. Push e criar PR
git push origin feat/add-filters
# Criar PR no GitHub

# 4. Após aprovação, merge o PR
# ✅ SDK é publicado AUTOMATICAMENTE como versão MINOR (ex: 1.1.0)
```

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

## ⚙️ Como Funciona o Versionamento Automático

### Script de Auto-Versioning

O script `scripts/auto-version.sh` analisa os commits desde a última tag:

1. Busca última tag (ex: `v1.0.5`)
2. Lista commits desde a última tag
3. Procura por padrões:
   - `feat!:` ou `BREAKING CHANGE:` → **MAJOR**
   - `feat:` → **MINOR**
   - `fix:` → **PATCH**
4. Incrementa versão apropriadamente
5. Cria nova tag (ex: `v1.1.0`)

### Workflow de Publicação

Localizado em `.github/workflows/publish-sdk.yml`:

**Dispara quando:**
- Push na branch `main` (quando PR é merged)
- Mudanças em arquivos relevantes (`src/`, `prisma/`, etc.)

**Passos:**
1. ✅ Gera OpenAPI spec
2. ✅ Gera SDK com Orval
3. 🔍 Analisa commits e determina versão
4. 📝 Gera changelog automático
5. 🏷️ Cria e publica tag
6. 📦 Publica no GitHub Packages
7. 🎉 Cria GitHub Release

## 📝 Como Publicar (Automático)

### Fluxo Normal (Recomendado)

```bash
# 1. Criar branch de feature
git checkout -b feat/new-feature

# 2. Fazer mudanças e commit com conventional commits
git commit -m "feat: add new awesome feature"

# 3. Push e criar PR
git push origin feat/new-feature
# Criar PR no GitHub

# 4. Após aprovação, merge o PR na main
# ✅ SDK é publicado AUTOMATICAMENTE!
```

### Verificar Publicação

Após o merge, o workflow é executado automaticamente:

1. Acesse: https://github.com/IgorGuariroba/bfin-backend/actions
2. Verifique o workflow "Publish SDK to GitHub Packages"
3. Após conclusão, verifique: https://github.com/IgorGuariroba/bfin-backend/packages
4. Teste a instalação:

```bash
npm install @igorguariroba/bfin-sdk@latest
```

## 🔧 Publicação Manual (Casos Especiais)

Em casos especiais, você pode publicar manualmente:

### Opção 1: Workflow Manual (Recomendado)

Via interface do GitHub:

1. Acesse: https://github.com/IgorGuariroba/bfin-backend/actions/workflows/publish-sdk.yml
2. Clique em "Run workflow"
3. Selecione a branch `main`
4. Escolha o tipo de bump (ou deixe "auto")
5. Clique em "Run workflow"

### Opção 2: Via Linha de Comando

Se precisar publicar manualmente via linha de comando:

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

## 📚 Exemplos Práticos

### Exemplo 1: Adicionar Nova Feature (MINOR)

**Cenário:** Adicionar endpoint de filtros de transações

```bash
# 1. Criar branch
git checkout -b feat/transaction-filters

# 2. Desenvolver a feature
# ... adicionar endpoint em src/routes/transactions.routes.ts
# ... adicionar docs Swagger

# 3. Testar localmente
npm run build
npm test

# 4. Commit com conventional commit
git add .
git commit -m "feat: add transaction filters with date range"

# 5. Push e criar PR
git push origin feat/transaction-filters
# Criar PR no GitHub

# 6. Após aprovação e merge do PR
# ✅ SDK v1.1.0 é publicado AUTOMATICAMENTE!
# 📦 Disponível em: @igorguariroba/bfin-sdk@1.1.0
```

### Exemplo 2: Corrigir Bug (PATCH)

**Cenário:** Corrigir bug no token refresh

```bash
# 1. Criar branch
git checkout -b fix/token-refresh

# 2. Corrigir o bug
# ... fix em sdk/client/custom-instance.ts

# 3. Commit com conventional commit
git commit -m "fix: resolve token refresh timing issue"

# 4. Push e criar PR
git push origin fix/token-refresh
# Criar PR no GitHub

# 5. Após merge do PR
# ✅ SDK v1.0.1 é publicado AUTOMATICAMENTE!
# 📦 Disponível em: @igorguariroba/bfin-sdk@1.0.1
```

### Exemplo 3: Breaking Change (MAJOR)

**Cenário:** Redesign da autenticação (breaking change)

```bash
# 1. Criar branch
git checkout -b feat/auth-redesign

# 2. Implementar breaking change
# ... redesign completo do auth

# 3. Commit com '!' ou 'BREAKING CHANGE:'
git commit -m "feat!: redesign authentication flow

BREAKING CHANGE: configureBfinApi() now requires apiKey parameter.
Migration guide: https://github.com/.../migration-v2.md"

# 4. Push e criar PR
git push origin feat/auth-redesign
# Criar PR no GitHub com label 'breaking-change'

# 5. Após merge do PR
# ✅ SDK v2.0.0 é publicado AUTOMATICAMENTE!
# 📦 Disponível em: @igorguariroba/bfin-sdk@2.0.0
# ⚠️  Release notes incluem warning de breaking change
```

### Exemplo 4: Múltiplos Commits em um PR

**Cenário:** PR com múltiplas mudanças

```bash
git checkout -b feature/improvements

# Commit 1: Nova feature
git commit -m "feat: add pagination support"

# Commit 2: Bug fix
git commit -m "fix: resolve memory leak"

# Commit 3: Docs
git commit -m "docs: update API examples"

# Push e merge PR
# ✅ SDK publicado como MINOR (feat: tem prioridade)
# Changelog inclui todas as mudanças categorizadas
```

## 🔧 Troubleshooting

### Workflow Não Dispara Após Merge

**Problema:** PR foi merged mas workflow não executou

**Soluções:**
1. Verificar se o PR modificou arquivos monitorados (`src/`, `prisma/`, etc.)
2. Verificar se há erros na sintaxe do workflow
3. Acesse Actions no GitHub e verifique se há workflows falhados
4. Verifique permissões do workflow em Settings → Actions

```bash
# Forçar disparo manual
gh workflow run publish-sdk.yml
```

### Versão Não Incrementou Corretamente

**Problema:** Expected v1.1.0 mas publicou v1.0.1

**Causa:** Commit message não seguiu conventional commits

**Solução:**
```bash
# Verificar commits desde última tag
git log v1.0.0..HEAD --oneline

# Exemplo incorreto:
# "Add new feature" ❌ (sem prefixo feat:)

# Exemplo correto:
# "feat: add new feature" ✅
```

**Corrigir:**
1. Delete a versão errada no GitHub Packages
2. Delete a tag: `git push --delete origin v1.0.1`
3. Refaça o commit com message correto
4. Crie novo PR e merge

### SDK Não Foi Publicado

**Problema:** Workflow completou mas SDK não aparece no GitHub Packages

**Soluções:**
1. Verificar logs do step "Publish to GitHub Packages"
2. Verificar permissões: Settings → Actions → Workflow permissions
3. Verificar se `GITHUB_TOKEN` tem permissão `write:packages`

```yaml
# .github/workflows/publish-sdk.yml deve ter:
permissions:
  contents: write
  packages: write
```

### Erro 401 ao Publicar

**Problema:** `npm ERR! 401 Unauthorized`

**Solução:**
Workflow usa `GITHUB_TOKEN` automaticamente. Verificar:
1. Se o repositório tem permissão para criar packages
2. Se o workflow tem permissão correta (ver acima)

### Changelog Vazio no Release

**Problema:** Release criado mas changelog está vazio

**Causa:** Commits não seguem conventional commits

**Solução:**
Use prefixos corretos:
- `feat:` para features
- `fix:` para bug fixes
- `docs:` para documentação
- etc.

### SDK com Versão Errada

**Problema:** Publicou versão incorreta (ex: v2.0.0 ao invés de v1.1.0)

**Solução:**
1. Delete a versão no GitHub Packages
2. Delete a tag:
```bash
git tag -d v2.0.0
git push --delete origin v2.0.0
```
3. Ajuste os commits (rebase/amend) se necessário
4. Re-merge o PR ou dispare workflow manual

### Testar Workflow Antes de Merge

**Solução:** Use workflow manual com branch de teste

1. Acesse: Actions → Publish SDK to GitHub Packages
2. Run workflow em sua branch de feature
3. Verifique o output
4. Se OK, faça o merge

## ✅ Best Practices

### 1. Use Conventional Commits

**Sempre use prefixos corretos:**
```bash
✅ git commit -m "feat: add new endpoint"
✅ git commit -m "fix: resolve auth bug"
✅ git commit -m "feat!: breaking change description"

❌ git commit -m "Added new endpoint"
❌ git commit -m "Fixed bug"
❌ git commit -m "Update code"
```

### 2. Agrupe Mudanças Relacionadas

**Bom:**
```bash
# Um PR com mudanças relacionadas
feat: add transaction filters
  - Add date range filter
  - Add category filter
  - Add tests
```

**Evite:**
```bash
# Múltiplos PRs pequenos desnecessários
feat: add date filter
feat: add category filter
fix: add tests
```

### 3. Documente Breaking Changes

**No commit message:**
```bash
git commit -m "feat!: redesign auth API

BREAKING CHANGE: configureBfinApi() signature changed.
Before: configureBfinApi(url, token)
After: configureBfinApi({ baseUrl, token })

Migration: Update all calls to use object syntax"
```

### 4. Teste Antes de Merge

```bash
# Antes de criar PR
npm run build        # Verifica se compila
npm test             # Roda testes
npm run type-check   # Verifica types
```

### 5. Revise o Changelog Automático

Após publicação, verifique o changelog gerado:
1. Acesse o Release no GitHub
2. Revise se categorizações estão corretas
3. Se necessário, edite manualmente o release

### 6. Coordene Breaking Changes

**Para breaking changes:**
1. Avise o time antes de merge
2. Atualize documentação de migração
3. Considere fazer em release separado
4. Teste com consumidores do SDK

### 7. Monitor Publicações

Após merge, monitore:
1. Status do workflow no GitHub Actions
2. Publicação no GitHub Packages
3. Notificações de erro

### 8. Mantenha CHANGELOG.md Atualizado

Mesmo com changelog automático, mantenha `/sdk/CHANGELOG.md`:
```bash
# Periodicamente, atualize manualmente com detalhes
vim sdk/CHANGELOG.md
```

## 📋 Checklist Antes de Merge

Use este checklist antes de fazer merge do PR:

### Desenvolvimento
- [ ] Mudanças implementadas e testadas localmente
- [ ] Build local passa: `npm run build`
- [ ] Testes passam: `npm test`
- [ ] Type check passa: `npm run type-check`
- [ ] Lint passa: `npm run lint`

### Commits
- [ ] Todos os commits seguem conventional commits
- [ ] Prefixo correto usado (feat:, fix:, feat!:)
- [ ] Breaking changes documentados no commit body
- [ ] Mensagens descritivas e claras

### Documentação
- [ ] README atualizado se necessário
- [ ] Swagger docs atualizados
- [ ] Breaking changes documentados

### Pull Request
- [ ] PR title é descritivo
- [ ] PR description explica as mudanças
- [ ] Labels apropriados (se aplicável)
- [ ] Code review aprovado

### Pós-Merge (Automático)
O sistema fará automaticamente:
- ✅ Determinar nova versão
- ✅ Gerar SDK
- ✅ Criar tag
- ✅ Publicar no GitHub Packages
- ✅ Criar GitHub Release
- ✅ Gerar changelog

### Verificação Pós-Publicação
- [ ] Workflow passou no GitHub Actions
- [ ] Package aparece em GitHub Packages
- [ ] Release criado com changelog correto
- [ ] Versão incrementada corretamente
- [ ] (Opcional) Testar instalação: `npm install @igorguariroba/bfin-sdk@latest`

## Contato

Para dúvidas sobre publicação, abra uma issue em:
https://github.com/IgorGuariroba/bfin-backend/issues
