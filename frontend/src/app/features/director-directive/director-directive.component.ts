import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject } from '@angular/core';
import { SessionStore } from '../../core/session.store';

/**
 * Pre-run directive for Director mode (WP 3.4). The human sets a high-level
 * directive — KPI priorities (the "objective" lever) and the policy/algorithm
 * the AI runs — then explicitly starts the autonomous run. This replaces
 * per-decision prompting (optionPresentation === 'none').
 */
@Component({
  selector: 'app-director-directive',
  standalone: true,
  templateUrl: './director-directive.component.html',
  styleUrl: './director-directive.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class DirectorDirectiveComponent {
  store = inject(SessionStore);

  /** Whether the run has already produced steps (→ "Resume" instead of "Start"). */
  readonly started = computed(() => this.store.elapsedSteps() > 0);

  /** Active policy label for the directive summary. */
  readonly policyLabel = computed(() => {
    const id = this.store.activePolicy();
    return this.store.availablePolicies().find((p) => p.id === id)?.label ?? id;
  });

  /** KPI priorities sorted high→low, as the directive's objective weighting. */
  readonly priorities = computed(() => {
    const w = this.store.kpiPriorities();
    const labels: Record<string, string> = {
      time: 'Time',
      energy: 'Energy',
      platformRouting: 'Platform',
      trainRouting: 'Train routing',
    };
    return (Object.keys(labels) as (keyof typeof w)[])
      .map((k) => ({ label: labels[k], value: w[k] }))
      .sort((a, b) => b.value - a.value);
  });

  pct(v: number): number {
    return Math.round(v * 100);
  }

  start(): void {
    const policy = this.store.activePolicy() || this.store.defaultPolicy();
    this.store.play(policy, this.store.playSpeed());
  }
}
