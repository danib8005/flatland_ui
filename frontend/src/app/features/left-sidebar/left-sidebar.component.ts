import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionStore } from '../../core/session.store';
import { AgentColorService } from '../../core/agent-color.service';
import { AgentDTO } from '../../core/models';

type AgentGroup = 'MOVING' | 'WAITING' | 'DONE';

@Component({
  selector: 'app-left-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './left-sidebar.component.html',
  styleUrl: './left-sidebar.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LeftSidebarComponent {
  store = inject(SessionStore);
  private agentColors = inject(AgentColorService);

  // Collapsed state per group (default: all open).
  readonly collapsed = signal<Record<AgentGroup, boolean>>({
    MOVING: false,   // header is decorative, not clickable
    WAITING: true,
    DONE: false,
  });

  readonly totalCount = computed(() => this.store.agents().length);

  /** MOVING includes anyone currently *acting* on the map:
   *  READY_TO_DEPART, MOVING, STOPPED, MALFUNCTION. */
  readonly movingAgents = computed<AgentDTO[]>(() => {
    const list = this.store.agents().filter((a) =>
      ['READY_TO_DEPART', 'MOVING', 'STOPPED', 'MALFUNCTION'].includes(a.state),
    );
    // Sort: smaller (or more negative) time_to_deadline first → most urgent on top.
    return list.sort((a, b) => {
      const ta = a.time_to_deadline ?? Number.POSITIVE_INFINITY;
      const tb = b.time_to_deadline ?? Number.POSITIVE_INFINITY;
      return ta - tb;
    });
  });

  readonly waitingAgents = computed<AgentDTO[]>(() => {
    const list = this.store.agents().filter((a) => a.state === 'WAITING');
    // Sort: earliest departure first.
    return list.sort((a, b) => {
      const ea = a.earliest_departure ?? Number.POSITIVE_INFINITY;
      const eb = b.earliest_departure ?? Number.POSITIVE_INFINITY;
      return ea - eb;
    });
  });

  readonly doneAgents = computed<AgentDTO[]>(() => {
    const list = this.store.agents().filter((a) => a.state === 'DONE');
    return list.sort((a, b) => a.handle - b.handle);
  });

  readonly activeCount = computed(() => this.movingAgents().length);

  /** Total delay across all overdue agents (sum), and how many are delayed.
   *  Used for the global header badge. */
  readonly delaySummary = computed(() => {
    const overdue = this.store.agents().filter((a) => (a.delay ?? 0) > 0);
    const totalDelay = overdue.reduce((sum, a) => sum + (a.delay ?? 0), 0);
    return { count: overdue.length, totalDelay };
  });

  toggleGroup(group: AgentGroup): void {
    if (group === 'MOVING') return; // not collapsible
    this.collapsed.update((c) => ({ ...c, [group]: !c[group] }));
  }

  agentColor(handle: number): string {
    const state = this.isSelected(handle) ? 'focus' : 'default';
    return this.agentColors.getColor(handle, state);
  }

  isSelected(handle: number): boolean {
    return this.store.selectedHandles().has(handle);
  }

  toggleSelect(handle: number): void {
    this.store.toggleAgentSelection(handle);
  }

  onActionClick(handle: number, action: number, isOverride: boolean): void {
    if (isOverride) {
      this.store.clearOverride(handle);
    } else {
      this.store.setOverride(handle, action);
    }
  }

  isOverrideOption(handle: number, action: number): boolean {
    const a = this.store.agents().find((x) => x.handle === handle);
    return a?.override_action === action;
  }

  // ── presentation helpers ──────────────────────────────────────────

  /** READY_TO_DEPART with the departure window already open. */
  isOutsideReady(a: AgentDTO): boolean {
    return a.state === 'READY_TO_DEPART' && (a.eta_to_depart ?? 0) === 0;
  }

  isOverdue(a: AgentDTO): boolean {
    return (a.delay ?? 0) > 0;
  }

  /** Background colour for the time-to-deadline badge.
   *  Goes grey → orange as intensity grows, then deep orange when overdue. */
  deadlineBadgeStyle(a: AgentDTO): { [key: string]: string } {
    const t = a.delay_color_intensity ?? 0;
    // Grey base #d2d2d2, warm orange target #f59e0b (Tailwind amber-500).
    const r = Math.round(210 + (245 - 210) * t);
    const g = Math.round(210 + (158 - 210) * t);
    const b = Math.round(210 + (11 - 210) * t);
    const fg = t > 0.5 ? '#fff' : '#333';
    return {
      background: `rgb(${r}, ${g}, ${b})`,
      color: fg,
    };
  }

  /** Format the time-to-deadline as `-12` or `+5`. */
  formatDeadlineDelta(a: AgentDTO): string {
    const t = a.time_to_deadline;
    if (t === null || t === undefined) return '–';
    if (t >= 0) return `−${t}`;       // 'time remaining' → minus sign
    return `+${-t}`;                  // overdue → plus sign
  }

  formatEta(a: AgentDTO): string {
    const eta = a.eta_to_depart;
    if (eta === null || eta === undefined) return '–';
    if (eta === 0) return 'now';
    return `in ${eta}`;
  }
}
