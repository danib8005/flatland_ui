import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ApiService } from './api.service';
import {
  AppNotification,
  KpiPriorities,
  LayerVisibility,
  Recommendation,
  ScenarioOption,
} from './events/event-types';
import { WebSocketService } from './websocket.service';
import { AgentDTO, PolicyInfo, PolicyName, RailTile, SessionInfo, SessionState } from './models';

export interface TrajectoryPoint {
  /** First simulation step at this compressed trajectory cell/run. */
  step: number;
  /** Last simulation step still at this same cell/run. */
  endStep?: number;
  /** Number of raw time steps represented by this compressed point. */
  durationSteps?: number;
  /** Backwards-compatible alias used by some UI code. */
  dwellSteps?: number;
  position: [number, number] | null;
  direction: number | null;
  state: string;
}

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private api = inject(ApiService);
  private ws = inject(WebSocketService);

  readonly session = signal<SessionInfo | null>(null);
  readonly state = signal<SessionState | null>(null);
  // Single-selection: at most one agent at a time.
  readonly selectedHandle = signal<number | null>(null);
  readonly enabledScenarioPolicyIds = signal<string[]>([]);
  readonly enabledControlPolicyIds = signal<string[]>([]);

  /** When user hovers a scenario card, store its id here so the Marey
   *  can swap its forecast preview. null = use the active baseline. */
  readonly previewScenarioId = signal<string | null>(null);
  // Backwards-compat: components that still call .has(h) on a Set.
  readonly selectedHandles = computed<Set<number>>(() => {
    const h = this.selectedHandle();
    return h == null ? new Set<number>() : new Set([h]);
  });

  /** Agent handles highlighted because the user hovers an agent-related
   *  notification. This is intentionally separate from selection. */
  readonly notificationHoverHandles = signal<Set<number>>(new Set<number>());

  setNotificationHoverAgents(handles: number[]): void {
    const clean = handles
      .map((h) => Number(h))
      .filter((h) => Number.isFinite(h));
    this.notificationHoverHandles.set(new Set(clean));
  }

  clearNotificationHoverAgents(): void {
    this.notificationHoverHandles.set(new Set<number>());
  }

  /** Cross-view agent hover, used by map/panel/Marey agent hover.
   *  It intentionally shares the same highlight set as notification hover:
   *  hover source differs, visual linked-agent highlight is the same.
   */
  setAgentHoverAgents(handles: number[]): void {
    this.setNotificationHoverAgents(handles);
  }

  setAgentHoverAgent(handle: number): void {
    this.setNotificationHoverAgents([handle]);
  }

  clearAgentHoverAgents(): void {
    this.clearNotificationHoverAgents();
  }
  // 'Active' = explicit selection; when Marey is visible, fall back to
  // the first agent so the inspector can show a default context.
  readonly activeHandle = computed<number | null>(() => {
    const selected = this.selectedHandle();
    if (selected != null) return selected;
    if (!this.showMarey()) return null;
    const ags = this.agents();
    return ags.length > 0 ? ags[0].handle : null;
  });
  readonly loading = signal(false);
  /** When a multi-step request is in flight, this holds the elapsed_steps
   *  value the backend should reach. UI can derive 'steps left' as
   *  (targetStep() - state().elapsed_steps). Reset to null on response. */
  readonly targetStep = signal<number | null>(null);
  private _pollHandle: ReturnType<typeof setInterval> | null = null;
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  readonly playing = signal(false);
  readonly playSpeed = signal(5);
  readonly panResetTrigger = signal(0);
  readonly wsConnected = computed(() => this.ws.connected());

  readonly showMap = signal(true);
  readonly showMarey = signal(false);

  readonly trajectories = signal<Map<number, TrajectoryPoint[]>>(new Map());

  readonly agents = computed<AgentDTO[]>(() => this.state()?.agents ?? []);

  // ── Policies (loaded once at app start) ───────────────────────
  private readonly _policies = signal<PolicyInfo[]>([]);
  readonly availablePolicies = computed<PolicyInfo[]>(() => this._policies());
  readonly defaultPolicy = computed<PolicyName>(() => {
    const def = this._policies().find((p) => p.is_default);
    const first = this._policies()[0];
    return (def?.id ?? first?.id ?? 'deadlock_avoidance') as PolicyName;
  });

  setEnabledScenarioPolicyIds(ids: string[]): void {
    this.enabledScenarioPolicyIds.set([...ids]);
  }

  setEnabledControlPolicyIds(ids: string[]): void {
    this.enabledControlPolicyIds.set([...ids]);
  }

  loadPolicies(): void {
    this.api.listPolicies().subscribe({
      next: (list) => {
        this._policies.set(list);
        if (list.length === 0) return;

        if (this.enabledControlPolicyIds().length === 0) {
          this.enabledControlPolicyIds.set(list.filter((p) => p.show_in_ui).map((p) => p.id));
        }
        if (this.enabledScenarioPolicyIds().length === 0) {
          this.enabledScenarioPolicyIds.set(list.filter((p) => p.supports_scenarios).map((p) => p.id));
        }
        const current = this._activePolicy();
        if (!list.some((p) => p.id === current)) {
          const def = list.find((p) => p.is_default) ?? list[0];
          this._activePolicy.set(def.id as PolicyName);
        }
      },
      error: (err) => console.warn('Failed to load policies', err),
    });
  }
  readonly elapsedSteps = computed(() => this.state()?.elapsed_steps ?? 0);
  readonly maxSteps = computed(() => this.state()?.max_episode_steps ?? 0);
  readonly width = computed(() => this.state()?.width ?? 0);
  readonly height = computed(() => this.state()?.height ?? 0);
  readonly railGrid = computed<number[][]>(() => this.state()?.rail_grid ?? []);
  readonly railTiles = computed<RailTile[]>(() => this.state()?.rail_tiles ?? []);
  readonly episodeDone = computed(() => this.state()?.episode_done ?? false);


  // === HMI-Architektur (Phase A) ===
  readonly simulationTime = signal<number>(0);
  readonly layerVisibility = signal<LayerVisibility>({
    grid: true,
    nextDecisions: true,
    agentTrajectory: true,
    trajectoryCellInfo: true,
    switches: false,
    signals: false,
  });
  readonly kpiPriorities = signal<KpiPriorities>({
    time: 1,
    energy: 0.5,
    platformRouting: 0.5,
    trainRouting: 0.5,
  });
  readonly notifications = signal<AppNotification[]>([]);
  readonly scenarios = signal<ScenarioOption[]>([]);
  readonly recommendations = signal<Recommendation[]>([]);
  readonly focusedElement = signal<{ kind: 'train' | 'switch' | 'signal'; id: string } | null>(null);

  constructor() {
    effect(() => {
      const msg = this.ws.lastMessage();
      if (!msg) return;

      // untracked() verhindert dass Set-Calls hier eine Loop triggern
      untracked(() => {
        if (msg.type === 'state' && msg.state) {
          this.state.set(msg.state);
          this._recordTrajectory(msg.state);
          this.loading.set(false);
        } else if (msg.type === 'episode_done') {
          this.playing.set(false);
          this.message.set('Episode finished. Use Reset to start again.');
        } else if (msg.type === 'error') {
          this.error.set(msg.message ?? 'Unknown WebSocket error');
          this.playing.set(false);
        }
      });
    });
  }

  private _trajectoryPosition(a: AgentDTO): [number, number] | null {
    // Actual in-map position wins.
    if (a.position != null) return a.position;

    // READY_TO_DEPART has no position yet, but visually belongs to its
    // initial position. Duplicate suppression records it at most once.
    if (a.state === 'READY_TO_DEPART') return a.initial_position;

    // WAITING/DONE-without-position/etc. must not create artificial
    // repeated cells in the Marey topology.
    return null;
  }

  private _sameTrajectoryPosition(
    a: [number, number] | null,
    b: [number, number] | null,
  ): boolean {
    if (a == null || b == null) return a == null && b == null;
    return a[0] === b[0] && a[1] === b[1];
  }

  private _recordTrajectory(state: SessionState) {
    const map = this.trajectories();
    const newMap = new Map(map);
    let changed = false;

    const normalizeRun = (
      pt: TrajectoryPoint,
      endStep: number,
      direction: number | null,
      agentState: string,
    ): TrajectoryPoint => {
      const safeEnd = Math.max(pt.endStep ?? pt.step, endStep);
      const duration = Math.max(1, safeEnd - pt.step + 1);

      return {
        ...pt,
        endStep: safeEnd,
        durationSteps: duration,
        dwellSteps: duration,
        direction,
        state: agentState,
      };
    };

    for (const a of state.agents) {
      const list = newMap.get(a.handle) ?? [];
      const lastPt = list.length > 0 ? list[list.length - 1] : null;
      const pos = this._trajectoryPosition(a);

      // No meaningful position: do not append synthetic path cells.
      if (pos == null) {
        continue;
      }

      // Same backend step can arrive more than once via polling/ws.
      // Update the last run metadata for this exact step instead of appending.
      if (lastPt && state.elapsed_steps <= (lastPt.endStep ?? lastPt.step)) {
        const updated = normalizeRun(lastPt, state.elapsed_steps, a.direction, a.state);

        if (
          !this._sameTrajectoryPosition(lastPt.position, pos) ||
          lastPt.direction !== updated.direction ||
          lastPt.state !== updated.state ||
          lastPt.endStep !== updated.endStep ||
          lastPt.durationSteps !== updated.durationSteps ||
          lastPt.dwellSteps !== updated.dwellSteps
        ) {
          newMap.set(a.handle, [...list.slice(0, -1), { ...updated, position: pos }]);
          changed = true;
        }
        continue;
      }

      // Consecutive compression:
      // If agent stays in the same cell because of speed < 1, STOPPED,
      // MALFUNCTION, MALFUNCTION_OFF_MAP, etc., keep exactly one trajectory
      // cell and extend its endStep/duration.
      //
      // Important:
      // Later returning to the same cell creates a NEW run because only the
      // immediately previous point is compared.
      if (lastPt && this._sameTrajectoryPosition(lastPt.position, pos)) {
        const updated = normalizeRun(lastPt, state.elapsed_steps, a.direction, a.state);

        if (
          lastPt.direction !== updated.direction ||
          lastPt.state !== updated.state ||
          lastPt.endStep !== updated.endStep ||
          lastPt.durationSteps !== updated.durationSteps ||
          lastPt.dwellSteps !== updated.dwellSteps
        ) {
          newMap.set(a.handle, [...list.slice(0, -1), updated]);
          changed = true;
        }
        continue;
      }

      // New cell/run starts here.
      newMap.set(a.handle, [
        ...list,
        {
          step: state.elapsed_steps,
          endStep: state.elapsed_steps,
          durationSteps: 1,
          dwellSteps: 1,
          position: pos,
          direction: a.direction,
          state: a.state,
        },
      ]);
      changed = true;
    }

    if (changed) {
      this.trajectories.set(newMap);
    }
  }


  private _resetTrajectories() {
    this.trajectories.set(new Map());
  }

  toggleMap() {
    this.showMap.update((v) => !v);
    if (!this.showMap() && !this.showMarey()) this.showMarey.set(true);
  }

  toggleMarey() {
    this.showMarey.update((v) => !v);
    if (!this.showMap() && !this.showMarey()) this.showMap.set(true);
  }

  private _isAnyAgentMoving(st: SessionState | null): boolean {
    if (!st || st.agents.length === 0) return false;
    return st.agents.some((a) => a.state === 'MOVING');
  }

  private _autoAdvanceUntilFirstAgentReady(maxSteps: number = 300): void {
    const s = this.session();
    if (!s) return;
    const policy = this.activePolicy() || this.defaultPolicy();
    let stepped = 0;

    const run = () => {
      const st = this.state();
      if (!st) {
        this.loading.set(false);
        return;
      }
      if (this._isAnyAgentMoving(st) || st.episode_done || stepped >= maxSteps) {
        this.loading.set(false);
        this.refreshForecasts();
        return;
      }

      this.loading.set(true);
      this.api.step(s.id, policy, 1).subscribe({
        next: () => {
          stepped += 1;
          this.api.getState(s.id).subscribe({
            next: (nextState) => {
              this.state.set(nextState);
              this._recordTrajectory(nextState);
              run();
            },
            error: (e) => {
              this.error.set(`State failed: ${e.message}`);
              this.loading.set(false);
            },
          });
        },
        error: (e) => {
          this.error.set(`Auto-step failed: ${e.message}`);
          this.loading.set(false);
        },
      });
    };

    run();
  }

  newSession(opts: { width?: number; height?: number; agents?: number; maxSteps?: number; seed?: number; maxNumCities?: number; maxRailsBetweenCities?: number; maxRailPairsInCity?: number; latestDepartureMax?: number; speedProfile?: string; lineLength?: number; malfunctionRate?: number; malfunctionMinDuration?: number; malfunctionMaxDuration?: number; scenarioPolicyIds?: string[]; policyControlIds?: string[] } = {}) {
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.playing.set(false);
    this._resetTrajectories();
    const payload: any = {};
    if (opts.width != null) payload.width = opts.width;
    if (opts.height != null) payload.height = opts.height;
    if (opts.agents != null) payload.number_of_agents = opts.agents;
    if (opts.maxSteps != null) payload.max_episode_steps = opts.maxSteps;
    if (opts.seed != null) payload.seed = opts.seed;
    if (opts.maxNumCities != null) payload.max_num_cities = opts.maxNumCities;
    if (opts.maxRailsBetweenCities != null) payload.max_rails_between_cities = opts.maxRailsBetweenCities;
    if (opts.maxRailPairsInCity != null) payload.max_rail_pairs_in_city = opts.maxRailPairsInCity;
    if (opts.latestDepartureMax != null) payload.latest_departure_max = opts.latestDepartureMax;
    if (opts.speedProfile != null) payload.speed_profile = opts.speedProfile;
    if (opts.lineLength != null) payload.line_length = opts.lineLength;
    if (opts.malfunctionRate != null) payload.malfunction_rate = opts.malfunctionRate;
    if (opts.malfunctionMinDuration != null) payload.malfunction_min_duration = opts.malfunctionMinDuration;
    if (opts.malfunctionMaxDuration != null) payload.malfunction_max_duration = opts.malfunctionMaxDuration;
    if (opts.scenarioPolicyIds != null) payload.enabled_scenario_policy_ids = opts.scenarioPolicyIds;
    if (opts.policyControlIds != null) payload.enabled_policy_ids = opts.policyControlIds;
    this.api.createSession(payload).subscribe({
      next: (s) => {
        this.session.set(s);
        if (opts.scenarioPolicyIds != null) {
          this.setEnabledScenarioPolicyIds(opts.scenarioPolicyIds);
        }
        if (opts.policyControlIds != null) {
          this.setEnabledControlPolicyIds(opts.policyControlIds);
        }
        this.ws.connect(s.id);
        this.refreshState(true);
      },
      error: (e) => {
        this.error.set(`Create failed: ${e.message}`);
        this.loading.set(false);
      },
    });
  }

  refreshState(autoAdvanceFirstAgent: boolean = false) {
    const s = this.session();
    if (!s) return;
    this.api.getState(s.id).subscribe({
      next: (st) => {
        this.state.set(st);
        this._recordTrajectory(st);
        if (autoAdvanceFirstAgent) {
          this._autoAdvanceUntilFirstAgentReady();
        } else {
          this.loading.set(false);
        }
      },
      error: (e) => {
        this.error.set(`State failed: ${e.message}`);
        this.loading.set(false);
      },
    });
  }

  step(policy: PolicyName, n_steps: number = 1) {
    this._stepWithPolicy(policy, n_steps, true);
  }

  private _stepWithPolicy(policy: PolicyName, n_steps: number, canRecover: boolean) {
    const s = this.session();
    if (!s) return;
    if (this.episodeDone()) {
      this.message.set('Episode finished. Use Reset to start again.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    // Multi-step: remember the target so the toolbar can show 'N left'.
    const currentElapsed = this.state()?.elapsed_steps ?? 0;
    this.targetStep.set(currentElapsed + n_steps);
    this._stopPolling();
    this._stepSequential(s.id, policy, n_steps, canRecover);
  }

  private _stepSequential(sessionId: string, policy: PolicyName, remaining: number, canRecover: boolean): void {
    if (remaining <= 0) {
      this.targetStep.set(null);
      this.loading.set(false);
      this.refreshForecasts();
      return;
    }

    this.api.step(sessionId, policy, 1).subscribe({
      next: (res) => {
        if (res.message) this.message.set(res.message);
        this.api.getState(sessionId).subscribe({
          next: (st) => {
            this.state.set(st);
            this._recordTrajectory(st);
            if (st.episode_done) {
              this.targetStep.set(null);
              this.loading.set(false);
              this.refreshForecasts();
              return;
            }
            this._stepSequential(sessionId, policy, remaining - 1, false);
          },
          error: (e) => {
            this.error.set(`State failed: ${e.message}`);
            this.targetStep.set(null);
            this.loading.set(false);
          },
        });
      },
      error: (e) => {
        if (canRecover && this._isPolicyNotEnabledError(e)) {
          this._recoverPolicyAndRetryStep(sessionId, remaining);
          return;
        }
        this.error.set(`Step failed: ${e.message}`);
        this.targetStep.set(null);
        this.loading.set(false);
      },
    });
  }

  private _stopPolling(): void {
    if (this._pollHandle !== null) {
      clearInterval(this._pollHandle);
      this._pollHandle = null;
    }
  }

  reset() {
    const s = this.session();
    if (!s) return;
    this.panResetTrigger.update((v) => v + 1);
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.playing.set(false);
    this._resetTrajectories();
    this.api.reset(s.id).subscribe({
      next: () => this.refreshState(true),
      error: (e) => {
        this.error.set(`Reset failed: ${e.message}`);
        this.loading.set(false);
      },
    });
  }

  play(policy: PolicyName, speed: number = 5) {
    this._playWithPolicy(policy, speed, true);
  }

  private _playWithPolicy(policy: PolicyName, speed: number, canRecover: boolean) {
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
        if (canRecover && this._isPolicyNotEnabledError(e)) {
          this._recoverPolicyAndRetryPlay(s.id, speed);
          return;
        }
        this.error.set(`Play failed: ${e.message}`);
      },
    });
  }

  pause() {
    const s = this.session();
    if (!s) return;
    this.api.pause(s.id).subscribe({
      next: () => this.playing.set(false),
      error: (e) => this.error.set(`Pause failed: ${e.message}`),
    });
  }

  togglePlay(policy: PolicyName, speed: number = 5) {
    if (this.playing()) this.pause();
    else this.play(policy, speed);
  }

  toggleAgentSelection(handle: number) {
    // Single-select: clicking the same agent again deselects it,
    // clicking another swaps the selection.
    this.selectedHandle.set(
      this.selectedHandle() === handle ? null : handle,
    );
  }

  clearSelection() {
    this.selectedHandle.set(null);
  }

  // ========== Decision Override (T6) ==========

  readonly showDecisions = signal(true);
  readonly decisionVisible = signal<Set<number>>(new Set());

  isDecisionVisibleFor(handle: number): boolean {
    const perAgent = this.decisionVisible();
    if (perAgent.size === 0) return this.showDecisions();
    return perAgent.has(handle);
  }

  toggleDecisionFor(handle: number) {
    const cur = new Set(this.decisionVisible());
    if (cur.has(handle)) cur.delete(handle);
    else cur.add(handle);
    this.decisionVisible.set(cur);
  }

  toggleAllDecisions() {
    this.showDecisions.update((v) => !v);
    this.decisionVisible.set(new Set());
  }

  private _setLocalOverride(handle: number, action: number | null): void {
    this.state.update((st) => {
      if (!st) return st;

      return {
        ...st,
        agents: st.agents.map((a) =>
          a.handle === handle
            ? { ...a, override_action: action as any }
            : a,
        ),
      };
    });
  }

  setOverride(handle: number, action: number) {
    const s = this.session();
    if (!s) return;

    // Optimistic UI update: button reacts immediately.
    this._setLocalOverride(handle, action);

    this.api.setOverride(s.id, handle, action as any).subscribe({
      next: () => {
        // Backend remains source of truth, but do not wait for it to make
        // the button look active.
        this.refreshState();
        this.refreshForecasts();
      },
      error: (e) => {
        this.error.set(`Set override failed: ${e.message}`);
        // Re-sync from backend if request failed.
        this.refreshState();
      },
    });
  }

  clearOverride(handle: number) {
    const s = this.session();
    if (!s) return;

    // Optimistic UI update: release/clear reacts immediately.
    this._setLocalOverride(handle, null);

    this.api.clearOverride(s.id, handle).subscribe({
      next: () => {
        this.refreshState();
        this.refreshForecasts();
      },
      error: (e) => {
        this.error.set(`Clear override failed: ${e.message}`);
        this.refreshState();
      },
    });
  }

  refreshForecasts(): void {
    const s = this.session();
    if (!s) return;
    this.api.getScenarios(s.id).subscribe({
      next: (scenarios) => this.scenarios.set(scenarios),
      error: () => {},
    });
    this.api.getRecommendations(s.id).subscribe({
      next: (recs) => this.recommendations.set(recs),
      error: () => {},
    });
  }

  // ── Active policy (synced with backend session.policy) ────────
  private readonly _activePolicy = signal<PolicyName>('deadlock_avoidance');
  readonly activePolicy = computed<PolicyName>(() => this._activePolicy());

  setActivePolicy(policy: PolicyName): void {
    this._activePolicy.set(policy);
  }

  private _isPolicyNotEnabledError(err: any): boolean {
    const msg = String(err?.error?.detail ?? err?.message ?? '').toLowerCase();
    return msg.includes('not enabled');
  }

  private _recoverPolicyAndRetryStep(sessionId: string, n_steps: number): void {
    this.api.getScenarioPolicies(sessionId).subscribe({
      next: (cfg) => {
        const fallback = cfg.enabled_ids?.[0] as PolicyName | undefined;
        if (!fallback) {
          this.error.set('Step failed: no enabled policy available');
          this._stopPolling();
          this.targetStep.set(null);
          this.loading.set(false);
          return;
        }
        this.setActivePolicy(fallback);
        this._stepWithPolicy(fallback, n_steps, false);
      },
      error: () => {
        this.error.set('Step failed: unable to resolve enabled policies');
        this._stopPolling();
        this.targetStep.set(null);
        this.loading.set(false);
      },
    });
  }

  private _recoverPolicyAndRetryPlay(sessionId: string, speed: number): void {
    this.api.getScenarioPolicies(sessionId).subscribe({
      next: (cfg) => {
        const fallback = cfg.enabled_ids?.[0] as PolicyName | undefined;
        if (!fallback) {
          this.error.set('Play failed: no enabled policy available');
          return;
        }
        this.setActivePolicy(fallback);
        this._playWithPolicy(fallback, speed, false);
      },
      error: () => {
        this.error.set('Play failed: unable to resolve enabled policies');
      },
    });
  }

}
