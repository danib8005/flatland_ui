import { Component, HostBinding, Input } from '@angular/core';
import { PanelInstance } from '../../../../core/layout';

import { NotificationsPanelComponent } from '../../../notifications-panel/notifications-panel.component';
import { AgentsPanelComponent } from '../../../agents-panel/agents-panel.component';
import { KpiFilterComponent } from '../../../kpi-filter/kpi-filter.component';
import { ScenarioPanelComponent } from '../../../scenario-panel/scenario-panel.component';
import { RecommendationsPanelComponent } from '../../../recommendations-panel/recommendations-panel.component';
import { ImpactPanelComponent } from '../../../impact-panel/impact-panel.component';
import { FlatlandMapComponent } from '../../../flatland-map/flatland-map.component';
import { GraphicTimetableComponent } from '../../../graphic-timetable/graphic-timetable.component';
import { SituationSummaryComponent } from '../../../situation-summary/situation-summary.component';

import { AgentInspectorComponent } from '../../../agent-inspector/agent-inspector.component';
import { GoalAchievementPanelComponent } from '../../../../shared/layout/panels/goal-achievement-panel/goal-achievement-panel.component';
@Component({
  selector: 'app-panel-plugin-host',
  standalone: true,
  imports: [GoalAchievementPanelComponent, 
    AgentInspectorComponent,
    NotificationsPanelComponent,
    AgentsPanelComponent,
    KpiFilterComponent,
    ScenarioPanelComponent,
    RecommendationsPanelComponent,
    ImpactPanelComponent,
    FlatlandMapComponent,
    GraphicTimetableComponent,
    SituationSummaryComponent,
  ],
  templateUrl: './panel-plugin-host.component.html',
  styleUrl: './panel-plugin-host.component.scss',
})
export class PanelPluginHostComponent {
  @Input({ required: true }) panel!: PanelInstance;

  @HostBinding('attr.data-panel-type')
  get hostPanelType(): string | null {
    return this.panel?.type ?? null;
  }

  get isCanvasPanel(): boolean {
    return this.panel?.type === 'flatland-map' || this.panel?.type === 'graphic-timetable';
  }
}
