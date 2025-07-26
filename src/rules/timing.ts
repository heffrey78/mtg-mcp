import { MTGCard, GameState } from '../types';

export type SpellSpeed = 'sorcery' | 'instant' | 'ability';
export type TimingWindow = 'main_phase' | 'any_time' | 'combat_only' | 'upkeep_only';

export interface TimingRestriction {
  speed: SpellSpeed;
  window: TimingWindow;
  stackEmpty: boolean;
  activePlayer: boolean;
  specialConditions?: string[];
}

export class TimingManager {
  private static instance: TimingManager;

  static getInstance(): TimingManager {
    if (!TimingManager.instance) {
      TimingManager.instance = new TimingManager();
    }
    return TimingManager.instance;
  }

  canCastSpell(card: MTGCard, gameState: GameState, player: 'player' | 'ai'): boolean {
    const timing = this.getCardTiming(card);
    return this.validateTiming(timing, gameState, player);
  }

  canActivateAbility(card: MTGCard, gameState: GameState, player: 'player' | 'ai', abilityText?: string): boolean {
    const timing = this.getAbilityTiming(card, abilityText);
    return this.validateTiming(timing, gameState, player);
  }

  canPlayLand(gameState: GameState, player: 'player' | 'ai'): boolean {
    const timing: TimingRestriction = {
      speed: 'sorcery',
      window: 'main_phase',
      stackEmpty: true,
      activePlayer: true
    };
    return this.validateTiming(timing, gameState, player);
  }

  private validateTiming(timing: TimingRestriction, gameState: GameState, player: 'player' | 'ai'): boolean {
    if (!this.checkSpeedTiming(timing.speed, gameState)) {
      return false;
    }

    if (!this.checkWindowTiming(timing.window, gameState)) {
      return false;
    }

    if (timing.stackEmpty && gameState.stack.length > 0) {
      return false;
    }

    if (timing.activePlayer && gameState.active_player !== player) {
      return false;
    }

    if (gameState.priority !== player) {
      return false;
    }

    if (timing.specialConditions) {
      for (const condition of timing.specialConditions) {
        if (!this.checkSpecialCondition(condition, gameState, player)) {
          return false;
        }
      }
    }

    return true;
  }

  private checkSpeedTiming(speed: SpellSpeed, gameState: GameState): boolean {
    switch (speed) {
      case 'instant':
        return true;
      case 'sorcery':
        return (gameState.phase === 'main1' || gameState.phase === 'main2') && 
               gameState.stack.length === 0;
      case 'ability':
        return true;
      default:
        return false;
    }
  }

  private checkWindowTiming(window: TimingWindow, gameState: GameState): boolean {
    switch (window) {
      case 'any_time':
        return true;
      case 'main_phase':
        return gameState.phase === 'main1' || gameState.phase === 'main2';
      case 'combat_only':
        return gameState.phase === 'combat';
      case 'upkeep_only':
        return gameState.phase === 'upkeep';
      default:
        return false;
    }
  }

  private checkSpecialCondition(condition: string, gameState: GameState, player: 'player' | 'ai'): boolean {
    switch (condition) {
      case 'only_your_turn':
        return gameState.active_player === player;
      case 'only_opponent_turn':
        return gameState.active_player !== player;
      case 'creatures_attacking':
        return Boolean(gameState.combat?.attackers && gameState.combat.attackers.length > 0);
      case 'no_creatures_attacking':
        return !gameState.combat?.attackers.length;
      case 'beginning_of_combat':
        return gameState.phase === 'combat' && !gameState.step;
      case 'end_of_turn':
        return gameState.phase === 'end';
      default:
        return true;
    }
  }

  private getCardTiming(card: MTGCard): TimingRestriction {
    const typeRestrictions = this.getTypeBasedTiming(card);
    const textRestrictions = this.getTextBasedTiming(card);
    
    return {
      speed: textRestrictions.speed || typeRestrictions.speed,
      window: textRestrictions.window || typeRestrictions.window,
      stackEmpty: textRestrictions.stackEmpty ?? typeRestrictions.stackEmpty,
      activePlayer: textRestrictions.activePlayer ?? typeRestrictions.activePlayer,
      specialConditions: [
        ...(typeRestrictions.specialConditions || []),
        ...(textRestrictions.specialConditions || [])
      ]
    };
  }

  private getTypeBasedTiming(card: MTGCard): TimingRestriction {
    const typeLine = card.type_line.toLowerCase();

    if (typeLine.includes('instant')) {
      return {
        speed: 'instant',
        window: 'any_time',
        stackEmpty: false,
        activePlayer: false
      };
    }

    if (typeLine.includes('sorcery')) {
      return {
        speed: 'sorcery',
        window: 'main_phase',
        stackEmpty: true,
        activePlayer: true
      };
    }

    if (typeLine.includes('creature') || 
        typeLine.includes('artifact') || 
        typeLine.includes('enchantment') ||
        typeLine.includes('planeswalker')) {
      return {
        speed: 'sorcery',
        window: 'main_phase',
        stackEmpty: true,
        activePlayer: true
      };
    }

    if (typeLine.includes('land')) {
      return {
        speed: 'sorcery',
        window: 'main_phase',
        stackEmpty: true,
        activePlayer: true,
        specialConditions: ['only_your_turn']
      };
    }

    return {
      speed: 'sorcery',
      window: 'main_phase',
      stackEmpty: true,
      activePlayer: true
    };
  }

  private getTextBasedTiming(card: MTGCard): Partial<TimingRestriction> {
    const text = card.oracle_text?.toLowerCase() || '';
    const restrictions: Partial<TimingRestriction> = {};

    if (text.includes('flash')) {
      restrictions.speed = 'instant';
      restrictions.window = 'any_time';
      restrictions.stackEmpty = false;
      restrictions.activePlayer = false;
    }

    if (text.includes('can only be cast during combat')) {
      restrictions.window = 'combat_only';
    }

    if (text.includes('can only be cast during your turn')) {
      restrictions.specialConditions = ['only_your_turn'];
    }

    if (text.includes('can only be cast during an opponent\'s turn')) {
      restrictions.specialConditions = ['only_opponent_turn'];
    }

    if (text.includes('can only be cast if a creature attacked this turn')) {
      restrictions.specialConditions = ['creatures_attacking'];
    }

    return restrictions;
  }

  private getAbilityTiming(card: MTGCard, abilityText?: string): TimingRestriction {
    const text = (abilityText || card.oracle_text || '').toLowerCase();

    if (text.includes('activate only as a sorcery') || text.includes('activate this ability only any time you could cast a sorcery')) {
      return {
        speed: 'sorcery',
        window: 'main_phase',
        stackEmpty: true,
        activePlayer: true
      };
    }

    if (text.includes('activate only during combat')) {
      return {
        speed: 'ability',
        window: 'combat_only',
        stackEmpty: false,
        activePlayer: false
      };
    }

    if (text.includes('activate only during your turn')) {
      return {
        speed: 'ability',
        window: 'any_time',
        stackEmpty: false,
        activePlayer: false,
        specialConditions: ['only_your_turn']
      };
    }

    return {
      speed: 'ability',
      window: 'any_time',
      stackEmpty: false,
      activePlayer: false
    };
  }

  getNextPriorityPlayer(gameState: GameState): 'player' | 'ai' {
    if (gameState.stack.length === 0) {
      return gameState.active_player;
    }

    return gameState.priority === 'player' ? 'ai' : 'player';
  }

  shouldAdvancePhase(gameState: GameState): boolean {
    return gameState.stack.length === 0 && 
           this.bothPlayersPassedPriority(gameState);
  }

  private bothPlayersPassedPriority(gameState: GameState): boolean {
    return true;
  }
}