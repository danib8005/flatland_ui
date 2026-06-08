import { Component, CUSTOM_ELEMENTS_SCHEMA, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { SessionStore } from '../../core/session.store';
import { ApiService } from '../../core/api.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { Recommendation } from '../../core/events/event-types';

@Component({
  selector: 'app-recommendations-panel',
  standalone: true,
  templateUrl: './recommendations-panel.component.html',
  styleUrl: './recommendations-panel.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class RecommendationsPanelComponent implements OnDestroy {
  store = inject(SessionStore);
  api = inject(ApiService);
  bus = inject(EventBusService);

  // Countdown ticker (1Hz)
  private tickHandle: any;
  private elapsedSinceFetch = signal(0);

  constructor() {
    effect(() => {
      const state = this.store.state();
      const sess = this.store.session();
      if (sess && state) {
        this.api.getRecommendations(sess.id).subscribe({
          next: (recs) => {
            this.store.recommendations.set(recs);
            this.elapsedSinceFetch.set(0);
          },
          error: () => {},
        });
      } else {
        this.store.recommendations.set([]);
      }
    });

    // Tick countdown every second
    this.tickHandle = setInterval(() => {
      this.elapsedSinceFetch.update((v) => v + 1);
    }, 1000);
  }

  ngOnDestroy() {
    if (this.tickHandle) clearInterval(this.tickHandle);
  }

  remaining(r: Recommendation): number {
    return Math.max(0, r.countdownSeconds - this.elapsedSinceFetch());
  }

  // Visualizing the confidence (0..1) as a stripe length
  confidencePct(r: Recommendation): number {
    return Math.round(r.confidence * 100);
  }

  thumbsUp(r: Recommendation) {
    this.bus.emit({ type: 'RECOMMENDATION_FEEDBACK', recId: r.id, thumbsUp: true });
    // visual mark: dismiss
    const cur = this.store.recommendations();
    this.store.recommendations.set(cur.filter((x) => x.id !== r.id));
  }

  thumbsDown(r: Recommendation) {
    this.bus.emit({ type: 'RECOMMENDATION_FEEDBACK', recId: r.id, thumbsUp: false });
    const cur = this.store.recommendations();
    this.store.recommendations.set(cur.filter((x) => x.id !== r.id));
  }

  accept(r: Recommendation) {
    this.bus.emit({ type: 'RECOMMENDATION_ACCEPTED', recId: r.id });
    if (r.scenarioId) {
      this.bus.emit({ type: 'SCENARIO_CONFIRMED', scenarioId: r.scenarioId });
    }
  }
}
