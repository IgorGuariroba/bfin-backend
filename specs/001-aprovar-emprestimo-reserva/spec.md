# Feature Specification: Aprovar Simulação de Empréstimo e Retirar da Reserva

**Feature Branch**: `001-aprovar-emprestimo-reserva`
**Created**: 2026-01-28
**Status**: Draft
**Input**: User description: "Quero pode aprovar uma similação existente de emprestimo e conseguir defato retirar o valor da reserva"

## Clarifications

### Session 2026-01-28

- Q: Qual é o destino do valor retirado da reserva de emergência? → A: A retirada credita o valor no saldo disponível/corrente da mesma conta (separado da reserva de emergência)
- Q: É possível cancelar uma aprovação antes de retirar o valor? → A: Não permitir cancelamento - aprovação é definitiva, usuário simplesmente não executa a retirada se mudar de ideia
- Q: O fluxo de aprovação e retirada é uma operação única ou separada? → A: Duas operações separadas e independentes (aprovar primeiro, depois retirar quando desejar)
- Q: Quando validar o limite de 70% da reserva - na aprovação, na retirada ou em ambos? → A: Validar na aprovação E na retirada (dupla validação para máxima segurança)
- Q: Quais estados deve ter uma simulação ao longo do ciclo de vida? → A: Três estados distintos: "não aprovada" → "aprovada (pendente retirada)" → "aprovada e retirada (concluída)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Aprovar Simulação de Empréstimo (Priority: P1)

Um usuário que criou uma simulação de empréstimo deseja aprová-la formalmente para que o sistema registre sua decisão de prosseguir com o empréstimo. Esta aprovação é o passo crítico que transforma uma simulação em uma intenção concreta de utilizar a reserva de emergência.

**Why this priority**: Esta é a funcionalidade central da feature. Sem a capacidade de aprovar uma simulação, o usuário não pode avançar no processo de obtenção do empréstimo. É o primeiro passo essencial que habilita todas as outras funcionalidades.

**Independent Test**: Pode ser testado completamente criando uma simulação válida e então aprovando-a através da interface. O valor entregue é a capacidade do usuário de formalizar sua decisão de empréstimo.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado possui uma simulação de empréstimo com estado "não aprovada", **When** o usuário solicita aprovar a simulação fornecendo o ID da simulação, **Then** o sistema registra a aprovação com data/hora, altera o estado para "aprovada" e retorna confirmação com os detalhes da simulação aprovada

2. **Given** um usuário autenticado tenta aprovar uma simulação, **When** a simulação não existe ou não pertence ao usuário, **Then** o sistema retorna erro indicando que a simulação não foi encontrada

3. **Given** um usuário autenticado tenta aprovar uma simulação, **When** a simulação já foi aprovada anteriormente, **Then** o sistema retorna erro indicando que a simulação já está aprovada e não pode ser aprovada novamente

4. **Given** um usuário autenticado possui múltiplas simulações, **When** o usuário aprova uma simulação específica, **Then** apenas essa simulação específica é aprovada e as demais permanecem com status não-aprovado

---

### User Story 2 - Efetuar Retirada do Valor da Reserva (Priority: P2)

Após aprovar uma simulação de empréstimo, o usuário deseja retirar efetivamente o valor aprovado da sua reserva de emergência, tornando o empréstimo real e disponibilizando os fundos para uso.

**Why this priority**: Esta é a execução concreta do empréstimo. Sem esta funcionalidade, a aprovação seria apenas um registro sem impacto real. É essencial para completar o ciclo de empréstimo, mas depende da aprovação (P1) para existir.

**Independent Test**: Pode ser testado aprovando primeiro uma simulação (prerequisite) e então executando a retirada. O valor entregue é a transferência real dos fundos da reserva para disponibilidade do usuário.

**Acceptance Scenarios**:

1. **Given** um usuário possui uma simulação com estado "aprovada" e sua reserva de emergência tem saldo suficiente, **When** o usuário solicita retirar o valor aprovado, **Then** o sistema deduz o valor da reserva de emergência, credita o mesmo valor no saldo disponível/corrente da conta (separado da reserva), altera o estado da simulação para "concluída", cria registros de transação e retorna confirmação com ambos os saldos atualizados

2. **Given** um usuário tenta retirar valor de uma simulação, **When** a simulação tem estado "não aprovada" ou "concluída" (já foi retirada), **Then** o sistema retorna erro indicando que apenas simulações com estado "aprovada" podem ter valores retirados

3. **Given** um usuário possui uma simulação aprovada, **When** a reserva de emergência tem saldo insuficiente no momento da retirada, **Then** o sistema retorna erro indicando saldo insuficiente e não executa a transação

4. **Given** um usuário já retirou o valor de uma simulação (estado "concluída"), **When** o usuário tenta retirar novamente da mesma simulação, **Then** o sistema retorna erro indicando que a simulação já está concluída e o valor já foi retirado

5. **Given** um usuário solicita retirada de valor, **When** ocorre uma falha durante a transação, **Then** o sistema reverte todas as alterações (rollback) e mantém a integridade dos saldos, retornando erro adequado

6. **Given** um usuário possui uma simulação aprovada mas a reserva foi reduzida após a aprovação, **When** o usuário tenta retirar e a retirada excederia o limite de 70% da reserva atual, **Then** o sistema rejeita a retirada com erro informando que o limite seria excedido e a reserva não possui mais saldo suficiente

---

### User Story 3 - Consultar Histórico de Aprovações e Retiradas (Priority: P3)

Um usuário deseja visualizar o histórico completo de suas simulações aprovadas e retiradas realizadas, incluindo datas, valores e status atuais para acompanhamento financeiro.

**Why this priority**: Fornece transparência e rastreabilidade para o usuário. É importante para gestão financeira pessoal, mas não é essencial para o fluxo principal de aprovação e retirada. Pode ser implementado posteriormente se necessário.

**Independent Test**: Pode ser testado criando algumas simulações, aprovando e retirando valores, e então consultando o histórico. O valor entregue é a visibilidade completa das operações realizadas.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado possui simulações aprovadas e retiradas, **When** o usuário solicita seu histórico de empréstimos, **Then** o sistema retorna lista ordenada por data (mais recente primeiro) contendo ID da simulação, data de aprovação, valor aprovado, estado atual (aprovada/concluída) e data da retirada (se estado for "concluída")

2. **Given** um usuário solicita histórico, **When** existem muitas simulações, **Then** o sistema retorna resultados paginados com limite padrão de 50 itens e permite navegação entre páginas

3. **Given** um usuário novo sem simulações, **When** o usuário solicita histórico, **Then** o sistema retorna lista vazia sem erros

---

### Edge Cases

- **Concorrência**: O que acontece se dois processos tentarem retirar da mesma reserva simultaneamente? O sistema deve usar transações atômicas e locks de banco de dados para prevenir dupla retirada.

- **Reserva insuficiente após aprovação**: Se a reserva de emergência for reduzida (por outra operação) entre a aprovação e a tentativa de retirada, o sistema revalida o limite de 70% no momento da retirada e rejeita a operação se o saldo atual não permitir, retornando erro descritivo informando que a reserva foi modificada e não há mais saldo suficiente.

- **Simulação expirada**: Simulações criadas há mais de 30 dias não podem ser aprovadas. O sistema deve validar a data de criação e rejeitar aprovações de simulações expiradas, exigindo que o usuário crie uma nova simulação se desejar prosseguir.

- **Cancelamento de aprovação**: Aprovações são definitivas e não podem ser canceladas. Se o usuário mudar de ideia após aprovar uma simulação, ele simplesmente não executa a retirada. A simulação permanecerá no estado "aprovada mas não retirada" indefinidamente.

- **Limites de retirada**: Não existem limites adicionais de frequência ou valor para retiradas além do limite de 70% da reserva total. Usuários podem retirar qualquer valor aprovado a qualquer momento, respeitando apenas o limite global de 70%.

- **Múltiplas aprovações simultâneas**: Se o usuário aprovar múltiplas simulações que somadas excedem 70% da reserva, o sistema valida na aprovação considerando todos os empréstimos ativos existentes. Na retirada, revalida novamente, garantindo que mesmo com múltiplas aprovações, apenas retiradas que respeitem o limite de 70% no momento da execução serão permitidas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sistema MUST permitir que usuários aprovem uma simulação de empréstimo existente fornecendo o ID da simulação

- **FR-002**: Sistema MUST validar que a simulação existe e pertence ao usuário autenticado antes de permitir aprovação

- **FR-003**: Sistema MUST prevenir aprovação duplicada da mesma simulação, retornando erro se a simulação já tem estado "aprovada" ou "concluída"

- **FR-004**: Sistema MUST registrar data e hora da aprovação e alterar o estado da simulação de "não aprovada" para "aprovada" de forma persistente

- **FR-005**: Sistema MUST permitir que usuários retirem o valor aprovado de uma simulação de sua reserva de emergência

- **FR-006**: Sistema MUST validar que a simulação tem estado "aprovada" antes de permitir retirada de valor, rejeitando retiradas de simulações com estado "não aprovada" ou "concluída"

- **FR-007**: Sistema MUST validar que a reserva de emergência tem saldo suficiente no momento da retirada

- **FR-008**: Sistema MUST executar a retirada como transação atômica, garantindo que débito da reserva de emergência e crédito no saldo disponível/corrente da conta ocorram juntos ou não ocorram

- **FR-008a**: Sistema MUST creditar o valor integral da simulação aprovada no saldo disponível/corrente da conta (separado da reserva de emergência), disponibilizando o valor para uso imediato pelo usuário

- **FR-009**: Sistema MUST prevenir retirada duplicada da mesma simulação, alterando o estado para "concluída" após retirada bem-sucedida e rejeitando tentativas subsequentes de retirada

- **FR-010**: Sistema MUST criar registro de auditoria para cada aprovação de simulação, incluindo usuário, simulação ID, valor e timestamp

- **FR-011**: Sistema MUST criar registro de auditoria para cada retirada realizada, incluindo valores, saldos antes/depois e timestamp

- **FR-012**: Sistema MUST permitir que usuários consultem histórico de simulações aprovadas e retiradas com informações de data, valor e status

- **FR-013**: Sistema MUST retornar erros descritivos para todas as validações falhas (simulação não encontrada, não aprovada, saldo insuficiente, já retirado, etc.)

- **FR-014**: Sistema MUST calcular e validar que o total de empréstimos ativos (aprovados mas não totalmente quitados) mais o valor da nova simulação não excede o limite de 70% da reserva de emergência no momento da aprovação, rejeitando a aprovação se o limite for excedido

- **FR-015**: Sistema MUST usar locks ou transações otimistas para prevenir condições de corrida em aprovações e retiradas concorrentes

- **FR-016**: Sistema MUST validar que a simulação foi criada há menos de 30 dias antes de permitir aprovação, rejeitando simulações expiradas com mensagem de erro adequada

- **FR-017**: Sistema MUST NOT permitir cancelamento de aprovações - aprovações são definitivas e irreversíveis (independentemente de ter ocorrido retirada ou não)

- **FR-018**: Sistema MUST implementar aprovação e retirada como duas operações separadas e independentes - usuário aprova primeiro e depois escolhe quando executar a retirada, sem prazo obrigatório entre as operações

- **FR-019**: Sistema MUST revalidar o limite de 70% da reserva de emergência no momento da retirada, verificando se o saldo atual da reserva ainda permite a retirada do valor aprovado, e rejeitando a operação se o limite for excedido

- **FR-020**: Sistema MUST manter o estado da simulação ao longo de seu ciclo de vida usando três estados distintos: "não aprovada" (estado inicial), "aprovada" (após aprovação, pendente retirada), e "concluída" (após retirada executada com sucesso)

### Key Entities

- **Simulação de Empréstimo Aprovada**: Representa uma simulação que foi formalmente aprovada pelo usuário. Atributos incluem: ID da simulação original, data de aprovação, estado (não aprovada/aprovada/concluída), data de retirada (se aplicável), usuário aprovador. Relaciona-se com LoanSimulation existente. Estados: "não aprovada" (padrão), "aprovada" (após aprovação, pendente retirada), "concluída" (após retirada executada).

- **Retirada de Empréstimo**: Representa a transação de retirada efetiva do valor da reserva. Atributos incluem: ID da simulação aprovada, valor retirado, data da retirada, saldo da reserva antes/depois, saldo disponível/corrente antes/depois, ID da transação. Relaciona-se com Account (reserva de emergência e saldo disponível) e ApprovedSimulation.

- **Registro de Auditoria de Empréstimo**: Rastreia todas as ações relacionadas a aprovações e retiradas. Atributos incluem: tipo de evento (aprovação/retirada/cancelamento), timestamp, usuário, simulação ID, valores envolvidos, resultado da operação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuários conseguem aprovar uma simulação de empréstimo em menos de 5 segundos após solicitar a aprovação

- **SC-002**: Sistema previne 100% das tentativas de dupla retirada do mesmo empréstimo através de validações e controles de concorrência

- **SC-003**: Sistema garante integridade financeira em 100% das operações, sem discrepâncias entre saldo da reserva e registros de retirada

- **SC-004**: Usuários recebem confirmação imediata (menos de 3 segundos) após retirada bem-sucedida com novo saldo atualizado

- **SC-005**: Sistema registra auditoria completa de 100% das aprovações e retiradas para compliance e rastreabilidade

- **SC-006**: Histórico de empréstimos carrega em menos de 2 segundos para usuários com até 100 simulações

- **SC-007**: Taxa de erro em retiradas por problemas técnicos é inferior a 0.1% (excluindo erros de validação de negócio como saldo insuficiente)

- **SC-008**: 95% dos usuários completam o fluxo completo (aprovar → retirar) em sua primeira tentativa sem erros não esperados

## Assumptions & Constraints

### Assumptions

- **A-001**: Simulações expiram após 30 dias da criação e não podem mais ser aprovadas após esse período

- **A-002**: Aprovações são definitivas e irreversíveis - simulações aprovadas não podem ser canceladas ou desaprovadas em nenhuma circunstância (com ou sem retirada executada)

- **A-003**: Assumimos que não há limite de quantidade de simulações que podem ser aprovadas simultaneamente, apenas limite de 70% do valor total da reserva

- **A-004**: Assumimos que a reserva de emergência usada é sempre a reserva padrão do usuário (cada usuário possui uma única reserva de emergência principal)

- **A-005**: Assumimos que usuários não podem editar uma simulação após criação - devem criar nova simulação se desejarem parâmetros diferentes

- **A-006**: Assumimos que retiradas são sempre do valor integral da simulação aprovada - não há retiradas parciais

- **A-007**: Não existem limites adicionais de frequência (diário/mensal) ou valor para retiradas além do limite global de 70% da reserva total

- **A-008**: Cada conta possui dois saldos distintos: reserva de emergência (origem do empréstimo) e saldo disponível/corrente (destino do empréstimo, usado para operações do dia a dia)

- **A-009**: Não há prazo máximo entre aprovação e retirada - usuário pode aprovar uma simulação e executar a retirada imediatamente ou postergar para qualquer momento futuro conforme sua necessidade

- **A-010**: Todas as simulações criadas pelo módulo existente de LoanSimulation iniciam com estado implícito "não aprovada" até que sejam explicitamente aprovadas pelo usuário

### Constraints

- **C-001**: Limite técnico existente: máximo de 70% da reserva pode ser usado para empréstimos conforme `LOAN_SIMULATION_MAX_RESERVE_USAGE_PERCENT`

- **C-002**: Simulações só podem ser aprovadas pelo próprio usuário que as criou (não há aprovação por terceiros/administradores)

- **C-003**: Sistema deve manter histórico completo de auditoria por requisitos de compliance financeiro

- **C-004**: Retiradas devem ser transações atômicas para garantir consistência financeira

## Dependencies

- **D-001**: Depende do módulo existente de LoanSimulation para buscar simulações criadas

- **D-002**: Depende do AccountService existente para acessar e modificar saldo da reserva de emergência

- **D-003**: Depende do AuditEventService existente para registrar eventos de auditoria

- **D-004**: Depende do sistema de autenticação existente para validar identidade do usuário

- **D-005**: Depende do Prisma ORM e banco de dados para persistência transacional

## Out of Scope

- **OS-001**: Quitação ou pagamento de parcelas do empréstimo (será feature futura separada)

- **OS-002**: Cálculo de juros sobre empréstimos ativos (usa valores já calculados na simulação)

- **OS-003**: Renegociação de termos de empréstimo aprovado

- **OS-004**: Aprovação por múltiplos aprovadores ou workflow de aprovação complexo

- **OS-005**: Notificações por email/SMS de aprovações ou retiradas

- **OS-006**: Interface de administrador para gerenciar aprovações de usuários

- **OS-007**: Relatórios analíticos sobre empréstimos aprovados (além do histórico básico do usuário)

- **OS-008**: Cancelamento ou reversão de aprovações de simulações
