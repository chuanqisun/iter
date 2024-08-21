export function setJson(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getJson<T = any>(key: string): T | null {
  try {
    const stringValue = localStorage.getItem(key);
    return stringValue ? JSON.parse(stringValue) : null;
  } catch {
    return null;
  }
}

export function ensureJson(key: string, validate: (maybeValue: any) => boolean, getInitial: () => any) {
  const maybeValue = getJson(key);
  if (!validate(maybeValue)) {
    console.log(`Invalid JSON value for key "${key}". Value is reset.`);
    setJson(key, getInitial());
  }
}
