# Quality gates no CI e main protegida como portão do deploy

O deploy de produção é do Dokploy, que redeploya automaticamente a cada push na main — o GitHub Actions não deploya. Para o CI valer como portão, a main é protegida por ruleset: merge só via pull request com os quatro checks verdes (`ci`, `semgrep`, `jscpd`, `sonar`), push direto e force-push bloqueados. O Dokploy passa a só ver commits verificados, sem o Actions precisar conhecer o deploy.

Aos portões existentes (lint, typecheck, testes com Postgres real, build) somam-se: **Semgrep** (`p/typescript` + `p/security-audit`, tokenless — backend de pagamentos não tinha SAST), **jscpd** (threshold de 6% sobre `src/` sem testes; a base tinha 5,45% na adoção — o limite trava crescimento e deve ser apertado conforme refatora) e **SonarCloud** (org `igorguariroba`, análise via CI com `qualitygate.wait=true`; o Automatic Analysis foi desligado por conflitar com análise via scanner).

**Dependency Cruiser ficou de fora**: a única regra de arquitetura do repo (fronteira do core, ADR-0013 do bfin-app) já é imposta por ESLint `no-restricted-imports` no CI — a ferramenta só se justifica se novas fronteiras surgirem.
