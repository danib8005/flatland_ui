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
        // Guided demo: gently pause on a NEW conflict so the human decides.
        const has = items.length > 0;
        if (has && !this._hadImpact && this.store.demoActive() && this.store.playing()
            && this.store.interactionMode() !== 'director') {
          this.store.pause();
        }
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
  }

  private dismiss(handle: number): void {
    this.applied.update((s) => new Set(s).add(handle));
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

  /** Apply the recommended action (Recommendation mode). Always selects the
   *  train too, so the map overlay shows it / its decision options. */
  apply(item: ImpactItem): void {
    this.store.selectedHandle.set(item.handle);
    if (item.recommended_action === 'hold') {
      this.store.setOverride(item.handle, ImpactPanelComponent.STOP);
    }
    // Reroute: selection (above) surfaces the train's branch options in the
    // map overlay, where the human picks the alternative.
    this.dismiss(item.handle); // acted on → remove from the list
  }

  /** Select the affected train to inspect/decide (neutral framing). */
  inspect(item: ImpactItem): void {
    this.store.selectedHandle.set(item.handle);
  }
}
