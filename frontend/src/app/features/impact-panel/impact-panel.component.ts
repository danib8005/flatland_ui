import { Component, CUSTOM_ELEMENTS_SCHEMA, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { SessionStore } from '../../core/session.store';
import { ApiService } from '../../core/api.service';
import { AgentColorService } from '../../core/agent-color.service';
import { ImpactItem } from '../../core/events/event-types';

/**
 * Impact analysis panel (Phase 1): when a train malfunctions, shows which other
 * trains are affected (blocked on their path before the block clears) and a
 * coarse recommendation per train. Framing follows optionPresentation:
 *  - recommendation: the recommended action is highlighted + applicable
 *  - co-learning: affected trains shown neutrally (inspect & decide yourself)
 *  - director: overview only (AI handles it)
 */
@Component({
  selector: 'app-impact-panel',
  standalone: true,
  templateUrl: './impact-panel.component.html',
  styleUrl: './impact-panel.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ImpactPanelComponent implements OnDestroy {
  store = inject(SessionStore);
  private api = inject(ApiService);
  private colors = inject(AgentColorService);

  private static readonly STOP = 4;
  private _pollHandle: any = null;
  private _pollSession: string | null = null;
  private _hadImpact = false;

  /** Items the user has acted on (applied) → hidden from the list. */
  readonly applied = signal<Set<number>>(new Set<number>());

  /** Affected trains still pending an action (acted-on ones removed). */
  readonly items = computed<ImpactItem[]>(() =>
    this.store.impact().filter((i) => !this.applied().has(i.handle)),
  );

  /** Panel stays visible always; auto-expands when trains are affected,
   *  auto-collapses when nothing is going on. User can still toggle. */
  readonly collapsed = signal<boolean>(true);
  private _lastHasImpact = false;

  /** Decision countdown (seconds left) before the system auto-applies the
   *  recommended option; null = inactive. */
  readonly countdownRemaining = signal<number | null>(null);
  private _tickHandle: any = null;

  /** Countdown progress 0..1 (for the bar). */
  readonly countdownPct = computed(() => {
    const rem = this.countdownRemaining();
    const total = this.store.decisionCountdownSeconds();
    if (rem == null || total <= 0) return 0;
    return Math.max(0, Math.min(1, rem / total));
  });

  constructor() {
    effect(() => {
      const has = this.items().length > 0;
      if (has !== this._lastHasImpact) {
        this._lastHasImpact = has;
        this.collapsed.set(!has);
      }
    });

    // Impact is cheap to compute → poll it live (~1.5s) so conflicts surface
    // while the simulation runs, not only on pause. Scenarios stay throttled.
    effect(() => {
      const sid = this.store.session()?.id ?? null;
      if (sid !== this._pollSession) {
        this._pollSession = sid;
        this._stopPoll();
        this.applied.set(new Set<number>());
        if (sid) {
          this._fetchImpact(sid);
          this._pollHandle = setInterval(() => {
            const cur = this.store.session()?.id;
            if (cur) this._fetchImpact(cur);
          }, 1500);
        }
      }
    });
  }

  private _fetchImpact(sid: string): void {
    this.api.getImpact(sid).subscribe({
      next: (items) => {
        this.store.impact.set(items);
        // Guided demo: gently pause on a NEW conflict so the human decides, and
        // start the decision countdown (Recommendation & Co-Learning).
        const has = items.length > 0;
        if (has && !this._hadImpact && this.store.demoActive() && this.store.playing()
            && this.store.interactionMode() !== 'director'
            && this.store.autoPauseOnConflict()) {
          this.store.pause();
          this._startCountdown();
        }
        if (!has) this._stopCountdown();
        this._hadImpact = has;
      },
      error: () => {},
    });
  }

  private _stopPoll(): void {
    if (this._pollHandle !== null) {
      clearInterval(this._pollHandle);
      this._pollHandle = null;
    }
  }

  ngOnDestroy(): void {
    this._stopPoll();
    this._stopCountdown();
  }

  // ── Decision countdown → auto-apply recommended option ───────────────
  private _startCountdown(): void {
    this._stopCountdown();
    this.countdownRemaining.set(this.store.decisionCountdownSeconds());
    this._tickHandle = setInterval(() => {
      const rem = (this.countdownRemaining() ?? 0) - 1;
      if (rem <= 0) {
        this._autoDecide();
      } else {
        this.countdownRemaining.set(rem);
      }
    }, 1000);
  }

  private _stopCountdown(): void {
    if (this._tickHandle !== null) {
      clearInterval(this._tickHandle);
      this._tickHandle = null;
    }
    this.countdownRemaining.set(null);
  }

  /** Time's up: apply each train's recommended option (hold = safe default) and
   *  resume the run. */
  private _autoDecide(): void {
    for (const item of this.items()) {
      // Apply the recommended option; reroute uses the alternative-branch
      // override when available, otherwise hold is the safe fallback.
      const rec = item.recommended_action;
      if (!(rec === 'reroute' && this._apply(item, 'reroute'))) {
        this.store.setOverride(item.handle, ImpactPanelComponent.STOP);
      }
      this.dismiss(item.handle);
    }
    this._stopCountdown();
    if (!this.store.episodeDone()) {
      this.store.play(this.store.activePolicy(), this.store.playSpeed());
    }
  }

  private dismiss(handle: number): void {
    this.applied.update((s) => new Set(s).add(handle));
    if (this.items().length === 0) this._stopCountdown();
  }

  toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
  }

  agentColor(handle: number): string {
    return this.colors.getColorSolid(handle);
  }

  /** Click a row → select the affected train (map overlay + cross-view highlight). */
  select(item: ImpactItem): void {
    this.store.selectedHandle.set(item.handle);
  }

  /** Hover a row → highlight the affected train across views. */
  onEnter(item: ImpactItem): void {
    this.store.setAgentHoverAgents([item.handle]);
  }

  onLeave(): void {
    this.store.clearAgentHoverAgents();
  }

  /** Apply a chosen option for a train. Stops the countdown (human decided). */
  applyOption(item: ImpactItem, action: 'hold' | 'reroute' | 'proceed'): void {
    this.store.selectedHandle.set(item.handle);
    if (!this._apply(item, action)) {
      // Reroute requested but no branch action available → surface the train in
      // the map overlay so the human can pick a branch manually; keep the item.
      this.store.selectedHandle.set(item.handle);
      this._stopCountdown();
      return;
    }
    this._stopCountdown();
    this.dismiss(item.handle);
  }

  /** Apply an action's override. Returns false if reroute had no branch action
   *  (so the caller can fall back to manual selection without dismissing). */
  private _apply(item: ImpactItem, action: 'hold' | 'reroute' | 'proceed'): boolean {
    if (action === 'hold') {
      this.store.setOverride(item.handle, ImpactPanelComponent.STOP);
      return true;
    }
    if (action === 'proceed') {
      this.store.clearOverride(item.handle);
      return true;
    }
    // reroute: apply the alternative-branch override (fires at the next switch).
    if (item.reroute_action != null) {
      this.store.setOverride(item.handle, item.reroute_action);
      return true;
    }
    return false;
  }

  /** Select the affected train to inspect/decide (neutral framing). */
  inspect(item: ImpactItem): void {
    this.store.selectedHandle.set(item.handle);
    this._stopCountdown();
  }
}
