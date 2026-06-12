import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject, signal } from '@angular/core';
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
  readonly popoverVisible = signal(false);
  readonly popoverLeft = signal(0);
  readonly popoverTop = signal(0);

  private readonly popoverWidth = 420;
  private readonly popoverHeight = 300;

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
    this.popoverVisible.set(false);
  }

  onLineMouseEnter(event: MouseEvent) {
    if (!this.activeAgent()) return;
    this.updatePopoverPosition(event);
    this.popoverVisible.set(true);
  }

  onLineMouseMove(event: MouseEvent) {
    if (!this.activeAgent()) return;
    this.updatePopoverPosition(event);
  }

  onLineMouseLeave() {
    this.popoverVisible.set(false);
  }

  onPopoverMouseEnter() {
    if (!this.activeAgent()) return;
    this.popoverVisible.set(true);
  }

  onPopoverMouseLeave() {
    this.popoverVisible.set(false);
  }

  private updatePopoverPosition(event: MouseEvent) {
    const margin = 8;
    const x = event.clientX;
    const y = event.clientY;

    const maxLeft = Math.max(margin, window.innerWidth - this.popoverWidth - margin);
    const left = Math.min(Math.max(margin, x + 12), maxLeft);

    let top = y - this.popoverHeight - 12;
    if (top < margin) {
      const maxTop = Math.max(margin, window.innerHeight - this.popoverHeight - margin);
      top = Math.min(y + 12, maxTop);
    }

    this.popoverLeft.set(left);
    this.popoverTop.set(top);
  }
}
