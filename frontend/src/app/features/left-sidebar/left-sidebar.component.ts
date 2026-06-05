import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionStore } from '../../core/session.store';

const AGENT_COLORS = [
  '#eb0000', '#0079c7', '#00973b', '#ffaa00', '#9c4ddc',
  '#b3489e', '#0aafa5', '#5a4f3f', '#a3641c', '#3f4d8c',
];

@Component({
  selector: 'app-left-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './left-sidebar.component.html',
  styleUrl: './left-sidebar.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
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

  agentColor(handle: number): string {
    return AGENT_COLORS[handle % AGENT_COLORS.length];
  }

  isSelected(handle: number): boolean {
    return this.store.selectedHandles().has(handle);
  }

  toggleSelect(handle: number) {
    this.store.toggleAgentSelection(handle);
  }

  onActionClick(handle: number, action: number, isOverride: boolean) {
    if (isOverride) {
      this.store.clearOverride(handle);
    } else {
      this.store.setOverride(handle, action);
    }
  }

  isOverrideOption(handle: number, action: number): boolean {
    const a = this.store.agents().find((x) => x.handle === handle);
    return a?.override_action === action;
  }
}
