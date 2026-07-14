# Gates de plano e verificação de admin pertencem ao frontend

O backend exportava `isMonthAllowed`, `isFutureMonthAllowed`, `freeOldestMonth`, `freeNewestMonth`, `currentYearMonth` (gate de plano free/pro por mês-calendário) e `isAdminEmail` (checagem de admin por lista de emails) no domínio Identity, resquício da migração do monolito. Nenhum código do servidor os chamava — as únicas referências eram os próprios re-exports do barrel. O bfin-app já possui e usa cópias próprias desses helpers em seus módulos de plano e hooks de cliente, sem depender do pacote do backend.

Deletados os módulos (`admin.ts`, `gates.ts`) e seus re-exports do barrel de Identity. Nenhum substituto é criado no backend: o servidor não aplica gate de plano nem checagem de admin hoje, e helper puro sem chamador é código morto independente de onde mora.

Decisão deliberada contra pacote compartilhado entre os dois repositórios: a infra de publicação/versionamento não se paga enquanto o backend não executa nenhum gate. Se um dia o servidor precisar aplicar gate de plano (ex.: enforcement server-side de meses permitidos) ou checar admin, a regra entra como caso de uso do core com port próprio — não como helper puro re-exportado para o frontend consumir.
