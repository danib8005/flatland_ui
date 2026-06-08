import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FlatlandMapComponent } from '../flatland-map/flatland-map.component';

/**
 * Track-Layout: zentrale Karte des Dispatcher-HMI.
 * Aktuell duenner Wrapper um FlatlandMap.
 * In Phase E reagiert die Komponente auf:
 *   - FOCUS_INFRASTRUCTURE_ELEMENT (zoomt + highlightet)
 *   - LAYER_VISIBILITY_CHANGED (filtert Trains/Switches/Signals)
 *   - SIMULATION_TIME_CHANGED (rendert State bei Zeit t)
 */
@Component({
  selector: 'app-track-layout',
  standalone: true,
  imports: [FlatlandMapComponent],
  template: `
    <div class="track-layout-host">
      <app-flatland-map></app-flatland-map>
    </div>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-height: 0; min-width: 0; }
    .track-layout-host { display: flex; flex: 1; min-height: 0; min-width: 0; }
  `],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class TrackLayoutComponent {}
