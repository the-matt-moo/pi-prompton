const MAX_HISTORY = 10;

export interface HistoryEntry {
  draft: string;
  timestamp: number;
}

export class UndoManager {
  private readonly history: HistoryEntry[] = [];

  constructor(private readonly isEnabled: () => boolean = () => true) {}

  store(draft: string): void {
    if (!this.isEnabled()) return;

    this.history.push({ draft, timestamp: Date.now() });
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
  }

  hasUndo(): boolean {
    return this.isEnabled() && this.history.length > 0;
  }

  consume(): string | undefined {
    if (!this.isEnabled()) return undefined;

    const entry = this.history.pop();
    return entry?.draft;
  }

  getHistory(): HistoryEntry[] {
    return this.isEnabled() ? [...this.history] : [];
  }

  clear(): void {
    this.history.length = 0;
  }
}
