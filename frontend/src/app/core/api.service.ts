import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  SessionInfo,
  SessionState,
  StepResult,
  SessionCreateRequest,
  PolicyName,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = '/api';

  createSession(req: SessionCreateRequest = {}): Observable<SessionInfo> {
    return this.http.post<SessionInfo>(`${this.base}/session`, {
      width: 30,
      height: 30,
      number_of_agents: 3,
      ...req,
    });
  }

  getState(sessionId: string): Observable<SessionState> {
    return this.http.get<SessionState>(`${this.base}/session/${sessionId}/state`);
  }

  step(sessionId: string, policy: PolicyName, n_steps: number = 1): Observable<StepResult> {
    return this.http.post<StepResult>(`${this.base}/session/${sessionId}/step`, {
      policy,
      n_steps,
    });
  }

  manualAction(sessionId: string, handle: number, action: number) {
    return this.http.post(`${this.base}/session/${sessionId}/action`, {
      handle,
      action,
    });
  }

  deleteSession(sessionId: string) {
    return this.http.delete(`${this.base}/session/${sessionId}`);
  }

  listSessions(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/session`);
  }
}
