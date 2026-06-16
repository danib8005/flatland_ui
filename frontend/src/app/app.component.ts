import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, HostListener, effect, inject, signal } from '@angular/core';
import { ToolbarComponent } from './features/toolbar/toolbar.component';
import { AgentInspectorComponent } from './features/agent-inspector/agent-inspector.component';
import { AgentsPanelComponent } from './features/agents-panel/agents-panel.component';
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
    AgentsPanelComponent,
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
  newSeed = signal(42);
  newLatestDepartureMax = signal(20);
  newSpeedProfile = signal('uniform_1_0');
  newMaxNumCities = signal(4);
  newMaxRailsBetweenCities = signal(2);
  newMaxRailPairsInCity = signal(2);
  newLineLength = signal(4);

  settingsMode = signal(false);
  scenarioPolicyMode = signal(false);
  draftWidth = signal(50);
  draftHeight = signal(20);
  draftAgents = signal(3);
  draftMaxSteps = signal(1000);
  draftSeed = signal(42);
  draftLatestDepartureMax = signal(20);
  draftSpeedProfile = signal('uniform_1_0');
  draftMaxNumCities = signal(4);
  draftMaxRailsBetweenCities = signal(2);
  draftMaxRailPairsInCity = signal(2);
  draftLineLength = signal(4);
  draftScenarioPolicyIds = signal<string[]>([]);

  welcomeScenarioPolicyIds = signal<string[]>([]);
  pendingScenarioPolicyIds = signal<string[] | null>(null);
  pendingScenarioPreviousSessionId = signal<string | null>(null);

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
      const previousSid = this.pendingScenarioPreviousSessionId();
      if (!sid || !pending) return;

      // When resetting/recreating from an existing session, do not apply
      // pending settings to the old session. Wait until SessionStore exposes
      // the newly-created session id.
      if (previousSid !== null && sid === previousSid) return;

      this.pendingScenarioPolicyIds.set(null);
      this.pendingScenarioPreviousSessionId.set(null);
      this.api.setScenarioPolicies(sid, pending).subscribe({
        next: () => this.store.refreshForecasts(),
        error: (e) => this.store.error.set(`Set scenario policies failed: ${e.message}`),
      });
    });
  }

  onNewSession() {
    this.pendingScenarioPreviousSessionId.set(null);
    this.pendingScenarioPolicyIds.set(null);
    this.store.newSession({
      width: this.newWidth(),
      height: this.newHeight(),
      agents: this.newAgents(),
      maxSteps: this.newMaxSteps(),
      seed: this.newSeed(),
      maxNumCities: this.newMaxNumCities(),
      maxRailsBetweenCities: this.newMaxRailsBetweenCities(),
      maxRailPairsInCity: this.newMaxRailPairsInCity(),
      latestDepartureMax: this.newLatestDepartureMax(),
      speedProfile: this.newSpeedProfile(),
      lineLength: this.newLineLength(),
      scenarioPolicyIds: this.welcomeScenarioPolicyIds(),
    });
  }


  private blurActiveElement() {
    setTimeout(() => {
      const el = document.activeElement as HTMLElement | null;
      el?.blur?.();
    });
  }

  openSettings() {
    this.draftWidth.set(this.newWidth());
    this.draftHeight.set(this.newHeight());
    this.draftAgents.set(this.newAgents());
    this.draftMaxSteps.set(this.newMaxSteps());
    this.draftSeed.set(this.newSeed());
    this.draftLatestDepartureMax.set(this.newLatestDepartureMax());
    this.draftSpeedProfile.set(this.newSpeedProfile());
    this.draftMaxNumCities.set(this.newMaxNumCities());
    this.draftMaxRailsBetweenCities.set(this.newMaxRailsBetweenCities());
    this.draftMaxRailPairsInCity.set(this.newMaxRailPairsInCity());
    this.draftLineLength.set(this.newLineLength());
    this.draftScenarioPolicyIds.set([...this.welcomeScenarioPolicyIds()]);
    this.scenarioPolicyMode.set(false);
    this.settingsMode.set(true);
    this.blurActiveElement();
  }

  cancelSettings() {
    this.settingsMode.set(false);
    this.blurActiveElement();
  }

  applySettings() {
    this.newWidth.set(this.draftWidth());
    this.newHeight.set(this.draftHeight());
    this.newAgents.set(this.draftAgents());
    this.newMaxSteps.set(this.draftMaxSteps());
    this.newSeed.set(this.draftSeed());
    this.newLatestDepartureMax.set(this.draftLatestDepartureMax());
    this.newSpeedProfile.set(this.draftSpeedProfile());
    this.newMaxNumCities.set(this.draftMaxNumCities());
    this.newMaxRailsBetweenCities.set(this.draftMaxRailsBetweenCities());
    this.newMaxRailPairsInCity.set(this.draftMaxRailPairsInCity());
    this.newLineLength.set(this.draftLineLength());
    this.settingsMode.set(false);
    this.blurActiveElement();
  }


  openScenarioPolicySettings() {
    this.draftScenarioPolicyIds.set([...this.welcomeScenarioPolicyIds()]);
    this.settingsMode.set(false);
    this.scenarioPolicyMode.set(true);
    this.blurActiveElement();
  }

  cancelScenarioPolicySettings() {
    this.scenarioPolicyMode.set(false);
    this.blurActiveElement();
  }

  applyScenarioPolicySettings() {
    const enabledPolicies = [...this.draftScenarioPolicyIds()];
    this.welcomeScenarioPolicyIds.set(enabledPolicies);

    // Update local UI immediately: Scenario Panel + Toolbar dropdown must
    // drop disabled policies without waiting for a reset.
    this.store.setEnabledScenarioPolicyIds(enabledPolicies);
    this.store.previewScenarioId.set(null);
    this.scenarioPolicyMode.set(false);
    this.blurActiveElement();

    const sid = this.store.session()?.id;
    if (!sid) return;

    const active = this.store.activePolicy();
    const fallbackPolicy =
      this.store.availablePolicies().find((p) => p.is_default && enabledPolicies.includes(p.id))?.id ??
      this.store.availablePolicies().find((p) => enabledPolicies.includes(p.id))?.id ??
      enabledPolicies[0];

    const activeWasRemoved = !enabledPolicies.includes(active);
    const nextPolicy = activeWasRemoved ? fallbackPolicy : active;

    // Update local active policy immediately to avoid toolbar signal ping-pong.
    if (activeWasRemoved && nextPolicy) {
      this.store.setActivePolicy(nextPolicy as any);
    }

    this.api.setScenarioPolicies(sid, enabledPolicies).subscribe({
      next: () => {
        if (activeWasRemoved && nextPolicy) {
          this.api.setPolicy(sid, nextPolicy as any).subscribe({
            next: () => {
              this.store.setActivePolicy(nextPolicy as any);
              this.store.refreshForecasts();
            },
            error: (e) => this.store.error.set(`Set policy failed: ${e.message}`),
          });
        } else {
          this.store.refreshForecasts();
        }
      },
      error: (e) => this.store.error.set(`Set scenario policies failed: ${e.message}`),
    });
  }

  resetWithSettings() {
    if (this.settingsMode()) this.applySettings();
    if (this.scenarioPolicyMode()) this.applyScenarioPolicySettings();
    this.onNewSession();
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

  isDraftScenarioPolicyEnabled(policyId: string): boolean {
    return this.draftScenarioPolicyIds().includes(policyId);
  }

  toggleDraftScenarioPolicy(policyId: string, enabled: boolean) {
    const current = this.draftScenarioPolicyIds();
    const next = enabled
      ? Array.from(new Set([...current, policyId]))
      : current.filter((id) => id !== policyId);
    if (next.length === 0) return;
    this.draftScenarioPolicyIds.set(next);
  }

  @HostListener('document:keydown.escape', ['$event'])
  closeOpenDialog(event: KeyboardEvent) {
    if (!this.settingsMode() && !this.scenarioPolicyMode()) return;

    event.preventDefault();
    event.stopPropagation();

    if (this.settingsMode()) {
      this.cancelSettings();
      return;
    }
    if (this.scenarioPolicyMode()) {
      this.cancelScenarioPolicySettings();
    }
  }

  ngOnInit(): void {
    this.store.loadPolicies();
  }
}
