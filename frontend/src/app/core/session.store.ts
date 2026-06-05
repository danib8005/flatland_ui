import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { WebSocketService } from './websocket.service';
import { AgentDTO, RailTile, SessionInfo, SessionState, PolicyName } from './models';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private api = inject(ApiService);
  private ws = inject(WebSocketService);

  readonly session = signal<SessionInfo | null>(null);
  readonly state = signal<SessionState | null>(null);
  readonly selectedHandles = signal<Set<number>>(new Set());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  readonly playing = signal(false);
  readonly playSpeed = signal(5);
  readonly wsConnected = computed(() => this.ws.connected());

  readonly agents = computed<AgentDTO[]>(() => this.state()?.agents ?? []);
  readonly elapsedSteps = computed(() => this.state()?.elapsed_steps ?? 0);
  readonly maxSteps = computed(() => this.state()?.max_episode_steps ?? 0);
  readonly width = computed(() => this.state()?.width ?? 0);
  readonly height = computed(() => this.state()?.height ?? 0);
  readonly railGrid = computed<number[][]>(() => this.state()?.rail_grid ?? []);
  readonly railTiles = computed<RailTile[]>(() => this.state()?.rail_tiles ?? []);
  readonly episodeDone = computed(() => this.state()?.episode_done ?? false);

  constructor() {
    effect(() => {
      const msg = this.ws.lastMessage();
      if (!msg) return;

      if (msg.type === 'state' && msg.state) {
        this.state.set(msg.state);
        this.loading.set(false);
      } else if (msg.type === 'episode_done') {
        this.playing.set(false);
        this.message.set('Episode finished. Use Reset to start again.');
        this.refreshState();
      } else if (msg.type === 'error') {
        this.error.set(msg.message ?? 'Unknown WebSocket error');
        this.playing.set(false);
      }
    });
  }

  newSession() {
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.playing.set(false);
    this.api.createSession({}).subscribe({
      next: (s) => {
        this.session.set(s);
        this.ws.connect(s.id);
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

  step(policy: PolicyName, n_steps: number = 1) {
    const s = this.session();
    if (!s) return;
    if (this.episodeDone()) {
      this.message.set('Episode finished. Use Reset to start again.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.step(s.id, policy, n_steps).subscribe({
      next: (res) => {
        if (res.message) this.message.set(res.message);
        this.refreshState();
      },
      error: (e) => {
        this.error.set(`Step failed: ${e.message}`);
        this.loading.set(false);
      },
    });
  }

  reset() {
    const s = this.session();
    if (!s) return;
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.playing.set(false);
    this.api.reset(s.id).subscribe({
      next: () => this.refreshState(),
      error: (e) => {
        this.error.set(`Reset failed: ${e.message}`);
        this.loading.set(false);
      },
    });
  }

  play(policy: PolicyName, speed: number = 5) {
    const s = this.session();
    if (!s) return;
    if (this.episodeDone()) {
      this.message.set('Episode finished. Use Reset before Play.');
      return;
    }
    this.playSpeed.set(speed);
    this.api.play(s.id, { speed, policy }).subscribe({
      next: () => {
        this.playing.set(true);
        this.error.set(null);
      },
      error: (e) => {
        this.error.set(`Play failed: ${e.message}`);
      },
    });
  }

  pause() {
    const s = this.session();
    if (!s) return;
    this.api.pause(s.id).subscribe({
      next: () => {
        this.playing.set(false);
      },
      error: (e) => {
        this.error.set(`Pause failed: ${e.message}`);
      },
    });
  }

  togglePlay(policy: PolicyName, speed: number = 5) {
    if (this.playing()) {
      this.pause();
    } else {
      this.play(policy, speed);
    }
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
