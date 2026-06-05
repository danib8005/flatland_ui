import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { ToolbarComponent } from './features/toolbar/toolbar.component';
import { FlatlandMapComponent } from './features/flatland-map/flatland-map.component';
import { AgentInspectorComponent } from './features/agent-inspector/agent-inspector.component';
import { SessionStore } from './core/session.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ToolbarComponent, FlatlandMapComponent, AgentInspectorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent {
  store = inject(SessionStore);
}
