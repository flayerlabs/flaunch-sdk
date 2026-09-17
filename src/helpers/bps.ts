/**
 * A percentage string or number ("2.5", 0.01) to integer basis points. At most two decimals —
 * finer than 0.01% cannot be represented and is rejected rather than rounded.
 */
export function percentToBps(percent: string | number): number {
  const text = typeof percent === "number" ? String(percent) : percent.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) {
    throw new Error(
      "Percentage must be a non-negative decimal with at most two decimal places"
    );
  }
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  return whole * 100 + fraction;
}
