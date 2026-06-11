import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, inject, signal } from '@angular/core';
import { SessionStore } from '../../core/session.store';
import { PolicyName } from '../../core/models';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ToolbarComponent {
  store = inject(SessionStore);
  private api = inject(ApiService);
  newWidth = signal(50);
  newHeight = signal(20);
  newAgents = signal(3);

  policy = signal<PolicyName>('deadlock_avoidance');
  speed = signal(5);

  constructor() {
    // When backend session-policy changes (e.g. via scenario Confirm),
    // mirror it into the local toolbar selection so the radios reflect it.
    effect(() => {
      const active = this.store.activePolicy();
      if (active && active !== this.policy()) {
        this.policy.set(active);
      }
    });
  }


  newSession() {
    this.store.newSession({
      width: this.newWidth(),
      height: this.newHeight(),
      agents: this.newAgents(),
    });
  }

  reset() {
    this.store.reset();
  }

  step(n: number) {
    this.store.step(this.policy(), n);
  }

  setPolicy(p: PolicyName) {
    this.policy.set(p);
  }

  onPolicyChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target?.value) {
      const p = target.value as PolicyName;
      this.setPolicy(p);

      const sess = this.store.session();
      if (!sess) return;
      this.api.setPolicy(sess.id, p).subscribe({
        next: () => {
          this.store.setActivePolicy(p);
          this.store.previewScenarioId.set(null);
          this.store.refreshForecasts();
        },
        error: (e) => this.store.error.set(`Set policy failed: ${e.message}`),
      });
    }
  }

  togglePlay() {
    this.store.togglePlay(this.policy(), this.speed());
  }

  onSpeedChange(ev: Event) {
    const v = +(ev.target as HTMLInputElement).value;
    this.speed.set(v);
    if (this.store.playing()) {
      // Restart play with new speed
      this.store.play(this.policy(), v);
    }
  }

  /** Tooltip text for the currently selected policy (description). */
  policyDescription(): string {
    const id = this.policy();
    const info = this.store.availablePolicies().find((p) => p.id === id);
    return info?.description ?? '';
  }
}
