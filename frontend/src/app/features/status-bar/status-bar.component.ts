import { Component, inject } from '@angular/core';
import { SessionStore } from '../../core/session.store';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.scss',
})
export class StatusBarComponent {
  store = inject(SessionStore);
}
