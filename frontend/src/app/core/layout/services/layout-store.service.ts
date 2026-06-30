import { Injectable, computed, signal } from '@angular/core';
import {
  LayoutState,
  LayoutZone,
  PanelInstance,
  createDefaultLayoutState,
} from '../models/layout.models';
import { LayoutEventBusService } from './layout-event-bus.service';

@Injectable({
  providedIn: 'root',
})
export class LayoutStoreService {
  private readonly state = signal<LayoutState>(createDefaultLayoutState());

  readonly layout = computed(() => this.state());

  readonly panels = computed(() =>
    [...this.state().panels].sort((a, b) => a.order - b.order),
  );

  constructor(private readonly eventBus: LayoutEventBusService) {}

  snapshot(): LayoutState {
    return this.state();
  }

  setState(nextState: LayoutState): void {
    this.state.set(nextState);
    this.eventBus.emit('layout.changed', nextState);
  }

  panelsByZone(zone: LayoutZone): PanelInstance[] {
    return this.panels().filter(
      (panel) => panel.zone === zone && !panel.hidden,
    );
  }

  addPanel(panel: PanelInstance): void {
    this.state.update((current) => ({
      ...current,
      panels: [...current.panels, panel],
    }));

    this.eventBus.emit('panel.added', panel);
    this.eventBus.emit('layout.changed', this.state());
  }

  updatePanel(
    panelId: string,
    patch: Partial<PanelInstance>,
  ): void {
    let updatedPanel: PanelInstance | undefined;

    this.state.update((current) => ({
      ...current,
      panels: current.panels.map((panel) => {
        if (panel.id !== panelId) {
          return panel;
        }

        updatedPanel = {
          ...panel,
          ...patch,
        };

        return updatedPanel;
      }),
    }));

    if (updatedPanel) {
      this.eventBus.emit('panel.updated', updatedPanel);
      this.eventBus.emit('layout.changed', this.state());
    }
  }

  removePanel(panelId: string): void {
    const panel = this.state().panels.find((item) => item.id === panelId);

    this.state.update((current) => ({
      ...current,
      panels: current.panels.filter((item) => item.id !== panelId),
    }));

    this.eventBus.emit('panel.removed', panelId);

    if (panel) {
      this.eventBus.emit('layout.changed', this.state());
    }
  }

  movePanel(
    panelId: string,
    zone: LayoutZone,
    order: number,
  ): void {
    this.updatePanel(panelId, {
      zone,
      order,
    });

    this.eventBus.emit('panel.moved', {
      panelId,
      zone,
      order,
    });
  }

  setCollapsed(panelId: string, collapsed: boolean): void {
    this.updatePanel(panelId, {
      collapsed,
    });

    this.eventBus.emit(
      collapsed ? 'panel.collapsed' : 'panel.expanded',
      panelId,
    );
  }

  selectPanel(panelId?: string): void {
    this.state.update((current) => ({
      ...current,
      selectedPanelId: panelId,
    }));

    this.eventBus.emit('designer.changed', {
      selectedPanelId: panelId,
    });
  }
}
