export type ShortcutIntent = "commands" | "help" | "submit";

type KeyEvent = Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing" | "repeat">;

/** Modifier-only shortcuts leave typing, IME composition, and browser shortcuts alone. */
export function shortcutIntent(event: KeyEvent): ShortcutIntent | null {
  if (event.isComposing || event.repeat || event.altKey || event.shiftKey || event.ctrlKey === event.metaKey) return null;
  if (event.code === "KeyK" || event.key.toLowerCase() === "k") return "commands";
  if (event.code === "Slash" || event.key === "/") return "help";
  if (event.code === "Enter" || event.code === "NumpadEnter" || event.key === "Enter") return "submit";
  return null;
}

export function nextOptionIndex(index: number, count: number, key: string): number {
  if (count === 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowUp") return index <= 0 ? count - 1 : index - 1;
  return index < 0 || index >= count - 1 ? 0 : index + 1;
}
