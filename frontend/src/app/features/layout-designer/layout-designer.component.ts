import { CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DesignerColumn,
  DesignerPanel,
  DesignerSelection,
  FlatlandDesign,
} from './layout-designer.models';
import { DesignStorageService } from './design-storage.service';

interface PaletteItem {
  type: string;
  title: string;
  minHeight: number;
}

type DragPayload =
  | { source: 'palette'; type: string; title: string; minHeight: number }
  | { source: 'layout'; columnId: string; panelId: string };

@Component({
  selector: 'app-layout-designer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './layout-designer.component.html',
  styleUrls: ['./layout-designer.component.scss'],
})
export class LayoutDesignerComponent {
  private readonly storage = inject(DesignStorageService);

  designs = this.storage.list();
  design: FlatlandDesign = this.loadInitialDesign();

  selection: DesignerSelection = { kind: 'design' };

  palette: PaletteItem[] = [
    { type: 'agents-list', title: 'Agents List', minHeight: 150 },
    { type: 'simulation-map', title: 'Simulation Map', minHeight: 260 },
    { type: 'flatland-map', title: 'Flatland Map', minHeight: 320 },
    { type: 'marey-chart', title: 'Marey Chart', minHeight: 260 },
    { type: 'graphic-timetable', title: 'Graphic Timetable', minHeight: 260 },
    { type: 'agent-inspector', title: 'Agent Inspector', minHeight: 170 },
    { type: 'goal-achievement', title: 'Goal Achievement', minHeight: 150 },
    { type: 'impact', title: 'Impact', minHeight: 150 },
    { type: 'timeline', title: 'Timeline', minHeight: 140 },
    { type: 'validation', title: 'Validation', minHeight: 140 },
    { type: 'cell-inspector', title: 'Cell Inspector', minHeight: 150 },
  ];

  private resizing:
    | {
        kind: 'column';
        columnId: string;
        startX: number;
        startWidth: number;
      }
    | {
        kind: 'panel';
        columnId: string;
        panelId: string;
        startY: number;
        startHeight: number;
      }
    | null = null;

  get selectedColumn(): DesignerColumn | undefined {
    if (this.selection.kind === 'column') {
      return this.findColumn(this.selection.columnId);
    }

    if (this.selection.kind === 'panel') {
      return this.findColumn(this.selection.columnId);
    }

    return undefined;
  }

  get selectedPanel(): DesignerPanel | undefined {
    if (this.selection.kind !== 'panel') {
      return undefined;
    }

    return this.findPanel(this.selection.columnId, this.selection.panelId);
  }

  get canvasWidth(): number {
    return this.design.layout.columns.reduce((sum, c) => sum + c.width, 0);
  }

  selectDesign(): void {
    this.selection = { kind: 'design' };
  }

  selectColumn(column: DesignerColumn, event?: Event): void {
    event?.stopPropagation();
    this.selection = { kind: 'column', columnId: column.id };
  }

  selectPanel(column: DesignerColumn, panel: DesignerPanel, event: Event): void {
    event.stopPropagation();
    this.selection = { kind: 'panel', columnId: column.id, panelId: panel.id };
  }

  addColumn(): void {
    const index = this.design.layout.columns.length + 1;
    const col: DesignerColumn = {
      id: `column_${Date.now()}`,
      name: `column ${index}`,
      width: 280,
      role: 'custom',
      panels: [],
    };

    this.design.layout.columns.push(col);
    this.selection = { kind: 'column', columnId: col.id };
    this.touch();
  }

  removeSelectedColumn(): void {
    if (this.selection.kind !== 'column') {
      return;
    }

    const col = this.findColumn(this.selection.columnId);
    if (!col) {
      return;
    }

    if (col.panels.length && !confirm('Column contains panels. Delete anyway?')) {
      return;
    }

    this.design.layout.columns = this.design.layout.columns.filter((c) => c.id !== col.id);
    this.selection = { kind: 'design' };
    this.touch();
  }

  removeSelectedPanel(): void {
    if (this.selection.kind !== 'panel') {
      return;
    }

    const column = this.findColumn(this.selection.columnId);
    if (!column) {
      return;
    }

    const panelId = this.selection.panelId;

    column.panels = column.panels.filter((p) => p.id !== panelId);
    this.selection = { kind: 'design' };
    this.touch();
  }

  duplicateSelectedPanel(): void {
    const panel = this.selectedPanel;
    const column = this.selectedColumn;
    if (!panel || !column) {
      return;
    }

    column.panels.push({
      ...panel,
      id: `${panel.type}_${Math.random().toString(36).slice(2, 9)}`,
      title: `${panel.title} Copy`,
    });

    this.touch();
  }

  save(): void {
    this.storage.save(this.design);
    this.designs = this.storage.list();
  }

  saveAs(): void {
    const name = prompt('Layout name', `${this.design.name} Copy`);
    if (!name) {
      return;
    }

    this.design = {
      ...structuredClone(this.design),
      id: `design_${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.save();
  }

  deleteDesign(): void {
    if (!confirm(`Delete layout "${this.design.name}"?`)) {
      return;
    }

    this.storage.delete(this.design.id);
    this.designs = this.storage.list();
    this.design = this.loadInitialDesign();
    this.selection = { kind: 'design' };
  }

  loadDesign(id: string): void {
    const found = this.storage.get(id);
    if (!found) {
      return;
    }

    this.design = structuredClone(found);
    this.storage.setActive(id);
    this.selection = { kind: 'design' };
  }

  exportJson(): void {
    const blob = new Blob([JSON.stringify(this.storage.exportAll(), null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flatland-designs.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async importJson(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const text = await file.text();
    const payload = JSON.parse(text);
    const count = this.storage.importMany(payload);

    this.designs = this.storage.list();

    if (count > 0 && this.designs.length) {
      this.design = structuredClone(this.designs[this.designs.length - 1]);
    }

    input.value = '';
    alert(`Imported ${count} design(s).`);
  }

  runSession(): void {
    this.save();
    window.location.href = '/';
  }

  dragPalette(item: PaletteItem, event: DragEvent): void {
    const payload: DragPayload = {
      source: 'palette',
      type: item.type,
      title: item.title,
      minHeight: item.minHeight,
    };

    event.dataTransfer?.setData('application/json', JSON.stringify(payload));
    event.dataTransfer?.setData('text/plain', item.type);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  dragPanel(column: DesignerColumn, panel: DesignerPanel, event: DragEvent): void {
    const payload: DragPayload = {
      source: 'layout',
      columnId: column.id,
      panelId: panel.id,
    };

    event.dataTransfer?.setData('application/json', JSON.stringify(payload));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  dropOnColumn(targetColumn: DesignerColumn, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const raw = event.dataTransfer?.getData('application/json');
    if (!raw) {
      return;
    }

    const payload = JSON.parse(raw) as DragPayload;

    if (payload.source === 'palette') {
      const panel: DesignerPanel = {
        id: `${payload.type}_${Math.random().toString(36).slice(2, 9)}`,
        type: payload.type,
        title: payload.title,
        expanded: true,
        collapsible: true,
        minHeight: payload.minHeight,
        height: null,
      };

      targetColumn.panels.push(panel);
      this.selection = { kind: 'panel', columnId: targetColumn.id, panelId: panel.id };
      this.touch();
      return;
    }

    const sourceColumn = this.findColumn(payload.columnId);
    const panel = this.findPanel(payload.columnId, payload.panelId);

    if (!sourceColumn || !panel) {
      return;
    }

    sourceColumn.panels = sourceColumn.panels.filter((p) => p.id !== panel.id);
    targetColumn.panels.push(panel);

    this.selection = { kind: 'panel', columnId: targetColumn.id, panelId: panel.id };
    this.touch();
  }

  startColumnResize(column: DesignerColumn, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.resizing = {
      kind: 'column',
      columnId: column.id,
      startX: event.clientX,
      startWidth: column.width,
    };
  }

  startPanelResize(column: DesignerColumn, panel: DesignerPanel, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.resizing = {
      kind: 'panel',
      columnId: column.id,
      panelId: panel.id,
      startY: event.clientY,
      startHeight: panel.height ?? panel.minHeight,
    };
  }

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (!this.resizing) {
      return;
    }

    if (this.resizing.kind === 'column') {
      const column = this.findColumn(this.resizing.columnId);
      if (!column) {
        return;
      }

      column.width = Math.max(160, this.resizing.startWidth + event.clientX - this.resizing.startX);
      this.touch();
      return;
    }

    const panel = this.findPanel(this.resizing.columnId, this.resizing.panelId);
    if (!panel) {
      return;
    }

    panel.height = Math.max(panel.minHeight, this.resizing.startHeight + event.clientY - this.resizing.startY);
    this.touch();
  }

  @HostListener('window:pointerup')
  onPointerUp(): void {
    this.resizing = null;
  }

  panelStyle(panel: DesignerPanel): Record<string, string> {
    const height = panel.height ? `${panel.height}px` : 'auto';
    return {
      minHeight: `${panel.minHeight}px`,
      height,
    };
  }

  trackByColumn(_: number, column: DesignerColumn): string {
    return column.id;
  }

  trackByPanel(_: number, panel: DesignerPanel): string {
    return panel.id;
  }

  private loadInitialDesign(): FlatlandDesign {
    const activeId = this.storage.activeId();
    const active = activeId ? this.storage.get(activeId) : undefined;
    const first = active ?? this.storage.list()[0];

    if (first) {
      return structuredClone(first);
    }

    const created = this.storage.createDefault();
    this.storage.save(created);
    this.designs = this.storage.list();
    return structuredClone(created);
  }

  private findColumn(id: string): DesignerColumn | undefined {
    return this.design.layout.columns.find((c) => c.id === id);
  }

  private findPanel(columnId: string, panelId: string): DesignerPanel | undefined {
    return this.findColumn(columnId)?.panels.find((p) => p.id === panelId);
  }

  private touch(): void {
    this.design.updatedAt = new Date().toISOString();
  }
}
