import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, effect, inject, signal } from '@angular/core';
import { SessionStore } from '../../core/session.store';
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
export class ImpactPanelComponent {
  store = inject(SessionStore);
  private colors = inject(AgentColorService);

  private static readonly STOP = 4;

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
