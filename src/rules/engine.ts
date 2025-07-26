import { MTGCard, GameState, PlayerState, ManaPool } from '../types';
import { ValidationError } from '../utils/errors';

export interface RuleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface FormatRules {
  minDeckSize: number;
  maxDeckSize?: number;
  exactDeckSize?: number;
  maxCopies: number;
  commanderRequired: boolean;
}

export interface GameAction {
  type: 'cast_spell' | 'activate_ability' | 'declare_attackers' | 'declare_blockers' | 'play_land' | 'pass_priority';
  player: 'player' | 'ai';
  cardId?: string;
  targets?: string[];
  manaPayment?: Partial<ManaPool>;
  additionalData?: Record<string, unknown>;
}

export class MTGRulesEngine {
  private static instance: MTGRulesEngine;

  static getInstance(): MTGRulesEngine {
    if (!MTGRulesEngine.instance) {
      MTGRulesEngine.instance = new MTGRulesEngine();
    }
    return MTGRulesEngine.instance;
  }

  validateAction(action: GameAction, gameState: GameState): RuleValidationResult {
    const result: RuleValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      switch (action.type) {
        case 'cast_spell':
          this.validateSpellCast(action, gameState, result);
          break;
        case 'play_land':
          this.validateLandPlay(action, gameState, result);
          break;
        case 'activate_ability':
          this.validateAbilityActivation(action, gameState, result);
          break;
        case 'declare_attackers':
          this.validateAttackerDeclaration(action, gameState, result);
          break;
        case 'declare_blockers':
          this.validateBlockerDeclaration(action, gameState, result);
          break;
        case 'pass_priority':
          this.validatePriorityPass(action, gameState, result);
          break;
        default:
          result.errors.push(`Unknown action type: ${action.type}`);
          result.isValid = false;
      }
    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  private validateSpellCast(action: GameAction, gameState: GameState, result: RuleValidationResult): void {
    if (!action.cardId) {
      result.errors.push('Card ID is required for casting spells');
      result.isValid = false;
      return;
    }

    const player = gameState.players[action.player];
    const card = this.findCardInHand(action.cardId, player);
    
    if (!card) {
      result.errors.push('Card not found in player hand');
      result.isValid = false;
      return;
    }

    if (!this.canCastAtCurrentTiming(card, gameState)) {
      result.errors.push(`Cannot cast ${card.name} at current timing`);
      result.isValid = false;
    }

    if (!this.validateManaCost(card, action.manaPayment || {}, player.mana_pool)) {
      result.errors.push(`Insufficient mana to cast ${card.name}`);
      result.isValid = false;
    }

    if (action.targets && !this.validateTargets(card, action.targets, gameState)) {
      result.errors.push(`Invalid targets for ${card.name}`);
      result.isValid = false;
    }
  }

  private validateLandPlay(action: GameAction, gameState: GameState, result: RuleValidationResult): void {
    if (!action.cardId) {
      result.errors.push('Card ID is required for playing lands');
      result.isValid = false;
      return;
    }

    const player = gameState.players[action.player];
    const card = this.findCardInHand(action.cardId, player);
    
    if (!card) {
      result.errors.push('Card not found in player hand');
      result.isValid = false;
      return;
    }

    if (!this.isLand(card)) {
      result.errors.push(`${card.name} is not a land`);
      result.isValid = false;
    }

    if (!this.canPlayLandAtCurrentTiming(gameState)) {
      result.errors.push('Cannot play land at current timing');
      result.isValid = false;
    }
  }

  private validateAbilityActivation(action: GameAction, gameState: GameState, result: RuleValidationResult): void {
    result.warnings?.push('Ability activation validation not fully implemented');
  }

  private validateAttackerDeclaration(action: GameAction, gameState: GameState, result: RuleValidationResult): void {
    if (gameState.phase !== 'combat' || gameState.step !== 'declare_attackers') {
      result.errors.push('Can only declare attackers during declare attackers step');
      result.isValid = false;
    }

    if (gameState.active_player !== action.player) {
      result.errors.push('Only active player can declare attackers');
      result.isValid = false;
    }
  }

  private validateBlockerDeclaration(action: GameAction, gameState: GameState, result: RuleValidationResult): void {
    if (gameState.phase !== 'combat' || gameState.step !== 'declare_blockers') {
      result.errors.push('Can only declare blockers during declare blockers step');
      result.isValid = false;
    }

    const defendingPlayer = gameState.active_player === 'player' ? 'ai' : 'player';
    if (defendingPlayer !== action.player) {
      result.errors.push('Only defending player can declare blockers');
      result.isValid = false;
    }
  }

  private validatePriorityPass(action: GameAction, gameState: GameState, result: RuleValidationResult): void {
    if (gameState.priority !== action.player) {
      result.errors.push('Player does not have priority');
      result.isValid = false;
    }
  }

  private findCardInHand(cardId: string, player: PlayerState): MTGCard | null {
    return player.hand.find(card => card.id === cardId) || null;
  }

  private canCastAtCurrentTiming(card: MTGCard, gameState: GameState): boolean {
    if (this.isInstant(card)) {
      return true;
    }

    if (this.isSorcery(card) || this.isPermanent(card)) {
      return (gameState.phase === 'main1' || gameState.phase === 'main2') && 
             gameState.stack.length === 0;
    }

    return false;
  }

  private canPlayLandAtCurrentTiming(gameState: GameState): boolean {
    return (gameState.phase === 'main1' || gameState.phase === 'main2') && 
           gameState.stack.length === 0;
  }

  private validateManaCost(card: MTGCard, payment: Partial<ManaPool>, availableMana: ManaPool): boolean {
    if (!card.mana_cost) return true;

    const requiredMana = this.parseManaCost(card.mana_cost);
    
    const totalRequired = Object.values(requiredMana).reduce((sum, val) => sum + val, 0);
    const totalPayment = Object.values(payment).reduce((sum, val) => sum + (val || 0), 0);
    const totalAvailable = Object.values(availableMana).reduce((sum, val) => sum + val, 0);

    if (totalPayment !== totalRequired || totalPayment > totalAvailable) {
      return false;
    }

    for (const [color, required] of Object.entries(requiredMana)) {
      const paid = payment[color as keyof ManaPool] || 0;
      const available = availableMana[color as keyof ManaPool];
      
      if (paid > available || (color !== 'colorless' && paid < required)) {
        return false;
      }
    }

    return true;
  }

  private validateTargets(card: MTGCard, targets: string[], gameState: GameState): boolean {
    if (!card.oracle_text) return true;
    
    const targetCount = (card.oracle_text.match(/target/gi) || []).length;
    return targets.length === targetCount;
  }

  private parseManaCost(manaCost: string): ManaPool {
    const cost: ManaPool = { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 };
    
    const symbols = manaCost.replace(/[{}]/g, '').split('');
    
    for (const symbol of symbols) {
      switch (symbol.toLowerCase()) {
        case 'w': cost.white++; break;
        case 'u': cost.blue++; break;
        case 'b': cost.black++; break;
        case 'r': cost.red++; break;
        case 'g': cost.green++; break;
        default:
          if (/\d/.test(symbol)) {
            cost.colorless += parseInt(symbol, 10);
          }
      }
    }
    
    return cost;
  }

  private isLand(card: MTGCard): boolean {
    return card.type_line.toLowerCase().includes('land');
  }

  private isInstant(card: MTGCard): boolean {
    return card.type_line.toLowerCase().includes('instant');
  }

  private isSorcery(card: MTGCard): boolean {
    return card.type_line.toLowerCase().includes('sorcery');
  }

  private isPermanent(card: MTGCard): boolean {
    const types = card.type_line.toLowerCase();
    return types.includes('creature') || 
           types.includes('artifact') || 
           types.includes('enchantment') || 
           types.includes('planeswalker') ||
           types.includes('land');
  }

  checkStateBasedActions(gameState: GameState): string[] {
    const actions: string[] = [];

    for (const [playerKey, player] of Object.entries(gameState.players)) {
      if (player.life <= 0) {
        actions.push(`${playerKey} loses the game due to 0 or less life`);
      }

      if (player.library.length === 0) {
        actions.push(`${playerKey} loses the game by drawing from empty library`);
      }
    }

    for (const [playerKey, battlefield] of Object.entries(gameState.battlefield)) {
      for (const creature of battlefield) {
        if (this.isCreature(creature) && this.getCreatureToughness(creature) <= 0) {
          actions.push(`${creature.name} is put into ${playerKey}'s graveyard (0 toughness)`);
        }
      }
    }

    return actions;
  }

  validateFormatLegality(deck: { mainboard: Array<{ card: MTGCard; quantity: number }> }, format: string): RuleValidationResult {
    const result: RuleValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const formatRules = this.getFormatRules(format);
    const cardCounts = new Map<string, number>();
    let totalCards = 0;

    for (const deckCard of deck.mainboard) {
      const count = cardCounts.get(deckCard.card.name) || 0;
      cardCounts.set(deckCard.card.name, count + deckCard.quantity);
      totalCards += deckCard.quantity;

      const legality = deckCard.card.legalities[format.toLowerCase()];
      if (legality === 'banned') {
        result.errors.push(`${deckCard.card.name} is banned in ${format}`);
        result.isValid = false;
      } else if (legality === 'restricted' && deckCard.quantity > 1) {
        result.errors.push(`${deckCard.card.name} is restricted to 1 copy in ${format}`);
        result.isValid = false;
      } else if (!legality || legality === 'not_legal') {
        result.errors.push(`${deckCard.card.name} is not legal in ${format}`);
        result.isValid = false;
      }

      if (!this.isBasicLand(deckCard.card.name) && count > formatRules.maxCopies) {
        result.errors.push(`Too many copies of ${deckCard.card.name} (${count}/${formatRules.maxCopies})`);
        result.isValid = false;
      }
    }

    if (totalCards < formatRules.minDeckSize) {
      result.errors.push(`Deck too small (${totalCards}/${formatRules.minDeckSize})`);
      result.isValid = false;
    }

    if (formatRules.maxDeckSize && totalCards > formatRules.maxDeckSize) {
      result.errors.push(`Deck too large (${totalCards}/${formatRules.maxDeckSize})`);
      result.isValid = false;
    }

    if (formatRules.exactDeckSize && totalCards !== formatRules.exactDeckSize) {
      result.errors.push(`Deck must be exactly ${formatRules.exactDeckSize} cards (${totalCards})`);
      result.isValid = false;
    }

    if (formatRules.commanderRequired && !this.hasCommander(deck)) {
      result.errors.push('Commander format requires a legendary creature or planeswalker commander');
      result.isValid = false;
    }

    return result;
  }

  private getFormatRules(format: string): FormatRules {
    const formatLower = format.toLowerCase();
    
    switch (formatLower) {
      case 'standard':
        return {
          minDeckSize: 60,
          maxCopies: 4,
          commanderRequired: false
        };
      case 'modern':
        return {
          minDeckSize: 60,
          maxCopies: 4,
          commanderRequired: false
        };
      case 'legacy':
        return {
          minDeckSize: 60,
          maxCopies: 4,
          commanderRequired: false
        };
      case 'vintage':
        return {
          minDeckSize: 60,
          maxCopies: 4,
          commanderRequired: false
        };
      case 'commander':
      case 'edh':
        return {
          minDeckSize: 100,
          exactDeckSize: 100,
          maxCopies: 1,
          commanderRequired: true
        };
      case 'limited':
      case 'draft':
      case 'sealed':
        return {
          minDeckSize: 40,
          maxCopies: 99,
          commanderRequired: false
        };
      case 'pauper':
        return {
          minDeckSize: 60,
          maxCopies: 4,
          commanderRequired: false
        };
      default:
        return {
          minDeckSize: 60,
          maxCopies: 4,
          commanderRequired: false
        };
    }
  }

  private hasCommander(deck: { mainboard: Array<{ card: MTGCard; quantity: number }> }): boolean {
    return deck.mainboard.some(deckCard => 
      this.isLegendary(deckCard.card) && 
      (this.isCreature(deckCard.card) || this.isPlaneswalker(deckCard.card)) &&
      deckCard.quantity === 1
    );
  }

  private isPlaneswalker(card: MTGCard): boolean {
    return card.type_line.toLowerCase().includes('planeswalker');
  }

  private isLegendary(card: MTGCard): boolean {
    return card.type_line.toLowerCase().includes('legendary');
  }

  private isCreature(card: MTGCard): boolean {
    return card.type_line.toLowerCase().includes('creature');
  }

  private getCreatureToughness(card: MTGCard): number {
    return card.toughness ? parseInt(card.toughness, 10) || 0 : 0;
  }

  private isBasicLand(cardName: string): boolean {
    const basicLands = ['plains', 'island', 'swamp', 'mountain', 'forest', 'wastes'];
    return basicLands.includes(cardName.toLowerCase());
  }

  private getMinDeckSize(format: string): number {
    switch (format.toLowerCase()) {
      case 'standard':
      case 'modern':
      case 'legacy':
      case 'vintage':
        return 60;
      case 'commander':
      case 'edh':
        return 100;
      case 'limited':
      case 'draft':
      case 'sealed':
        return 40;
      default:
        return 60;
    }
  }
}