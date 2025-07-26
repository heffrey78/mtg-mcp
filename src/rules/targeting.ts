import { MTGCard, GameState } from '../types';

export type TargetType = 'creature' | 'player' | 'planeswalker' | 'spell' | 'permanent' | 'card_in_graveyard' | 'any';

export interface TargetRestriction {
  type: TargetType;
  count: number;
  optional: boolean;
  restrictions?: string[];
}

export interface Target {
  id: string;
  type: TargetType;
  controller: 'player' | 'ai';
}

export class TargetingManager {
  private static instance: TargetingManager;

  static getInstance(): TargetingManager {
    if (!TargetingManager.instance) {
      TargetingManager.instance = new TargetingManager();
    }
    return TargetingManager.instance;
  }

  parseTargetRequirements(card: MTGCard): TargetRestriction[] {
    const text = card.oracle_text || '';
    const requirements: TargetRestriction[] = [];

    const targetMatches = text.match(/(target\s+[^.]*)/gi) || [];
    
    for (const match of targetMatches) {
      const requirement = this.parseTargetClause(match);
      if (requirement) {
        requirements.push(requirement);
      }
    }

    return requirements;
  }

  validateTargets(card: MTGCard, targets: Target[], gameState: GameState): boolean {
    const requirements = this.parseTargetRequirements(card);
    
    if (requirements.length === 0 && targets.length === 0) {
      return true;
    }

    if (requirements.length !== targets.length) {
      return false;
    }

    for (let i = 0; i < requirements.length; i++) {
      const requirement = requirements[i];
      const target = targets[i];
      if (!requirement || !target || !this.validateSingleTarget(requirement, target, gameState)) {
        return false;
      }
    }

    return true;
  }

  getValidTargets(card: MTGCard, gameState: GameState, player: 'player' | 'ai'): Target[] {
    const requirements = this.parseTargetRequirements(card);
    const validTargets: Target[] = [];

    for (const requirement of requirements) {
      const targets = this.findValidTargetsForRequirement(requirement, gameState, player);
      validTargets.push(...targets);
    }

    return validTargets;
  }

  private parseTargetClause(clause: string): TargetRestriction | null {
    const text = clause.toLowerCase();

    let type: TargetType = 'any';
    let count = 1;
    let optional = false;
    const restrictions: string[] = [];

    if (text.includes('creature')) {
      type = 'creature';
    } else if (text.includes('player')) {
      type = 'player';
    } else if (text.includes('planeswalker')) {
      type = 'planeswalker';
    } else if (text.includes('spell')) {
      type = 'spell';
    } else if (text.includes('permanent')) {
      type = 'permanent';
    } else if (text.includes('card in') && text.includes('graveyard')) {
      type = 'card_in_graveyard';
    }

    const countMatch = text.match(/(\w+)\s+target/);
    if (countMatch) {
      const countWord = countMatch[1];
      switch (countWord) {
        case 'one': case 'a': case 'target': count = 1; break;
        case 'two': count = 2; break;
        case 'three': count = 3; break;
        case 'up': 
          optional = true;
          const upMatch = text.match(/up to (\w+)/);
          if (upMatch) {
            switch (upMatch[1]) {
              case 'one': count = 1; break;
              case 'two': count = 2; break;
              case 'three': count = 3; break;
            }
          }
          break;
      }
    }

    if (text.includes('you control')) {
      restrictions.push('you_control');
    }
    if (text.includes('you don\'t control') || text.includes('an opponent controls')) {
      restrictions.push('opponent_controls');
    }
    if (text.includes('attacking')) {
      restrictions.push('attacking');
    }
    if (text.includes('blocking')) {
      restrictions.push('blocking');
    }
    if (text.includes('tapped')) {
      restrictions.push('tapped');
    }
    if (text.includes('untapped')) {
      restrictions.push('untapped');
    }
    if (text.includes('nonland')) {
      restrictions.push('nonland');
    }
    if (text.includes('non-creature')) {
      restrictions.push('non-creature');
    }

    return {
      type,
      count,
      optional,
      restrictions
    };
  }

  private validateSingleTarget(requirement: TargetRestriction, target: Target, gameState: GameState): boolean {
    if (!this.targetExists(target, gameState)) {
      return false;
    }

    if (requirement.type !== 'any' && requirement.type !== target.type) {
      return false;
    }

    if (requirement.restrictions) {
      for (const restriction of requirement.restrictions) {
        if (!this.validateRestriction(restriction, target, gameState)) {
          return false;
        }
      }
    }

    return true;
  }

  private findValidTargetsForRequirement(
    requirement: TargetRestriction, 
    gameState: GameState, 
    controller: 'player' | 'ai'
  ): Target[] {
    const targets: Target[] = [];

    switch (requirement.type) {
      case 'creature':
        targets.push(...this.findCreatureTargets(gameState, requirement, controller));
        break;
      case 'player':
        targets.push(...this.findPlayerTargets(gameState, requirement, controller));
        break;
      case 'planeswalker':
        targets.push(...this.findPlaneswalkerTargets(gameState, requirement, controller));
        break;
      case 'permanent':
        targets.push(...this.findPermanentTargets(gameState, requirement, controller));
        break;
      case 'spell':
        targets.push(...this.findSpellTargets(gameState, requirement, controller));
        break;
      case 'card_in_graveyard':
        targets.push(...this.findGraveyardTargets(gameState, requirement, controller));
        break;
    }

    return targets.filter(target => {
      if (!requirement.restrictions) return true;
      return requirement.restrictions.every(restriction => 
        this.validateRestriction(restriction, target, gameState)
      );
    });
  }

  private findCreatureTargets(
    gameState: GameState, 
    requirement: TargetRestriction, 
    controller: 'player' | 'ai'
  ): Target[] {
    const targets: Target[] = [];

    for (const [player, battlefield] of Object.entries(gameState.battlefield)) {
      for (const card of battlefield) {
        if (this.isCreature(card)) {
          targets.push({
            id: card.id,
            type: 'creature',
            controller: player as 'player' | 'ai'
          });
        }
      }
    }

    return targets;
  }

  private findPlayerTargets(
    gameState: GameState, 
    requirement: TargetRestriction, 
    controller: 'player' | 'ai'
  ): Target[] {
    return [
      { id: 'player', type: 'player', controller: 'player' },
      { id: 'ai', type: 'player', controller: 'ai' }
    ];
  }

  private findPlaneswalkerTargets(
    gameState: GameState, 
    requirement: TargetRestriction, 
    controller: 'player' | 'ai'
  ): Target[] {
    const targets: Target[] = [];

    for (const [player, battlefield] of Object.entries(gameState.battlefield)) {
      for (const card of battlefield) {
        if (this.isPlaneswalker(card)) {
          targets.push({
            id: card.id,
            type: 'planeswalker',
            controller: player as 'player' | 'ai'
          });
        }
      }
    }

    return targets;
  }

  private findPermanentTargets(
    gameState: GameState, 
    requirement: TargetRestriction, 
    controller: 'player' | 'ai'
  ): Target[] {
    const targets: Target[] = [];

    for (const [player, battlefield] of Object.entries(gameState.battlefield)) {
      for (const card of battlefield) {
        targets.push({
          id: card.id,
          type: 'permanent',
          controller: player as 'player' | 'ai'
        });
      }
    }

    return targets;
  }

  private findSpellTargets(
    gameState: GameState, 
    requirement: TargetRestriction, 
    controller: 'player' | 'ai'
  ): Target[] {
    return gameState.stack.map(obj => ({
      id: obj.id,
      type: 'spell' as TargetType,
      controller: obj.controller
    }));
  }

  private findGraveyardTargets(
    gameState: GameState, 
    requirement: TargetRestriction, 
    controller: 'player' | 'ai'
  ): Target[] {
    const targets: Target[] = [];

    for (const [playerKey, player] of Object.entries(gameState.players)) {
      for (const card of player.graveyard) {
        targets.push({
          id: card.id,
          type: 'card_in_graveyard',
          controller: playerKey as 'player' | 'ai'
        });
      }
    }

    return targets;
  }

  private validateRestriction(restriction: string, target: Target, gameState: GameState): boolean {
    switch (restriction) {
      case 'you_control':
        return target.controller === 'player';
      case 'opponent_controls':
        return target.controller === 'ai';
      case 'attacking':
        return gameState.combat?.attackers.some(attacker => attacker.id === target.id) || false;
      case 'blocking':
        return gameState.combat?.blockers.some(blocker => blocker.blocker_id === target.id) || false;
      case 'tapped':
        return true;
      case 'untapped':
        return true;
      case 'nonland':
        return !this.isLand(this.findCardById(target.id, gameState));
      case 'non-creature':
        return !this.isCreature(this.findCardById(target.id, gameState));
      default:
        return true;
    }
  }

  private targetExists(target: Target, gameState: GameState): boolean {
    if (target.type === 'player') {
      return target.id === 'player' || target.id === 'ai';
    }

    return this.findCardById(target.id, gameState) !== null;
  }

  private findCardById(id: string, gameState: GameState): MTGCard | null {
    for (const battlefield of Object.values(gameState.battlefield)) {
      const card = battlefield.find(c => c.id === id);
      if (card) return card;
    }

    for (const player of Object.values(gameState.players)) {
      for (const zone of [player.hand, player.graveyard, player.exile]) {
        const card = zone.find(c => c.id === id);
        if (card) return card;
      }
    }

    const stackCard = gameState.stack.find(obj => obj.source.id === id);
    if (stackCard) return stackCard.source;

    return null;
  }

  private isCreature(card: MTGCard | null): boolean {
    return card ? card.type_line.toLowerCase().includes('creature') : false;
  }

  private isPlaneswalker(card: MTGCard | null): boolean {
    return card ? card.type_line.toLowerCase().includes('planeswalker') : false;
  }

  private isLand(card: MTGCard | null): boolean {
    return card ? card.type_line.toLowerCase().includes('land') : false;
  }
}