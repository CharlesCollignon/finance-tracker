/**
 * The arithmetic Ask Pluclair's model is handed instead of doing sums in its
 * head (`./ask-chat`): a sum, a difference, a share, a compounding — anything
 * a calculator does, and nothing a program does.
 *
 * A small recursive-descent reader rather than `eval`: numbers, the four
 * operations, powers, parentheses, a unary minus, and a handful of named
 * functions. Anything else, and there is no result.
 */

/** Longest expression taken, as sent. */
const MAX_EXPRESSION = 400;

/** How deep parentheses may nest, against a pathological expression. */
const MAX_DEPTH = 32;

const FUNCTIONS: Record<string, (args: number[]) => number | null> = {
  round: ([value, digits = 0]) =>
    value === undefined
      ? null
      : Math.round(value * 10 ** digits) / 10 ** digits,
  min: (args) => (args.length > 0 ? Math.min(...args) : null),
  max: (args) => (args.length > 0 ? Math.max(...args) : null),
  abs: ([value]) => (value === undefined ? null : Math.abs(value)),
  sqrt: ([value]) =>
    value === undefined || value < 0 ? null : Math.sqrt(value),
};

class Unreadable extends Error {}

/**
 * The expression's value, or null when it is not arithmetic, divides by
 * zero, or comes to something that is not a finite number. Commas are
 * argument separators; a decimal is written with a point.
 */
export function calculate(expression: string): number | null {
  if (expression.length === 0 || expression.length > MAX_EXPRESSION) {
    return null;
  }
  const tokens = tokenize(expression);
  if (!tokens) {
    return null;
  }
  let at = 0;
  let depth = 0;

  const peek = () => tokens[at];
  const take = () => tokens[at++];
  const expect = (value: string) => {
    if (take() !== value) {
      throw new Unreadable();
    }
  };

  // sum := product (("+" | "-") product)*
  function sum(): number {
    let value = product();
    while (peek() === "+" || peek() === "-") {
      const op = take();
      const right = product();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  // product := power (("*" | "/" | "%") power)*
  function product(): number {
    let value = power();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = take();
      const right = power();
      if ((op === "/" || op === "%") && right === 0) {
        throw new Unreadable();
      }
      value =
        op === "*" ? value * right : op === "/" ? value / right : value % right;
    }
    return value;
  }

  // power := unary ("^" power)?   — right-associative: 2^3^2 is 2^9.
  function power(): number {
    const base = unary();
    if (peek() === "^") {
      take();
      return base ** power();
    }
    return base;
  }

  // unary := "-" unary | "+" unary | atom
  function unary(): number {
    if (peek() === "-") {
      take();
      return -unary();
    }
    if (peek() === "+") {
      take();
      return unary();
    }
    return atom();
  }

  // atom := number | name "(" sum ("," sum)* ")" | "(" sum ")"
  function atom(): number {
    const token = take();
    if (token === undefined) {
      throw new Unreadable();
    }
    if (token === "(") {
      if (++depth > MAX_DEPTH) {
        throw new Unreadable();
      }
      const value = sum();
      expect(")");
      depth -= 1;
      return value;
    }
    if (/^\d/.test(token) || token.startsWith(".")) {
      return Number(token);
    }
    const fn = FUNCTIONS[token];
    if (!fn) {
      throw new Unreadable();
    }
    expect("(");
    if (++depth > MAX_DEPTH) {
      throw new Unreadable();
    }
    const args = [sum()];
    while (peek() === ",") {
      take();
      args.push(sum());
    }
    expect(")");
    depth -= 1;
    const value = fn(args);
    if (value === null) {
      throw new Unreadable();
    }
    return value;
  }

  try {
    const value = sum();
    if (at !== tokens.length || !Number.isFinite(value)) {
      return null;
    }
    return value;
  } catch (error) {
    if (error instanceof Unreadable) {
      return null;
    }
    throw error;
  }
}

/** The expression's tokens, or null on a character that has no place in it. */
function tokenize(expression: string): string[] | null {
  const tokens: string[] = [];
  const pattern =
    /\s*(?:(\d+(?:\.\d+)?(?:e[+-]?\d+)?|\.\d+)|([a-z]+)|([-+*/%^(),]))/giy;
  let match: RegExpExecArray | null;
  let last = 0;
  while ((match = pattern.exec(expression)) !== null) {
    if (match[0].length === 0) {
      break;
    }
    tokens.push((match[1] ?? match[2]?.toLowerCase() ?? match[3])!);
    last = pattern.lastIndex;
  }
  return expression.slice(last).trim() === "" && tokens.length > 0
    ? tokens
    : null;
}
