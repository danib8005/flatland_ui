import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type LayoutEventType =
  | 'panel.registered'
  | 'panel.added'
  | 'panel.removed'
  | 'panel.updated'
  | 'panel.moved'
  | 'panel.collapsed'
  | 'panel.expanded'
  | 'layout.changed'
  | 'designer.changed';

export interface LayoutEvent<TPayload = unknown> {
  type: LayoutEventType;
  payload?: TPayload;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class LayoutEventBusService {
  private readonly eventsSubject = new Subject<LayoutEvent>();

  readonly events$ = this.eventsSubject.asObservable();

  emit<TPayload = unknown>(
    type: LayoutEventType,
    payload?: TPayload,
  ): void {
    this.eventsSubject.next({
      type,
      payload,
      timestamp: Date.now(),
    });
  }
}
