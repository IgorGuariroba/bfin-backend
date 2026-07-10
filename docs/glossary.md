# Glossário

Linguagem ubíqua do projeto. Termos novos entram aqui quando uma decisão os introduz (referencie o ADR).

- **Lesson** — regra de uma linha aprendida de uma correção do usuário ou erro auto-detectado pelo agente; específica e acionável (cita comando, arquivo, versão ou convenção). Vive em `docs/knowledge/lessons.md`. (ADR-0006)
- **OKF (Open Knowledge Format)** — spec aberta para conhecimento consumível por agentes e humanos: markdown com frontmatter YAML, único campo obrigatório `type`. <https://okf.md/>. (ADR-0006)
- **Self-learning** — política do AGENTS.md § 7: ao ser corrigido, o agente grava a lesson antes de continuar, para que o erro não se repita. (ADR-0006)
- **Sugestão** — resolução de `{ type, tagId }` a partir da descrição (e type opcional do chamador), consultando as Tags do usuário. Caso de uso `suggest` do core de Transações — única fonte da regra de sugestão, compartilhada pelas fronteiras REST e MCP. (issue #28)
- **Movimentação sugerida** — composição de sugestão + criação num único caso de uso (`createSuggested` do core de Transações): resolve type e Tag e cria a movimentação, reaproveitando a validação, a detecção de duplicata e a recorrência do `createTransaction`. Usada pela tool MCP `create_transaction` e disponível para fronteiras futuras. (issue #28)
