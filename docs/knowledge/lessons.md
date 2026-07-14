---
type: Playbook
title: Lessons
description: One-line rules learned from user corrections and self-caught mistakes, read at the start of every agent session.
tags: [lessons, agents, self-learning]
timestamp: 2026-07-11T01:00:00Z
---

# Lessons

Regras de uma linha aprendidas de correções. Critérios de admissão e fluxo de escrita: ver `AGENTS.md` § 7 (Self-learning).

- Regenerar o `package-lock.json` sempre com npm 10 (versão do CI); npm 11 local produz lockfile que o CI rejeita.
- O plano zai atual não inclui `glm-5v-turbo` (erro 429 "subscription plan does not yet include access"); para papéis do `/ship`, usar `glm-5-turbo` ou `glm-5.2` (zai, funcionam).
- O bfin-backend é GitHub com branch default `main`; scripts/agentes que fazem diffs devem usar `main`, nunca `master`.
- Estado de fluxo do `/ship` no bfin: `.ship/` é gitignored (events.jsonl, spec.md, logs); papéis específicos do projeto vão em `.pi/agent-roles/` e sobrepõem os globais (`~/.pi/agent/agent-roles/`).
- Nunca rodar bash que depende de diretório/arquivo criado por `write` na mesma mensagem paralela: o `cd ~/projetos/pong-game` falhou porque o dir ainda não existia e operou no bfin (commit vazio `chore: init` em main + `.gitignore` sobrescrito — revertidos). Execute sequencial quando houver dependência.
