// Per-viewer UI conveniences; storage may be unavailable, so every access is guarded.
export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the preference just isn't remembered
  }
}
