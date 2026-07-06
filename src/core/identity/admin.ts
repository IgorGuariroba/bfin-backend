/**
 * Admin = User cujo email está na lista configurada (CONTEXT.md › Admin).
 * A lista vem de env var (ADMIN_EMAILS) — ler o ambiente é papel do adapter;
 * aqui entra já parseada, em lowercase ou não (a comparação normaliza).
 */
export function isAdminEmail(
  email: string | null | undefined,
  adminEmails: string[],
): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase();
  return adminEmails.some((admin) => admin.toLowerCase() === normalized);
}
