import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';
import { SessionStore } from '../../core/session.store';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ToolbarComponent {
  store = inject(SessionStore);
  policy = signal<'random' | 'shortest_path'>('shortest_path');

  newSession() {
    this.store.newSession();
  }

  reset() {
    this.store.reset();
  }

  step(n: number) {
    this.store.step(this.policy(), n);
  }

  setPolicy(p: 'random' | 'shortest_path') {
    this.policy.set(p);
  }
}
