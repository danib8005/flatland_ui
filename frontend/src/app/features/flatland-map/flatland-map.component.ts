import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { SessionStore } from '../../core/session.store';
import { AgentDTO, RailTile, DecisionOption, NextDecision } from '../../core/models';

const AGENT_COLORS = [
  '#eb0000', '#0079c7', '#00973b', '#ffaa00', '#9c4ddc',
  '#b3489e', '#0aafa5', '#5a4f3f', '#a3641c', '#3f4d8c',
];

interface DecisionLayer {
  handle: number;
  color: string;
  pathD: string;
  decisionCx: number;
  decisionCy: number;
  pillsX: number;
  pillsY: number;
  options: PillData[];
  cellType: 'SWITCH' | 'MERGING';
}

interface PillData {
  action: number;
  label: string;
  isOverride: boolean;
}

interface BoundingBox {
  minR: number;
  maxR: number;
  minC: number;
  maxC: number;
}

@Component({
  selector: 'app-flatland-map',
  standalone: true,
  templateUrl: './flatland-map.component.html',
  styleUrl: './flatland-map.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FlatlandMapComponent {
  store = inject(SessionStore);

  cellSize = 32;
  padCells = 1;

  // Pan-State (offset relativ zur initial bbox)
  panX = signal(0);
  panY = signal(0);

  // Drag-State (intern)
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartPanX = 0;
  private dragStartPanY = 0;
  private svgRef = viewChild<ElementRef<SVGSVGElement>>('svgRoot');

  private get svgEl(): SVGSVGElement | undefined {
    return this.svgRef()?.nativeElement;
  }

  constructor() {
    effect(() => {
      this.store.panResetTrigger();
      this.panX.set(0);
      this.panY.set(0);
    });
  }

  readonly bbox = computed<BoundingBox>(() => {
    const tiles = this.store.railTiles();
    const agents = this.store.agents();

    let minR = Infinity, maxR = -Infinity;
    let minC = Infinity, maxC = -Infinity;

    for (const t of tiles) {
      if (t.r < minR) minR = t.r;
      if (t.r > maxR) maxR = t.r;
      if (t.c < minC) minC = t.c;
      if (t.c > maxC) maxC = t.c;
    }

    for (const a of agents) {
      const pos = a.position ?? a.initial_position;
      if (pos) {
        if (pos[0] < minR) minR = pos[0];
        if (pos[0] > maxR) maxR = pos[0];
        if (pos[1] < minC) minC = pos[1];
        if (pos[1] > maxC) maxC = pos[1];
      }
      if (a.target) {
        if (a.target[0] < minR) minR = a.target[0];
        if (a.target[0] > maxR) maxR = a.target[0];
        if (a.target[1] < minC) minC = a.target[1];
        if (a.target[1] > maxC) maxC = a.target[1];
      }
    }

    if (!isFinite(minR)) {
      return { minR: 0, maxR: this.store.height() - 1, minC: 0, maxC: this.store.width() - 1 };
    }

    const pad = this.padCells;
    return {
      minR: Math.max(0, minR - pad),
      maxR: Math.min(this.store.height() - 1, maxR + pad),
      minC: Math.max(0, minC - pad),
      maxC: Math.min(this.store.width() - 1, maxC + pad),
    };
  });

  readonly viewBox = computed(() => {
    const b = this.bbox();
    const x = b.minC * this.cellSize + this.panX();
    const y = b.minR * this.cellSize + this.panY();
    const w = (b.maxC - b.minC + 1) * this.cellSize;
    const h = (b.maxR - b.minR + 1) * this.cellSize;
    return `${x} ${y} ${w} ${h}`;
  });

  readonly tiles = computed(() => this.store.railTiles());
  readonly agents = computed(() => this.store.agents());

  readonly decisionLayers = computed<DecisionLayer[]>(() => {
    const result: DecisionLayer[] = [];
    for (const a of this.agents()) {
      if (!a.next_decision) continue;
      if (!this.store.isDecisionVisibleFor(a.handle)) continue;
      const layer = this._buildLayer(a, a.next_decision);
      if (layer) result.push(layer);
    }
    return result;
  });

  private _buildLayer(a: AgentDTO, nd: NextDecision): DecisionLayer | null {
    if (!a.position) return null;

    const pathPoints = nd.path.map(([r, c]) => ({
      x: c * this.cellSize + this.cellSize / 2,
      y: r * this.cellSize + this.cellSize / 2,
    }));

    if (pathPoints.length === 0) return null;

    let pathD = '';
    pathPoints.forEach((p, i) => {
      pathD += (i === 0 ? 'M' : 'L') + ` ${p.x} ${p.y} `;
    });

    const decisionCx = nd.decision_position[1] * this.cellSize + this.cellSize / 2;
    const decisionCy = nd.decision_position[0] * this.cellSize + this.cellSize / 2;

    const agentX = a.position[1] * this.cellSize + this.cellSize / 2;
    const agentY = a.position[0] * this.cellSize + this.cellSize / 2;
    const pillsX = agentX + 12;
    const pillsY = agentY + 8;

    const options: PillData[] = nd.options.map((opt: DecisionOption) => ({
      action: opt.action,
      label: opt.label,
      isOverride: a.override_action === opt.action,
    }));

    return {
      handle: a.handle,
      color: this.agentColor(a.handle),
      pathD,
      decisionCx,
      decisionCy,
      pillsX,
      pillsY,
      options,
      cellType: nd.cell_type,
    };
  }

  // ========== Pan Handlers ==========

  onMouseDown(event: MouseEvent) {
    // Nur Linke Maustaste, und nicht auf interaktiven Elementen
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest('.agent') || target.closest('.pill')) {
      return;
    }
    this.isDragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragStartPanX = this.panX();
    this.dragStartPanY = this.panY();
    if (this.svgEl) {
      this.svgEl.style.cursor = 'grabbing';
    }
    event.preventDefault();
  }

  onMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    // Mit preserveAspectRatio="meet" gibt es nur EINEN echten Scale-Faktor:
    // den groesseren der beiden (das limitiert die Anzeige).
    // -> beide Achsen MUESSEN den gleichen Scale verwenden.
    if (this.svgEl) {
      const rect = this.svgEl.getBoundingClientRect();
      const b = this.bbox();
      const w = (b.maxC - b.minC + 1) * this.cellSize;
      const h = (b.maxR - b.minR + 1) * this.cellSize;
      const scaleX = w / rect.width;
      const scaleY = h / rect.height;
      const scale = Math.max(scaleX, scaleY); // "meet" => der groessere ist sichtbar
      this.panX.set(this.dragStartPanX - dx * scale);
      this.panY.set(this.dragStartPanY - dy * scale);
    } else {
      this.panX.set(this.dragStartPanX - dx);
      this.panY.set(this.dragStartPanY - dy);
    }
  }

  // Step-Pan (Buttons): bewegt Map um eine Bildschirm-Haelfte
  panStep(dirX: number, dirY: number) {
    if (this.svgEl) {
      const rect = this.svgEl.getBoundingClientRect();
      const b = this.bbox();
      const w = (b.maxC - b.minC + 1) * this.cellSize;
      const h = (b.maxR - b.minR + 1) * this.cellSize;
      const scaleX = w / rect.width;
      const scaleY = h / rect.height;
      const scale = Math.max(scaleX, scaleY);
      // Step: 30% des Screen-Bereichs
      const stepPx = Math.min(rect.width, rect.height) * 0.3;
      this.panX.update((v) => v + dirX * stepPx * scale);
      this.panY.update((v) => v + dirY * stepPx * scale);
    }
  }

  onMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;
      if (this.svgEl) {
        this.svgEl.style.cursor = 'grab';
      }
    }
  }

  onMouseLeave() {
    this.onMouseUp();
  }

  resetPan() {
    this.panX.set(0);
    this.panY.set(0);
  }

  // ========== Standard Helpers ==========

  tileX(t: RailTile): number { return t.c * this.cellSize; }
  tileY(t: RailTile): number { return t.r * this.cellSize; }

  tileTransform(t: RailTile): string {
    const cx = t.c * this.cellSize + this.cellSize / 2;
    const cy = t.r * this.cellSize + this.cellSize / 2;
    return `rotate(${t.rot} ${cx} ${cy})`;
  }

  tileHref(t: RailTile): string { return `/flatland-svg/${t.svg}`; }

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

  onPillClick(handle: number, action: number, isOverride: boolean) {
    if (isOverride) {
      this.store.clearOverride(handle);
    } else {
      this.store.setOverride(handle, action);
    }
  }

  trackByTile = (_: number, t: RailTile) => `${t.r}_${t.c}`;
  trackByAgent = (_: number, a: AgentDTO) => a.handle;
  trackByLayer = (_: number, l: DecisionLayer) => l.handle;
  trackByPill = (_: number, p: PillData) => p.action;
}
