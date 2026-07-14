// A small, reusable animation state machine. Characters declare named states
// and the conditions that select them; the machine picks the highest-priority
// state whose guard passes. This is deliberately data-driven so employees don't
// hardcode animation switches (a brief requirement).

export type CritterState =
  | 'idle'
  | 'typing'
  | 'sorting'
  | 'coffee'
  | 'celebrate'
  | 'panic'
  | 'sleep'
  | 'think'
  | 'carry'
  | 'fall'
  | 'present'
  | 'lookAtPlayer'
  | 'tap'
  | 'talk'
  | 'walk';

export interface CritterInputs {
  hired: boolean;
  producing: boolean;
  moving: boolean;
  lowMorale: boolean;
  celebrating: boolean;
  focusMode: boolean;
  interactedRecently: boolean;
  hovered: boolean;
}

interface StateRule {
  state: CritterState;
  priority: number;
  guard: (i: CritterInputs) => boolean;
}

const RULES: StateRule[] = [
  { state: 'celebrate', priority: 100, guard: (i) => i.celebrating },
  { state: 'panic', priority: 90, guard: (i) => i.lowMorale && i.producing },
  { state: 'walk', priority: 80, guard: (i) => i.moving },
  { state: 'tap', priority: 70, guard: (i) => i.hovered },
  { state: 'coffee', priority: 60, guard: (i) => i.interactedRecently },
  { state: 'typing', priority: 40, guard: (i) => i.producing && i.focusMode },
  { state: 'sorting', priority: 35, guard: (i) => i.producing },
  { state: 'sleep', priority: 20, guard: (i) => !i.producing && i.hired },
  { state: 'idle', priority: 0, guard: () => true },
];

export class CritterStateMachine {
  private current: CritterState = 'idle';
  private since = 0;

  update(inputs: CritterInputs, now: number): CritterState {
    let best: StateRule = RULES[RULES.length - 1];
    for (const rule of RULES) {
      if (rule.priority > best.priority && rule.guard(inputs)) best = rule;
      else if (rule.guard(inputs) && rule.priority >= best.priority) best = rule;
    }
    if (best.state !== this.current) {
      this.current = best.state;
      this.since = now;
    }
    return this.current;
  }

  get state(): CritterState {
    return this.current;
  }

  timeInState(now: number): number {
    return now - this.since;
  }
}
