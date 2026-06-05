import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject } from '@angular/core';
import { SessionStore } from '../../core/session.store';
import { AgentDTO } from '../../core/models';

const AGENT_COLORS = [
  '#eb0000', '#0079c7', '#00973b', '#ffaa00', '#9c4ddc',
  '#b3489e', '#0aafa5', '#5a4f3f', '#a3641c', '#3f4d8c',
];

@Component({
  selector: 'app-agent-inspector',
  standalone: true,
  templateUrl: './agent-inspector.component.html',
  styleUrl: './agent-inspector.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AgentInspectorComponent {
  store = inject(SessionStore);

  readonly selectedAgents = computed<AgentDTO[]>(() => {
    const sel = this.store.selectedHandles();
    return this.store.agents().filter((a) => sel.has(a.handle));
  });

  readonly allAgents = computed<AgentDTO[]>(() => this.store.agents());

  agentColor(handle: number): string {
    return AGENT_COLORS[handle % AGENT_COLORS.length];
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
