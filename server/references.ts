// Resolve positions from the user's words, never from an invented model ID.
// This parses references only; intent and search filters are decided by the LLM.
export function ordinalReferences(message: string): number[] {
  const text = message.toLocaleLowerCase("tr-TR");
  const firstN = text.match(/ilk\s+(iki|üç|dört|[234])/u);
  if (firstN) {
    const n =
      ({ iki: 2, üç: 3, dört: 4 } as Record<string, number>)[firstN[1]] ??
      Number(firstN[1]);
    return Array.from({ length: n }, (_, i) => i + 1);
  }
  const patterns = [
    "(?:ilk|birinci)",
    "ikinci",
    "üçüncü",
    "dördüncü",
    "beşinci",
    "altıncı",
    "yedinci",
    "sekizinci",
  ];
  const matches: { index: number; position: number }[] = [];
  patterns.forEach((word, i) => {
    const pattern = new RegExp(`(?:^|[^\\p{L}])${word}\\p{L}*`, "gu");
    for (const match of text.matchAll(pattern))
      matches.push({ index: i + 1, position: match.index ?? 0 });
  });
  for (const match of text.matchAll(/(?:^|\s)([1-8])\.\s*(?:ürün|laptop)/gu))
    matches.push({ index: Number(match[1]), position: match.index ?? 0 });
  return [
    ...new Set(
      matches.sort((a, b) => a.position - b.position).map((m) => m.index),
    ),
  ];
}
