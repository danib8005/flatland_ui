import { Component, computed, inject } from '@angular/core';
import { SessionStore } from '../../core/session.store';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-left-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './left-sidebar.component.html',
  styleUrl: './left-sidebar.component.scss',
})
export class LeftSidebarComponent {
  store = inject(SessionStore);

  readonly stats = computed(() => {
    const ags = this.store.agents();
    const states: Record<string, number> = {};
    for (const a of ags) {
      states[a.state] = (states[a.state] ?? 0) + 1;
    }
    return states;
  });

  readonly progress = computed(() => {
    const max = this.store.maxSteps();
    if (!max) return 0;
    return Math.min(100, Math.round((this.store.elapsedSteps() / max) * 100));
  });
}
