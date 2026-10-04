export function parseDuration(input: string): number | null {
  const normalizedInput = input.trim().toLowerCase();
  if (!normalizedInput) return 0;
  if (/^\d+(\.\d+)?$/.test(normalizedInput)) return Math.round(Number(normalizedInput));

  // A trailing number after hours conventionally means minutes: "1h30".
  const value = normalizedInput.replace(/^(\d+)\s*h\s*([0-5]?\d)$/, "$1h $2m");
  const matches = [...value.matchAll(/(\d+(?:\.\d+)?)\s*([dhm])/g)];
  const matchedText = matches.map((match) => match[0]).join("").replace(/\s/g, "");
  if (matches.length === 0 || matchedText !== value.replace(/\s/g, "")) return null;

  const minutes = matches.reduce((total, match) => {
    const amount = Number(match[1]);
    const unit = match[2];
    if (unit === "d") return total + amount * 24 * 60;
    if (unit === "h") return total + amount * 60;
    return total + amount;
  }, 0);

  return Math.max(0, Math.round(minutes));
}

export function formatDuration(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  if (safeMinutes === 0) return "0m";
  const days = Math.floor(safeMinutes / 1440);
  const hours = Math.floor((safeMinutes % 1440) / 60);
  const minutes = safeMinutes % 60;
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", minutes ? `${minutes}m` : ""].filter(Boolean).join(" ");
}
