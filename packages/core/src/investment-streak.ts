/**
 * How many months running money has gone into the placements — the
 * Placements summary's moment, in the app's sense: a fact worth noticing,
 * not a score.
 *
 * A month counts when it holds at least one contribution. The month in
 * progress counts once it has one, and is not held against the run before
 * it does: a DCA on the 27th has not failed on the 4th.
 */
export function contributionStreak(
  contributions: readonly { occurred_on: string; amount: number | string }[],
  today: string,
): number {
  const months = new Set(
    contributions
      .filter((row) => Number(row.amount) > 0)
      .map((row) => row.occurred_on.slice(0, 7)),
  );

  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7));
  const key = () => `${year}-${String(month).padStart(2, "0")}`;
  const back = () => {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  };

  if (!months.has(key())) {
    back();
  }
  let streak = 0;
  while (months.has(key())) {
    streak += 1;
    back();
  }
  return streak;
}
