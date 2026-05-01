const PREFIX = 'qm:handoff:';

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function stashHandoff(description: string): string {
  const key = uuid();
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(PREFIX + key, description);
  }
  return key;
}

export function popHandoff(key: string): string | null {
  if (typeof window === 'undefined') return null;
  const value = window.sessionStorage.getItem(PREFIX + key);
  if (value !== null) {
    window.sessionStorage.removeItem(PREFIX + key);
  }
  return value;
}
