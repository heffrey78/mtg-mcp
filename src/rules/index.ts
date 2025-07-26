export { MTGRulesEngine } from './engine';
export type { RuleValidationResult, GameAction, FormatRules } from './engine';
export { ZoneManager } from './zone-manager';
export type { Zone, ZoneChangeEvent } from './zone-manager';
export { TimingManager } from './timing';
export type { SpellSpeed, TimingWindow, TimingRestriction } from './timing';
export { TargetingManager } from './targeting';
export type { TargetType, TargetRestriction, Target } from './targeting';
export { StateBasedActionManager } from './state-based-actions';
export type { StateBasedAction } from './state-based-actions';

export class RulesEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RulesEngineError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public violations: string[] = [],
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class GameStateError extends Error {
  constructor(
    message: string,
    public gameState?: unknown,
    public action?: unknown
  ) {
    super(message);
    this.name = 'GameStateError';
  }
}