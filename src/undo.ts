const MAX_HISTORY = 10;

export interface HistoryEntry {
  draft: string;
  timestamp: number;
}

export class UndoManager {
  private readonly history: HistoryEntry[] = [];

  store(draft: string): void {
    this.history.push({ draft, timestamp: Date.now() });
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
  }

  hasUndo(): boolean {
    return this.history.length > 0;
  }

  consume(): string | undefined {
    const entry = this.history.pop();
    return entry?.draft;
  }

  getHistory(): HistoryEntry[] {
    return [...this.history];
  }

  clear(): void {
    this.history.length = 0;
  }
}
