import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject } from '@angular/core';
import { SessionStore } from '../../core/session.store';
import { AgentDTO } from '../../core/models';

const AGENT_COLORS = [
  '#eb0000', '#0079c7', '#00973b', '#ffaa00', '#9c4ddc',
  '#b3489e', '#0aafa5', '#5a4f3f', '#a3641c', '#3f4d8c',
];

@Component({
  selector: 'app-flatland-map',
  standalone: true,
  templateUrl: './flatland-map.component.html',
  styleUrl: './flatland-map.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FlatlandMapComponent {
  store = inject(SessionStore);

  cellSize = 24;

  readonly viewBox = computed(() => {
    const w = this.store.width() * this.cellSize;
    const h = this.store.height() * this.cellSize;
    return `0 0 ${w} ${h}`;
  });

  readonly cells = computed(() => {
    const grid = this.store.railGrid();
    const cells: { x: number; y: number; trans: number }[] = [];
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] !== 0) {
          cells.push({
            x: c * this.cellSize,
            y: r * this.cellSize,
            trans: grid[r][c],
          });
        }
      }
    }
    return cells;
  });

  readonly agents = computed(() => this.store.agents());

  agentColor(handle: number): string {
    return AGENT_COLORS[handle % AGENT_COLORS.length];
  }

  agentX(a: AgentDTO): number {
    const pos = a.position ?? a.initial_position;
    if (!pos) return 0;
    return pos[1] * this.cellSize + this.cellSize / 2;
  }

  agentY(a: AgentDTO): number {
    const pos = a.position ?? a.initial_position;
    if (!pos) return 0;
    return pos[0] * this.cellSize + this.cellSize / 2;
  }

  targetX(a: AgentDTO): number {
    return a.target[1] * this.cellSize + this.cellSize / 2;
  }

  targetY(a: AgentDTO): number {
    return a.target[0] * this.cellSize + this.cellSize / 2;
  }

  isSelected(handle: number): boolean {
    return this.store.selectedHandles().has(handle);
  }

  toggleSelect(handle: number) {
    this.store.toggleAgentSelection(handle);
  }

  trackByCell = (_: number, c: { x: number; y: number }) => `${c.x}_${c.y}`;
  trackByAgent = (_: number, a: AgentDTO) => a.handle;
}
