import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionStore } from '../../core/session.store';
import { AgentColorService } from '../../core/agent-color.service';

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
  private agentColors = inject(AgentColorService);

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

  /**
   * Agent dot colour. Delegates to AgentColorService (round-robin
   * over TRAIN_TYPES). Selected agents get the 'focus' state so they
   * pop visually in the sidebar list.
   */
  agentColor(handle: number): string {
    const state = this.isSelected(handle) ? 'focus' : 'default';
    return this.agentColors.getColor(handle, state);
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
