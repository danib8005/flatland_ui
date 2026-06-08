import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, inject } from '@angular/core';
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
export class NotificationsPanelComponent {
  store = inject(SessionStore);
  api = inject(ApiService);
  bus = inject(EventBusService);

  constructor() {
    // Re-fetch on every state update (cheap, mock anyway)
    effect(() => {
      const state = this.store.state();
      const sess = this.store.session();
      if (sess && state) {
        this.api.getNotifications(sess.id).subscribe({
          next: (notifications) => this.store.notifications.set(notifications),
          error: () => {},
        });
      } else {
        this.store.notifications.set([]);
      }
    });
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
}
