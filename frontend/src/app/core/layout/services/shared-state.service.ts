import { Injectable, Signal, computed, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SharedStateService {
  private readonly state = signal<Record<string, unknown>>({});

  readonly snapshot = computed(() => this.state());

  set<TValue>(key: string, value: TValue): void {
    this.state.update((current) => ({
      ...current,
      [key]: value,
    }));
  }

  get<TValue>(key: string): TValue | undefined {
    return this.state()[key] as TValue | undefined;
  }

  select<TValue>(key: string): Signal<TValue | undefined> {
    return computed(() => this.state()[key] as TValue | undefined);
  }

  remove(key: string): void {
    this.state.update((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  clear(): void {
    this.state.set({});
  }
}
