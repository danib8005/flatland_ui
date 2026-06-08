import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject } from '@angular/core';
import { SessionStore } from '../../core/session.store';
import { AgentDTO } from '../../core/models';
import { AgentColorService } from '../../core/agent-color.service';

@Component({
  selector: 'app-agent-inspector',
  standalone: true,
  templateUrl: './agent-inspector.component.html',
  styleUrl: './agent-inspector.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AgentInspectorComponent {
  store = inject(SessionStore);
  private agentColors = inject(AgentColorService);

  readonly selectedAgents = computed<AgentDTO[]>(() => {
    const sel = this.store.selectedHandles();
    return this.store.agents().filter((a) => sel.has(a.handle));
  });

  readonly allAgents = computed<AgentDTO[]>(() => this.store.agents());

  /**
   * Agent dot / badge colour. Selected agents show the 'focus' state,
   * unselected ones the regular 'default'. Train type comes from
   * AgentColorService (round-robin over TRAIN_TYPES).
   */
  agentColor(handle: number): string {
    const state = this.isSelected(handle) ? 'focus' : 'default';
    return this.agentColors.getColor(handle, state);
  }

  /** Train type label for tooltips/inspector panels. */
  trainTypeLabel(handle: number): string {
    return this.agentColors.getLabel(handle);
  }

  toggle(handle: number) {
    this.store.toggleAgentSelection(handle);
  }

  isSelected(handle: number): boolean {
    return this.store.selectedHandles().has(handle);
  }

  clearSelection() {
    this.store.clearSelection();
  }

  trackByAgent = (_: number, a: AgentDTO) => a.handle;
}
