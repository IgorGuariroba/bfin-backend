// Tipo de domínio próprio (ADR-0013): escrito à mão, não derivado do client do ORM.
// Espelha as colunas persistidas — as rotas serializam este objeto inteiro.
export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string;
  isSystem: boolean;
}
