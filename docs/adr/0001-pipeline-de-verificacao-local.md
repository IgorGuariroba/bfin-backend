# Pipeline de verificação local em duas camadas (pre-commit rápido, pre-push completo)

Hooks git gerenciados pelo Lefthook. O pre-commit é o portão rápido (~3s, tarefas em paralelo): Prettier e ESLint apenas nos arquivos staged, `tsc --noEmit` e Knip completos (nenhum dos dois tem modo parcial confiável), e testes unit via `vitest --changed`. O pre-push é o portão completo: typecheck, migrations, toda a suíte (unit + integration) e build.

O pre-push **sobe o Postgres dev automaticamente** (`docker compose -f docker-compose.dev.yml up -d`) antes dos testes de integração, em vez de falhar quando o banco está fora. Escolhemos conveniência sobre previsibilidade: o push nunca bloqueia por banco desligado, ao custo de o hook depender do Docker e ganhar um cold start ocasional.

Rejeitamos infraestrutura de "apenas testes afetados" (grafo de dependências, filtros por módulo): a suíte unit inteira roda em ~1,6s, então o modo afetado só é usado onde a ferramenta já oferece nativamente (staged files no ESLint/Prettier, `--changed` no Vitest).
