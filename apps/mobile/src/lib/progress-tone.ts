/** Danger reads from color the moment a budget/goal nears its limit, not only once it's over. */
export function progressTone(
  ratio: number,
  over: boolean,
): "default" | "danger" {
  return over || ratio >= 0.9 ? "danger" : "default";
}
