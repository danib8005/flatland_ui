import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { MareyChartComponent } from '../marey-chart/marey-chart.component';

/**
 * Graphic-Timetable: Time-Distance-Diagramm der Zugbewegungen.
 * Aktuell duenner Wrapper um MareyChart.
 * In Phase E reagiert die Komponente auf:
 *   - SIMULATION_TIME_CHANGED (Vertikal-Linie an Zeit t)
 *   - FOCUS_INFRASTRUCTURE_ELEMENT (Train highlight)
 */
@Component({
  selector: 'app-graphic-timetable',
  standalone: true,
  imports: [MareyChartComponent],
  template: `
    <div class="timetable-host">
      <app-marey-chart></app-marey-chart>
    </div>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-height: 0; min-width: 0; }
    .timetable-host { display: flex; flex: 1; min-height: 0; min-width: 0; }
  `],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class GraphicTimetableComponent {}
