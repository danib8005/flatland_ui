import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, inject, OnDestroy} from '@angular/core';
import { SessionStore } from '../../core/session.store';
import { ApiService } from '../../core/api.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { AppNotification } from '../../core/events/event-types';

@Component({
  selector: 'app-notifications-panel',
  standalone: true,
  templateUrl: './notifications-panel.component.html',
  styleUrl: './notifications-panel.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class NotificationsPanelComponent implements OnDestroy {
  store = inject(SessionStore);
  api = inject(ApiService);
  bus = inject(EventBusService);

  private _notifPollHandle: any = null;
  private _notifLastSession: string | null = null;

  constructor() {
    // Notifications used to refetch on every state update with a 'cheap,
    // mock anyway' comment — but the backend now actually computes them
    // and pulling 2×/sec from a state-driven effect blocks /pause and
    // makes Play feel unresponsive (see scenario-panel for the same fix).
    //
    // New strategy: throttle to ~2s while a session is active. Also
    // refetch immediately when Play stops, so the user sees fresh
    // notifications right after pausing.
    let lastPlaying = false;
    effect(() => {
      const sess = this.store.session();
      const playing = this.store.playing();

      if (!sess) {
        this.store.notifications.set([]);
        this._stopNotifPolling();
        this._notifLastSession = null;
        lastPlaying = false;
        return;
      }

      const sessionChanged = sess.id !== this._notifLastSession;
      const stoppedPlaying = lastPlaying && !playing;

      // Immediate fetch on session change or pause-end.
      if (sessionChanged || stoppedPlaying) {
        this._fetchNotifications(sess.id);
      }

      // Slow background refresh (every 2s) while session is alive,
      // so live deadlock/conflict notifications appear within a couple
      // of seconds even during Play.
      if (sessionChanged) {
        this._stopNotifPolling();
        this._notifPollHandle = setInterval(() => {
          this._fetchNotifications(sess.id);
        }, 2000);
      }

      this._notifLastSession = sess.id;
      lastPlaying = playing;
    });
  }

  private _fetchNotifications(sessionId: string): void {
    this.api.getNotifications(sessionId).subscribe({
      next: (notifications) => this.store.notifications.set(notifications),
      error: () => {},
    });
  }

  private _stopNotifPolling(): void {
    if (this._notifPollHandle !== null) {
      clearInterval(this._notifPollHandle);
      this._notifPollHandle = null;
    }
  }

  focus(n: AppNotification) {
    if (n.relatedElement) {
      this.bus.emit({
        type: 'FOCUS_INFRASTRUCTURE_ELEMENT',
        kind: n.relatedElement.kind,
        id: n.relatedElement.id,
      });
    }
  }

  dismiss(n: AppNotification, event: Event) {
    event.stopPropagation();
    this.bus.emit({ type: 'NOTIFICATION_DISMISSED', notificationId: n.id });
    const cur = this.store.notifications();
    this.store.notifications.set(cur.filter((x) => x.id !== n.id));
  }

  iconFor(kind: string): string {
    switch (kind) {
      case 'error':
        return '⛔';
      case 'warning':
        return '⚠';
      default:
        return 'ⓘ';
    }
  }

  ngOnDestroy() {
    this._stopNotifPolling();
  }
}
