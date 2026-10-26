import "server-only";

/**
 * How « Essayer la démo » signs a visitor in: the demo account's e-mail
 * and password, from the environment. Unset, the site offers no demo and
 * `/demo` sends the visitor to sign up instead.
 */
export function demoCredentials(): { email: string; password: string } | null {
  const email = process.env.DEMO_EMAIL?.trim();
  const password = process.env.DEMO_PASSWORD?.trim();
  return email && password ? { email, password } : null;
}

export function demoAvailable(): boolean {
  return demoCredentials() !== null;
}
