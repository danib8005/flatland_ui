import { Injectable, computed, signal } from '@angular/core';
import { PanelDefinition } from '../models/layout.models';
import { LayoutEventBusService } from './layout-event-bus.service';

@Injectable({
  providedIn: 'root',
})
export class PanelRegistryService {
  private readonly definitions = signal<Record<string, PanelDefinition>>({});

  readonly panelDefinitions = computed(() =>
    Object.values(this.definitions()).sort((a, b) =>
      a.title.localeCompare(b.title),
    ),
  );

  constructor(private readonly eventBus: LayoutEventBusService) {}

  register(definition: PanelDefinition): void {
    this.definitions.update((current) => ({
      ...current,
      [definition.type]: definition,
    }));

    this.eventBus.emit('panel.registered', definition);
  }

  unregister(type: string): void {
    this.definitions.update((current) => {
      const next = { ...current };
      delete next[type];
      return next;
    });
  }

  get(type: string): PanelDefinition | undefined {
    return this.definitions()[type];
  }

  has(type: string): boolean {
    return !!this.definitions()[type];
  }

  list(): PanelDefinition[] {
    return this.panelDefinitions();
  }
}
