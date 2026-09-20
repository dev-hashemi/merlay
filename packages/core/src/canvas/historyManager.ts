/**
 * Pure HistoryManager supporting bounded undo/redo stacks.
 */
export class HistoryManager<T> {
  private past: T[] = [];
  private future: T[] = [];
  private present: T;
  private maxDepth: number;

  constructor(initial: T, maxDepth: number = 50) {
    this.present = initial;
    this.maxDepth = maxDepth;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get state(): T {
    return this.present;
  }

  push(next: T): void {
    if (next === this.present) return;
    this.past.push(this.present);
    if (this.past.length > this.maxDepth) {
      this.past.shift();
    }
    this.present = next;
    this.future = [];
  }

  undo(): T | null {
    if (this.past.length === 0) return null;
    const prev = this.past.pop()!;
    this.future.push(this.present);
    this.present = prev;
    return prev;
  }

  redo(): T | null {
    if (this.future.length === 0) return null;
    const next = this.future.pop()!;
    this.past.push(this.present);
    this.present = next;
    return next;
  }

  reset(initial: T): void {
    this.past = [];
    this.future = [];
    this.present = initial;
  }
}
