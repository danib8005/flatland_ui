import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, effect, inject, signal } from '@angular/core';
import { ToolbarComponent } from './features/toolbar/toolbar.component';
import { AgentInspectorComponent } from './features/agent-inspector/agent-inspector.component';
import { LeftSidebarComponent } from './features/left-sidebar/left-sidebar.component';
import { ViewToggleComponent } from './features/view-toggle/view-toggle.component';
import { TrackLayoutComponent } from './features/track-layout/track-layout.component';
import { GraphicTimetableComponent } from './features/graphic-timetable/graphic-timetable.component';
import { LayerVisibilityComponent } from './features/layer-visibility/layer-visibility.component';
import { NotificationsPanelComponent } from './features/notifications-panel/notifications-panel.component';
import { ScenarioPanelComponent } from './features/scenario-panel/scenario-panel.component';
import { KpiFilterComponent } from './features/kpi-filter/kpi-filter.component';
import { RecommendationsPanelComponent } from './features/recommendations-panel/recommendations-panel.component';
import { ApiService } from './core/api.service';
import { SessionStore } from './core/session.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ToolbarComponent,
    TrackLayoutComponent,
    GraphicTimetableComponent,
    LayerVisibilityComponent,
    NotificationsPanelComponent,
    ScenarioPanelComponent,
    KpiFilterComponent,
    RecommendationsPanelComponent,
    AgentInspectorComponent,
    LeftSidebarComponent,
    ViewToggleComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent implements OnInit {
  store = inject(SessionStore);
  private api = inject(ApiService);

  newWidth = signal(50);
  newHeight = signal(20);
  newAgents = signal(3);
  newMaxSteps = signal(1000);
  welcomeScenarioPolicyIds = signal<string[]>([]);
  pendingScenarioPolicyIds = signal<string[] | null>(null);

  constructor() {
    effect(() => {
      const available = this.store.availablePolicies();
      if (available.length > 0 && this.welcomeScenarioPolicyIds().length === 0) {
        this.welcomeScenarioPolicyIds.set(available.map((p) => p.id));
      }
    });

    effect(() => {
      const sid = this.store.session()?.id;
      const pending = this.pendingScenarioPolicyIds();
      if (!sid || !pending) return;

      this.pendingScenarioPolicyIds.set(null);
      this.api.setScenarioPolicies(sid, pending).subscribe({
        next: () => this.store.refreshForecasts(),
        error: (e) => this.store.error.set(`Set scenario policies failed: ${e.message}`),
      });
    });
  }

  onNewSession() {
    this.pendingScenarioPolicyIds.set(this.welcomeScenarioPolicyIds());
    this.store.newSession({
      width: this.newWidth(),
      height: this.newHeight(),
      agents: this.newAgents(),
      maxSteps: this.newMaxSteps(),
    });
  }

  isWelcomeScenarioPolicyEnabled(policyId: string): boolean {
    return this.welcomeScenarioPolicyIds().includes(policyId);
  }

  toggleWelcomeScenarioPolicy(policyId: string, enabled: boolean) {
    const current = this.welcomeScenarioPolicyIds();
    const next = enabled
      ? Array.from(new Set([...current, policyId]))
      : current.filter((id) => id !== policyId);
    if (next.length === 0) return;
    this.welcomeScenarioPolicyIds.set(next);
  }

  ngOnInit(): void {
    this.store.loadPolicies();
  }
}
