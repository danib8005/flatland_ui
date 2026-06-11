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

  readonly activeAgent = computed<AgentDTO | null>(() => {
    const h = this.store.activeHandle();
    if (h == null) return null;
    return this.store.agents().find((a) => a.handle === h) ?? null;
  });

  /**
   * Agent dot / badge colour.
   */
  agentColor(handle: number): string {
    return this.agentColors.getColor(handle, 'default');
  }

  clearSelection() {
    this.store.clearSelection();
  }
}
