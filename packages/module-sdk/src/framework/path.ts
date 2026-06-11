const readPathSegments = (path: string): string[] =>
  path
    .replaceAll('[', '.')
    .replaceAll(']', '')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

export const isMutableRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const setByPath = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const segments = readPathSegments(path);
  if (segments.length === 0) {
    return;
  }
  let current = target;
  for (const segment of segments.slice(0, -1)) {
    if (!isMutableRecord(current[segment])) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }
  const lastSegment = segments[segments.length - 1];
  if (lastSegment) {
    current[lastSegment] = value;
  }
};

export const mergeByPath = (target: Record<string, unknown>, path: string, value: Record<string, unknown>): void => {
  const existing = getByPath(target, path);
  setByPath(target, path, {
    ...(isMutableRecord(existing) ? existing : {}),
    ...value,
  });
};

export const pushByPath = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const existing = getByPath(target, path);
  if (Array.isArray(existing)) {
    existing.push(value);
    return;
  }
  setByPath(target, path, existing === undefined ? [value] : [existing, value]);
};

export const getByPath = (target: Record<string, unknown>, path: string): unknown => {
  let current: unknown = target;
  for (const segment of readPathSegments(path)) {
    if (!isMutableRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
};
