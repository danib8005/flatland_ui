import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { SessionStore } from '../../core/session.store';
import { EventBusService } from '../../core/events/event-bus.service';
import { LayerVisibility } from '../../core/events/event-types';

/**
 * Layer-Visibility: Toggles fuer Trains / Switches / Signals.
 * Stand: kontrolliert nur den Store-Signal layerVisibility.
 * In Phase E emittiert es LAYER_VISIBILITY_CHANGED auf den EventBus.
 */
@Component({
  selector: 'app-layer-visibility',
  standalone: true,
  templateUrl: './layer-visibility.component.html',
  styleUrl: './layer-visibility.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LayerVisibilityComponent {
  store = inject(SessionStore);
  bus = inject(EventBusService);

  toggle(layer: keyof LayerVisibility) {
    const cur = this.store.layerVisibility();
    const next: LayerVisibility = { ...cur, [layer]: !cur[layer] };
    this.store.layerVisibility.set(next);
    this.bus.emit({ type: 'LAYER_VISIBILITY_CHANGED', layers: next });
  }
}
