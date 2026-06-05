import { Component, computed, inject } from '@angular/core';
import { SessionStore, TrajectoryPoint } from '../../core/session.store';

const AGENT_COLORS = [
  '#eb0000', '#0079c7', '#00973b', '#ffaa00', '#9c4ddc',
  '#b3489e', '#0aafa5', '#5a4f3f', '#a3641c', '#3f4d8c',
];

interface AgentLine {
  handle: number;
  color: string;
  pathD: string;
  selected: boolean;
}

interface Tick {
  v: number;
  pos: number;
  label: string;
}

@Component({
  selector: 'app-marey-chart',
  standalone: true,
  templateUrl: './marey-chart.component.html',
  styleUrl: './marey-chart.component.scss',
})
export class MareyChartComponent {
  store = inject(SessionStore);

  readonly margin = { top: 20, right: 24, bottom: 36, left: 56 };
  readonly chartWidth = 900;
  readonly chartHeight = 300;

  readonly innerWidth = computed(() => this.chartWidth - this.margin.left - this.margin.right);
  readonly innerHeight = computed(() => this.chartHeight - this.margin.top - this.margin.bottom);

  readonly maxStep = computed(() =>
    Math.max(this.store.maxSteps(), this.store.elapsedSteps(), 10),
  );

  // y-axis = "distance to target" (Manhattan, normalized 0-100%)
  // i.e. agent starts at top (= 100% to go), arrives at bottom (= 0%)

  readonly viewBox = computed(() => `0 0 ${this.chartWidth} ${this.chartHeight}`);

  readonly xTicks = computed<Tick[]>(() => {
    const max = this.maxStep();
    const n = 6;
    const step = Math.max(1, Math.ceil(max / n));
    const ticks: Tick[] = [];
    for (let i = 0; i <= n; i++) {
      const v = i * step;
      if (v > max) break;
      ticks.push({ v, pos: this._scaleX(v), label: String(v) });
    }
    return ticks;
  });

  readonly yTicks = computed<Tick[]>(() => {
    const ticks: Tick[] = [];
    for (let pct = 0; pct <= 100; pct += 25) {
      ticks.push({
        v: pct,
        pos: this._scaleY(pct),
        label: `${pct}%`,
      });
    }
    return ticks;
  });

  readonly lines = computed<AgentLine[]>(() => {
    const trajectories = this.store.trajectories();
    const agents = this.store.agents();
    const selected = this.store.selectedHandles();
    const result: AgentLine[] = [];

    for (const a of agents) {
      const points = trajectories.get(a.handle) ?? [];
      const target = a.target;
      if (!target) continue;

      const segments: string[] = [];
      let started = false;
      for (const pt of points) {
        if (!pt.position) continue;
        const dist = this._distToTarget(pt.position, target);
        const distPct = (dist / Math.max(1, this._maxDistForAgent(a))) * 100;
        const x = this._scaleX(pt.step);
        const y = this._scaleY(100 - distPct);  // invert: 100% remaining = top
        segments.push(`${started ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`);
        started = true;
      }

      if (segments.length === 0) continue;

      result.push({
        handle: a.handle,
        color: AGENT_COLORS[a.handle % AGENT_COLORS.length],
        pathD: segments.join(' '),
        selected: selected.has(a.handle),
      });
    }

    return result;
  });

  private _scaleX(stepValue: number): number {
    const ratio = stepValue / Math.max(1, this.maxStep());
    return this.margin.left + ratio * this.innerWidth();
  }

  private _scaleY(pct: number): number {
    // pct: 0 = bottom, 100 = top  (we flip in lines() above)
    const ratio = pct / 100;
    return this.margin.top + (1 - ratio) * this.innerHeight();
  }

  private _distToTarget(pos: [number, number], target: [number, number]): number {
    return Math.abs(pos[0] - target[0]) + Math.abs(pos[1] - target[1]);
  }

  private _maxDistForAgent(a: any): number {
    if (!a.initial_position || !a.target) return 1;
    return this._distToTarget(a.initial_position, a.target);
  }

  toggleSelect(handle: number) {
    this.store.toggleAgentSelection(handle);
  }

  trackByLine = (_: number, l: AgentLine) => l.handle;
  trackByTick = (_: number, t: Tick) => t.v;
}
