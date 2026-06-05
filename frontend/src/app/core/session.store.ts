import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AgentDTO, SessionInfo, SessionState } from './models';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private api = inject(ApiService);

  readonly session = signal<SessionInfo | null>(null);
  readonly state = signal<SessionState | null>(null);
  readonly selectedHandles = signal<Set<number>>(new Set());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly agents = computed<AgentDTO[]>(() => this.state()?.agents ?? []);
  readonly elapsedSteps = computed(() => this.state()?.elapsed_steps ?? 0);
  readonly maxSteps = computed(() => this.state()?.max_episode_steps ?? 0);
  readonly width = computed(() => this.state()?.width ?? 0);
  readonly height = computed(() => this.state()?.height ?? 0);
  readonly railGrid = computed<number[][]>(() => this.state()?.rail_grid ?? []);

  newSession() {
    this.loading.set(true);
    this.error.set(null);
    this.api.createSession({}).subscribe({
      next: (s) => {
        this.session.set(s);
        this.refreshState();
      },
      error: (e) => {
        this.error.set(`Create failed: ${e.message}`);
        this.loading.set(false);
      },
    });
  }

  refreshState() {
    const s = this.session();
    if (!s) return;
    this.api.getState(s.id).subscribe({
      next: (st) => {
        this.state.set(st);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(`State failed: ${e.message}`);
        this.loading.set(false);
      },
    });
  }

  step(policy: 'random' | 'shortest_path', n_steps: number = 1) {
    const s = this.session();
    if (!s) return;
    this.loading.set(true);
    this.api.step(s.id, policy, n_steps).subscribe({
      next: () => this.refreshState(),
      error: (e) => {
        this.error.set(`Step failed: ${e.message}`);
        this.loading.set(false);
      },
    });
  }

  toggleAgentSelection(handle: number) {
    const cur = new Set(this.selectedHandles());
    if (cur.has(handle)) cur.delete(handle);
    else cur.add(handle);
    this.selectedHandles.set(cur);
  }

  clearSelection() {
    this.selectedHandles.set(new Set());
  }
}
