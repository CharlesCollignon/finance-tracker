/**
 * A statement dropped on another page, held for the import page that the
 * drop opens (`StatementDropTarget`): in memory, for the one navigation
 * between them, and taken once.
 */
let held: File | null = null;

export function holdStatementFile(file: File): void {
  held = file;
}

export function takeStatementFile(): File | null {
  const file = held;
  held = null;
  return file;
}
