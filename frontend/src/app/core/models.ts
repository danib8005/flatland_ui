export interface SessionInfo {
  id: string;
  width: number;
  height: number;
  num_agents: number;
}

export interface AgentDTO {
  handle: number;
  position: [number, number] | null;
  direction: number | null;
  initial_position: [number, number] | null;
  initial_direction: number | null;
  target: [number, number];
  state: string;
  speed: number;
  earliest_departure: number | null;
  latest_arrival: number | null;
}

export interface SessionState {
  width: number;
  height: number;
  num_agents: number;
  elapsed_steps: number;
  max_episode_steps: number;
  agents: AgentDTO[];
  rail_grid: number[][];
}

export interface StepResult {
  session_id: string;
  elapsed_steps: number;
  rewards: Record<string, number>;
  dones: Record<string, boolean>;
  all_done: boolean;
}

export interface SessionCreateRequest {
  width?: number;
  height?: number;
  number_of_agents?: number;
  seed?: number;
  max_num_cities?: number;
  max_rails_between_cities?: number;
  max_rail_pairs_in_city?: number;
}

export type PolicyName = "random" | "shortest_path";
