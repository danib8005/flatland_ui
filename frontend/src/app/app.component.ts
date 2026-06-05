import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';
import { ToolbarComponent } from './features/toolbar/toolbar.component';
import { FlatlandMapComponent } from './features/flatland-map/flatland-map.component';
import { AgentInspectorComponent } from './features/agent-inspector/agent-inspector.component';
import { LeftSidebarComponent } from './features/left-sidebar/left-sidebar.component';
import { ViewToggleComponent } from './features/view-toggle/view-toggle.component';
import { MareyChartComponent } from './features/marey-chart/marey-chart.component';
import { SessionStore } from './core/session.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ToolbarComponent,
    FlatlandMapComponent,
    AgentInspectorComponent,
    LeftSidebarComponent,
    ViewToggleComponent,
    MareyChartComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent {
  store = inject(SessionStore);

  newWidth = signal(50);
  newHeight = signal(20);
  newAgents = signal(3);

  onNewSession() {
    this.store.newSession({
      width: this.newWidth(),
      height: this.newHeight(),
      agents: this.newAgents(),
    });
  }
}
