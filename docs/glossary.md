# Glossário

Linguagem ubíqua do projeto. Termos novos entram aqui quando uma decisão os introduz (referencie o ADR).

- **Lesson** — regra de uma linha aprendida de uma correção do usuário ou erro auto-detectado pelo agente; específica e acionável (cita comando, arquivo, versão ou convenção). Vive em `docs/knowledge/lessons.md`. (ADR-0006)
- **OKF (Open Knowledge Format)** — spec aberta para conhecimento consumível por agentes e humanos: markdown com frontmatter YAML, único campo obrigatório `type`. <https://okf.md/>. (ADR-0006)
- **Self-learning** — política do AGENTS.md § 7: ao ser corrigido, o agente grava a lesson antes de continuar, para que o erro não se repita. (ADR-0006)
