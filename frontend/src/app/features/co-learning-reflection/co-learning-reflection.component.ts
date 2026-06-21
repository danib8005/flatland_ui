import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject, signal } from '@angular/core';
import { SessionStore } from '../../core/session.store';

interface ReflectionQuestion {
  key: string;
  text: string;
  type: 'radio' | 'text';
  options?: string[];
}

/**
 * Post-session reflection for Co-Learning mode (WP 3.3). Mirrors the
 * SelfReflection questionnaire from AI4REALNET/T3.3-3.4-HMI and surfaces the
 * human interventions captured during the run. Frontend-only for now; answers
 * are kept in component state until a persistence layer exists.
 */
@Component({
  selector: 'app-co-learning-reflection',
  standalone: true,
  templateUrl: './co-learning-reflection.component.html',
  styleUrl: './co-learning-reflection.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CoLearningReflectionComponent {
  store = inject(SessionStore);

  /** Hidden once the user finishes/dismisses the reflection. */
  readonly dismissed = signal(false);

  readonly interventions = computed(() => this.store.coLearningFeedback());

  readonly questions: ReflectionQuestion[] = [
    { key: 'expected', text: 'Did the outcome match what you expected?', type: 'radio', options: ['Yes', 'No'] },
    { key: 'happened', text: 'What happened during the run?', type: 'text' },
    { key: 'change', text: 'What would you change next time?', type: 'text' },
    { key: 'insights', text: 'What general insights do you draw from this?', type: 'text' },
    { key: 'success', text: 'How would you measure success here?', type: 'text' },
  ];

  readonly answers = signal<Record<string, string>>({});

  setAnswer(key: string, value: string): void {
    this.answers.update((a) => ({ ...a, [key]: value }));
  }

  finish(): void {
    this.dismissed.set(true);
  }
}
