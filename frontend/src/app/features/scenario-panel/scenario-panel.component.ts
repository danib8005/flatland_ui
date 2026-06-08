import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, inject } from '@angular/core';
import { SessionStore } from '../../core/session.store';
import { ApiService } from '../../core/api.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { ScenarioOption } from '../../core/events/event-types';

@Component({
  selector: 'app-scenario-panel',
  standalone: true,
  templateUrl: './scenario-panel.component.html',
  styleUrl: './scenario-panel.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ScenarioPanelComponent {
  store = inject(SessionStore);
  api = inject(ApiService);
  bus = inject(EventBusService);

  constructor() {
    effect(() => {
      const state = this.store.state();
      const sess = this.store.session();
      if (sess && state) {
        this.api.getScenarios(sess.id).subscribe({
          next: (scenarios) => this.store.scenarios.set(scenarios),
          error: () => {},
        });
      } else {
        this.store.scenarios.set([]);
      }
    });
  }

  simulate(s: ScenarioOption) {
    this.bus.emit({ type: 'SCENARIO_SIMULATED', scenarioId: s.id });
  }

  confirm(s: ScenarioOption) {
    this.bus.emit({ type: 'SCENARIO_CONFIRMED', scenarioId: s.id });
  }

  // Helpers
  formatTime(deltaSec?: number): string {
    if (deltaSec == null) return '';
    const sign = deltaSec > 0 ? '+' : '';
    return `${sign}${deltaSec.toFixed(0)}s`;
  }

  formatEnergy(deltaKwh?: number): string {
    if (deltaKwh == null) return '';
    const sign = deltaKwh > 0 ? '+' : '';
    return `${sign}${deltaKwh.toFixed(0)} kWh`;
  }

  isPositive(delta?: number): boolean {
    return (delta ?? 0) < 0;     // negative time/energy = better
  }
  isNegative(delta?: number): boolean {
    return (delta ?? 0) > 0;
  }
}
