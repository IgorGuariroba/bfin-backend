# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-03-14] Rodar lint e testes antes de commits**
   Do instead: `npm test && npm run lint` — sempre validar antes de finalizar mudanças.

2. **[2026-03-14] TypeScript 5.3 + Node.js 20**
   Do instead: seguir convenções padrão do TypeScript, evitar features experimentais não suportadas pelo Node 20.

## Shell & Command Reliability
1. **[2026-03-14] Usar ferramentas dedicadas ao invés de shell commands**
   Do instead: usar `glob`, `grep_search`, `read_file` para busca/leitura; `run_shell_command` apenas para execução de comandos reais (npm, git, docker).

## Domain Behavior Guardrails
1. **[2026-03-14] Prisma ORM — sempre gerar client após mudar schema**
   Do instead: após mudar schema.prisma, rodar `npx prisma generate` para atualizar tipos TypeScript.

2. **[2026-03-14] Prisma ORM — usar snake_case nos creates/updates**
   Do instead: usar `account_id`, `category_id`, `due_date`, `recurrence_interval` (não camelCase) ao criar/atualizar transações.

3. **[2026-03-14] Zod para validação de inputs**
   Do instead: validar todos os inputs de API com schemas Zod tipados. Incluir campo `type` literal em schemas de despesas.

4. **[2026-03-14] Express.js — seguir estrutura de controllers/services**
   Do instead: manter rotas em controllers, lógica de negócio em services, nunca misturar.

## User Directives
1. **[2026-03-14] Output em pt-BR**
   Do instead: sempre responder em português brasileiro, mantendo termos técnicos em inglês.

2. **[2026-03-14] Context7 MCP para documentação**
   Do instead: usar automaticamente Context7 MCP para docs de Express, Prisma, Zod, TypeScript, Node.js.
