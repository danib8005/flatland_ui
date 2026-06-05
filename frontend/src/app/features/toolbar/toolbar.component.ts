import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';
import { SessionStore } from '../../core/session.store';
import { PolicyName } from '../../core/models';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ToolbarComponent {
  store = inject(SessionStore);
  newWidth = signal(50);
  newHeight = signal(20);
  newAgents = signal(3);

  policy = signal<PolicyName>('shortest_path');
  speed = signal(5);

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
      this.setPolicy(target.value as PolicyName);
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
}
