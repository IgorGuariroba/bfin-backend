# Knip não cobra consumo dos exports dos barrels de src/core

O Knip roda no pre-commit em modo bloqueante, mas os barrels `src/core/*/index.ts` são configurados como entry points cujos exports não precisam de consumidor. Esses barrels são a API pública da fronteira do core (ADR-0013 do bfin-app, herdada no decommission #191): um export sem uso atual ali é contrato do módulo, não dead code — parte da superfície era consumida pelo bfin-app e pode voltar a ser.

Consideramos deletar os ~89 exports sem consumidor acusados na primeira execução, mas o core acabou de migrar (#191) e a superfície ainda está assentando; enxugar agora geraria vaivém de re-exports. Fora dos barrels, o Knip permanece estrito.
