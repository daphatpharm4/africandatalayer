export interface CategorySetDiff {
  expected: string[];
  actual: string[];
  missing: string[];
  extra: string[];
  ok: boolean;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))).sort((a, b) => a.localeCompare(b));
}

export function parseConstraintCategories(definition: string | null | undefined): string[] {
  if (typeof definition !== "string" || definition.trim().length === 0) return [];
  const values: string[] = [];
  const regex = /'((?:[^']|'')+)'/g;
  let match: RegExpExecArray | null = regex.exec(definition);
  while (match) {
    const value = (match[1] ?? "").replace(/''/g, "'").trim();
    if (value.length > 0) values.push(value);
    match = regex.exec(definition);
  }
  return uniqueSorted(values);
}

export function diffCategorySets(expected: string[], actual: string[]): CategorySetDiff {
  const normalizedExpected = uniqueSorted(expected);
  const normalizedActual = uniqueSorted(actual);
  const expectedSet = new Set(normalizedExpected);
  const actualSet = new Set(normalizedActual);

  const missing = normalizedExpected.filter((value) => !actualSet.has(value));
  const extra = normalizedActual.filter((value) => !expectedSet.has(value));

  return {
    expected: normalizedExpected,
    actual: normalizedActual,
    missing,
    extra,
    ok: missing.length === 0 && extra.length === 0,
  };
}
