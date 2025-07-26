import { MTGCard, GameState, PlayerState } from '../types';

export interface StateBasedAction {
  type: string;
  description: string;
  affectedCards?: MTGCard[];
  affectedPlayer?: 'player' | 'ai';
  data?: Record<string, unknown>;
}

export class StateBasedActionManager {
  private static instance: StateBasedActionManager;

  static getInstance(): StateBasedActionManager {
    if (!StateBasedActionManager.instance) {
      StateBasedActionManager.instance = new StateBasedActionManager();
    }
    return StateBasedActionManager.instance;
  }

  checkStateBasedActions(gameState: GameState): StateBasedAction[] {
    const actions: StateBasedAction[] = [];

    actions.push(...this.checkPlayerStateActions(gameState));
    actions.push(...this.checkCreatureStateActions(gameState));
    actions.push(...this.checkPlaneswalkerStateActions(gameState));
    actions.push(...this.checkLegendRuleActions(gameState));
    actions.push(...this.checkWorldRuleActions(gameState));
    actions.push(...this.checkAuraStateActions(gameState));
    actions.push(...this.checkEquipmentStateActions(gameState));

    return actions;
  }

  executeStateBasedActions(actions: StateBasedAction[], gameState: GameState): GameState {
    const newGameState = JSON.parse(JSON.stringify(gameState)) as GameState;

    for (const action of actions) {
      this.executeAction(action, newGameState);
    }

    return newGameState;
  }

  private checkPlayerStateActions(gameState: GameState): StateBasedAction[] {
    const actions: StateBasedAction[] = [];

    for (const [playerKey, player] of Object.entries(gameState.players)) {
      if (player.life <= 0) {
        actions.push({
          type: 'player_loses_life',
          description: `${playerKey} loses the game (life total 0 or less)`,
          affectedPlayer: playerKey as 'player' | 'ai',
          data: { life: player.life }
        });
      }

      if (player.library.length === 0) {
        actions.push({
          type: 'player_loses_library',
          description: `${playerKey} loses the game (cannot draw from empty library)`,
          affectedPlayer: playerKey as 'player' | 'ai'
        });
      }

      if (this.countPoisonCounters(player) >= 10) {
        actions.push({
          type: 'player_loses_poison',
          description: `${playerKey} loses the game (10 or more poison counters)`,
          affectedPlayer: playerKey as 'player' | 'ai',
          data: { poisonCounters: this.countPoisonCounters(player) }
        });
      }
    }

    return actions;
  }

  private checkCreatureStateActions(gameState: GameState): StateBasedAction[] {
    const actions: StateBasedAction[] = [];

    for (const [playerKey, battlefield] of Object.entries(gameState.battlefield)) {
      for (const creature of battlefield) {
        if (!this.isCreature(creature)) continue;

        const toughness = this.getCreatureToughness(creature);
        const damage = this.getCreatureDamage(creature);

        if (toughness <= 0) {
          actions.push({
            type: 'creature_dies_toughness',
            description: `${creature.name} is put into graveyard (0 toughness)`,
            affectedCards: [creature],
            data: { toughness, reason: '0_toughness' }
          });
        } else if (damage >= toughness) {
          actions.push({
            type: 'creature_dies_damage',
            description: `${creature.name} is destroyed (lethal damage)`,
            affectedCards: [creature],
            data: { damage, toughness, reason: 'lethal_damage' }
          });
        }

        if (this.hasDeathtouch(creature) && damage > 0) {
          actions.push({
            type: 'creature_dies_deathtouch',
            description: `${creature.name} is destroyed (deathtouch damage)`,
            affectedCards: [creature],
            data: { damage, reason: 'deathtouch' }
          });
        }
      }
    }

    return actions;
  }

  private checkPlaneswalkerStateActions(gameState: GameState): StateBasedAction[] {
    const actions: StateBasedAction[] = [];

    for (const [playerKey, battlefield] of Object.entries(gameState.battlefield)) {
      for (const planeswalker of battlefield) {
        if (!this.isPlaneswalker(planeswalker)) continue;

        const loyalty = this.getPlaneswalkerLoyalty(planeswalker);
        if (loyalty <= 0) {
          actions.push({
            type: 'planeswalker_dies',
            description: `${planeswalker.name} is put into graveyard (0 loyalty)`,
            affectedCards: [planeswalker],
            data: { loyalty }
          });
        }
      }
    }

    return actions;
  }

  private checkLegendRuleActions(gameState: GameState): StateBasedAction[] {
    const actions: StateBasedAction[] = [];

    for (const [playerKey, battlefield] of Object.entries(gameState.battlefield)) {
      const legendsByName = new Map<string, MTGCard[]>();

      for (const permanent of battlefield) {
        if (this.isLegendary(permanent)) {
          const name = this.getLegendaryName(permanent);
          if (!legendsByName.has(name)) {
            legendsByName.set(name, []);
          }
          legendsByName.get(name)!.push(permanent);
        }
      }

      for (const [name, legends] of legendsByName) {
        if (legends.length > 1) {
          const toDestroy = legends.slice(1);
          actions.push({
            type: 'legend_rule_violation',
            description: `Legend rule: duplicate ${name} permanents destroyed`,
            affectedCards: toDestroy,
            data: { legendName: name, count: legends.length }
          });
        }
      }
    }

    return actions;
  }

  private checkWorldRuleActions(gameState: GameState): StateBasedAction[] {
    const actions: StateBasedAction[] = [];
    const worldPermanents: MTGCard[] = [];

    for (const battlefield of Object.values(gameState.battlefield)) {
      for (const permanent of battlefield) {
        if (this.isWorld(permanent)) {
          worldPermanents.push(permanent);
        }
      }
    }

    if (worldPermanents.length > 1) {
      actions.push({
        type: 'world_rule_violation',
        description: 'World rule: all world permanents destroyed',
        affectedCards: worldPermanents,
        data: { count: worldPermanents.length }
      });
    }

    return actions;
  }

  private checkAuraStateActions(gameState: GameState): StateBasedAction[] {
    const actions: StateBasedAction[] = [];

    for (const [playerKey, battlefield] of Object.entries(gameState.battlefield)) {
      for (const aura of battlefield) {
        if (!this.isAura(aura)) continue;

        const attachedTo = this.getAttachmentTarget(aura);
        if (!attachedTo || !this.isValidAttachmentTarget(aura, attachedTo, gameState)) {
          actions.push({
            type: 'aura_unattached',
            description: `${aura.name} is put into graveyard (not attached to legal object)`,
            affectedCards: [aura],
            data: { attachedTo: attachedTo?.id }
          });
        }
      }
    }

    return actions;
  }

  private checkEquipmentStateActions(gameState: GameState): StateBasedAction[] {
    const actions: StateBasedAction[] = [];

    for (const [playerKey, battlefield] of Object.entries(gameState.battlefield)) {
      for (const equipment of battlefield) {
        if (!this.isEquipment(equipment)) continue;

        const attachedTo = this.getAttachmentTarget(equipment);
        if (attachedTo && !this.isValidEquipmentTarget(equipment, attachedTo, gameState)) {
          actions.push({
            type: 'equipment_unattached',
            description: `${equipment.name} becomes unattached (attached to illegal creature)`,
            affectedCards: [equipment],
            data: { attachedTo: attachedTo.id }
          });
        }
      }
    }

    return actions;
  }

  private executeAction(action: StateBasedAction, gameState: GameState): void {
    switch (action.type) {
      case 'creature_dies_toughness':
      case 'creature_dies_damage':
      case 'creature_dies_deathtouch':
      case 'planeswalker_dies':
      case 'legend_rule_violation':
      case 'world_rule_violation':
      case 'aura_unattached':
        this.moveCardsToGraveyard(action.affectedCards || [], gameState);
        break;
      case 'equipment_unattached':
        this.unattachEquipment(action.affectedCards || [], gameState);
        break;
      case 'player_loses_life':
      case 'player_loses_library':
      case 'player_loses_poison':
        break;
    }
  }

  private moveCardsToGraveyard(cards: MTGCard[], gameState: GameState): void {
    for (const card of cards) {
      for (const [playerKey, battlefield] of Object.entries(gameState.battlefield)) {
        const index = battlefield.findIndex(c => c.id === card.id);
        if (index !== -1) {
          battlefield.splice(index, 1);
          gameState.players[playerKey as 'player' | 'ai'].graveyard.push(card);
          break;
        }
      }
    }
  }

  private unattachEquipment(cards: MTGCard[], gameState: GameState): void {
  }

  private countPoisonCounters(player: PlayerState): number {
    return 0;
  }

  private isCreature(card: MTGCard): boolean {
    return card.type_line.toLowerCase().includes('creature');
  }

  private isPlaneswalker(card: MTGCard): boolean {
    return card.type_line.toLowerCase().includes('planeswalker');
  }

  private isLegendary(card: MTGCard): boolean {
    return card.type_line.toLowerCase().includes('legendary');
  }

  private isWorld(card: MTGCard): boolean {
    return card.type_line.toLowerCase().includes('world');
  }

  private isAura(card: MTGCard): boolean {
    const typeLine = card.type_line.toLowerCase();
    return typeLine.includes('enchantment') && typeLine.includes('aura');
  }

  private isEquipment(card: MTGCard): boolean {
    const typeLine = card.type_line.toLowerCase();
    return typeLine.includes('artifact') && typeLine.includes('equipment');
  }

  private getCreatureToughness(card: MTGCard): number {
    return card.toughness ? parseInt(card.toughness, 10) || 0 : 0;
  }

  private getCreatureDamage(card: MTGCard): number {
    return 0;
  }

  private hasDeathtouch(card: MTGCard): boolean {
    return (card.oracle_text || '').toLowerCase().includes('deathtouch');
  }

  private getPlaneswalkerLoyalty(card: MTGCard): number {
    const loyaltyMatch = card.oracle_text?.match(/\[([+-]?\d+)\]/);
    return loyaltyMatch && loyaltyMatch[1] ? parseInt(loyaltyMatch[1], 10) : 0;
  }

  private getLegendaryName(card: MTGCard): string {
    return card.name.split(' // ')[0] || card.name;
  }

  private getAttachmentTarget(card: MTGCard): MTGCard | null {
    return null;
  }

  private isValidAttachmentTarget(aura: MTGCard, target: MTGCard, gameState: GameState): boolean {
    return true;
  }

  private isValidEquipmentTarget(equipment: MTGCard, target: MTGCard, gameState: GameState): boolean {
    return this.isCreature(target);
  }
}