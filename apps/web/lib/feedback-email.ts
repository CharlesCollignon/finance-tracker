/**
 * The address « Envoyer un retour » writes to (`FEEDBACK_EMAIL`), if the
 * deployment has one and it looks like an address; for the about page's
 * « M'écrire » and the guides' « Nous écrire ».
 */
export function feedbackEmail(): string | null {
  const value = process.env.FEEDBACK_EMAIL?.trim();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}
