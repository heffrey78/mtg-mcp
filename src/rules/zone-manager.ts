import { MTGCard, GameState, PlayerState } from '../types';
import { ValidationError } from '../utils/errors';

export type Zone = 'hand' | 'library' | 'graveyard' | 'exile' | 'battlefield' | 'stack';

export interface ZoneChangeEvent {
  card: MTGCard;
  from: Zone;
  to: Zone;
  player: 'player' | 'ai';
  position?: number;
  faceDown?: boolean;
}

export class ZoneManager {
  private static instance: ZoneManager;

  static getInstance(): ZoneManager {
    if (!ZoneManager.instance) {
      ZoneManager.instance = new ZoneManager();
    }
    return ZoneManager.instance;
  }

  validateZoneChange(event: ZoneChangeEvent, gameState: GameState): boolean {
    const player = gameState.players[event.player];
    
    if (!this.cardExistsInZone(event.card, event.from, player, gameState)) {
      throw new ValidationError(`Card ${event.card.name} not found in ${event.from}`);
    }

    if (!this.isValidZoneTransition(event.from, event.to)) {
      throw new ValidationError(`Invalid zone transition from ${event.from} to ${event.to}`);
    }

    if (event.to === 'battlefield' && !this.canEnterBattlefield(event.card, gameState)) {
      throw new ValidationError(`${event.card.name} cannot enter battlefield`);
    }

    return true;
  }

  executeZoneChange(event: ZoneChangeEvent, gameState: GameState): GameState {
    this.validateZoneChange(event, gameState);

    const newGameState = JSON.parse(JSON.stringify(gameState)) as GameState;
    const player = newGameState.players[event.player];

    this.removeCardFromZone(event.card, event.from, player, newGameState);
    this.addCardToZone(event.card, event.to, player, newGameState, event.position, event.faceDown);

    return newGameState;
  }

  private cardExistsInZone(card: MTGCard, zone: Zone, player: PlayerState, gameState: GameState): boolean {
    switch (zone) {
      case 'hand':
        return player.hand.some(c => c.id === card.id);
      case 'library':
        return player.library.some(c => c.id === card.id);
      case 'graveyard':
        return player.graveyard.some(c => c.id === card.id);
      case 'exile':
        return player.exile.some(c => c.id === card.id);
      case 'battlefield':
        return gameState.battlefield.player.some(c => c.id === card.id) ||
               gameState.battlefield.ai.some(c => c.id === card.id);
      case 'stack':
        return gameState.stack.some(obj => obj.source.id === card.id);
      default:
        return false;
    }
  }

  private isValidZoneTransition(from: Zone, to: Zone): boolean {
    const validTransitions: Record<Zone, Zone[]> = {
      hand: ['battlefield', 'graveyard', 'exile', 'library', 'stack'],
      library: ['hand', 'graveyard', 'exile', 'battlefield'],
      graveyard: ['hand', 'library', 'exile', 'battlefield', 'stack'],
      exile: ['hand', 'library', 'graveyard', 'battlefield', 'stack'],
      battlefield: ['graveyard', 'exile', 'hand', 'library'],
      stack: ['graveyard', 'exile', 'battlefield', 'hand']
    };

    return validTransitions[from]?.includes(to) || false;
  }

  private canEnterBattlefield(card: MTGCard, gameState: GameState): boolean {
    if (this.isLand(card)) {
      return true;
    }

    if (this.isToken(card)) {
      return true;
    }

    return true;
  }

  private removeCardFromZone(card: MTGCard, zone: Zone, player: PlayerState, gameState: GameState): void {
    switch (zone) {
      case 'hand':
        player.hand = player.hand.filter(c => c.id !== card.id);
        break;
      case 'library':
        player.library = player.library.filter(c => c.id !== card.id);
        break;
      case 'graveyard':
        player.graveyard = player.graveyard.filter(c => c.id !== card.id);
        break;
      case 'exile':
        player.exile = player.exile.filter(c => c.id !== card.id);
        break;
      case 'battlefield':
        if (gameState.battlefield.player.some(c => c.id === card.id)) {
          gameState.battlefield.player = gameState.battlefield.player.filter(c => c.id !== card.id);
        } else {
          gameState.battlefield.ai = gameState.battlefield.ai.filter(c => c.id !== card.id);
        }
        break;
      case 'stack':
        gameState.stack = gameState.stack.filter(obj => obj.source.id !== card.id);
        break;
    }
  }

  private addCardToZone(
    card: MTGCard, 
    zone: Zone, 
    player: PlayerState, 
    gameState: GameState, 
    position?: number,
    faceDown?: boolean
  ): void {
    switch (zone) {
      case 'hand':
        if (position !== undefined) {
          player.hand.splice(position, 0, card);
        } else {
          player.hand.push(card);
        }
        break;
      case 'library':
        if (position !== undefined) {
          player.library.splice(position, 0, card);
        } else {
          player.library.unshift(card);
        }
        break;
      case 'graveyard':
        player.graveyard.push(card);
        break;
      case 'exile':
        player.exile.push(card);
        break;
      case 'battlefield':
        const battlefield = gameState.battlefield[player === gameState.players.player ? 'player' : 'ai'];
        battlefield.push(card);
        break;
      case 'stack':
        break;
    }
  }

  shuffleLibrary(player: PlayerState): void {
    for (let i = player.library.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [player.library[i], player.library[j]] = [player.library[j]!, player.library[i]!];
    }
  }

  drawCard(player: PlayerState): MTGCard | null {
    const card = player.library.shift();
    if (card) {
      player.hand.push(card);
      return card;
    }
    return null;
  }

  millCards(player: PlayerState, count: number): MTGCard[] {
    const milled: MTGCard[] = [];
    for (let i = 0; i < count && player.library.length > 0; i++) {
      const card = player.library.shift();
      if (card) {
        player.graveyard.push(card);
        milled.push(card);
      }
    }
    return milled;
  }

  searchLibrary(player: PlayerState, predicate: (card: MTGCard) => boolean): MTGCard[] {
    return player.library.filter(predicate);
  }

  private isLand(card: MTGCard): boolean {
    return card.type_line.toLowerCase().includes('land');
  }

  private isToken(card: MTGCard): boolean {
    return card.set === 'token' || card.type_line.toLowerCase().includes('token');
  }
}