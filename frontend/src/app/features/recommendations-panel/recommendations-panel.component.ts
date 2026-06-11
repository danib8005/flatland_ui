import { Component, CUSTOM_ELEMENTS_SCHEMA, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { SessionStore } from '../../core/session.store';
import { ApiService } from '../../core/api.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { Recommendation } from '../../core/events/event-types';
import { PolicyName } from '../../core/models';

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

  private _recPollHandle: any = null;
  private _recLastSession: string | null = null;

  constructor() {
    // Same rationale as notifications-panel: don't refetch on every WS
    // state update — that blocks /pause during Play. Throttle to 2s,
    // plus immediate refetch when session changes or Play stops.
    let lastPlaying = false;
    effect(() => {
      const sess = this.store.session();
      const playing = this.store.playing();

      if (!sess) {
        this.store.recommendations.set([]);
        this._stopRecPolling();
        this._recLastSession = null;
        lastPlaying = false;
        return;
      }

      const sessionChanged = sess.id !== this._recLastSession;
      const stoppedPlaying = lastPlaying && !playing;

      if (sessionChanged || stoppedPlaying) {
        this._fetchRecommendations(sess.id);
      }

      if (sessionChanged) {
        this._stopRecPolling();
        this._recPollHandle = setInterval(() => {
          this._fetchRecommendations(sess.id);
        }, 2000);
      }

      this._recLastSession = sess.id;
      lastPlaying = playing;
    });

    // Tick countdown every second
    this.tickHandle = setInterval(() => {
      this.elapsedSinceFetch.update((v) => v + 1);
    }, 1000);
  }

  private _fetchRecommendations(sessionId: string): void {
    this.api.getRecommendations(sessionId).subscribe({
      next: (recs) => {
        this.store.recommendations.set(recs);
        this.elapsedSinceFetch.set(0);
      },
      error: () => {},
    });
  }

  private _stopRecPolling(): void {
    if (this._recPollHandle !== null) {
      clearInterval(this._recPollHandle);
      this._recPollHandle = null;
    }
  }

  ngOnDestroy() {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this._stopRecPolling();
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
    const sess = this.store.session();
    if (!sess) return;
    // Recommendation.scenarioId follows the format 'scn_<policy_id>' so
    // we can derive the policy id directly. If for some reason it's
    // missing, we just emit the bus events without a server call.
    this.bus.emit({ type: 'RECOMMENDATION_ACCEPTED', recId: r.id });

    if (!r.scenarioId || !r.scenarioId.startsWith('scn_')) {
      // Legacy / mock recommendation: keep bus event for compatibility.
      if (r.scenarioId) {
        this.bus.emit({ type: 'SCENARIO_CONFIRMED', scenarioId: r.scenarioId });
      }
      this.dismiss(r);
      return;
    }

    const policyId = r.scenarioId.slice(4) as PolicyName;
    this.api.setPolicy(sess.id, policyId).subscribe({
      next: () => {
        this.store.setActivePolicy(policyId);
        // Inform the rest of the app (scenario panel listens, etc.)
        this.bus.emit({ type: 'SCENARIO_CONFIRMED', scenarioId: r.scenarioId! });
        this.dismiss(r);
      },
      error: (err) => {
        console.warn('Failed to apply recommendation', err);
      },
    });
  }

  /** Remove a recommendation from the local list (visual cue). */
  private dismiss(r: Recommendation) {
    const cur = this.store.recommendations();
    this.store.recommendations.set(cur.filter((x) => x.id !== r.id));
  }
}
