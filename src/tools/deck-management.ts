import { Deck, DeckCard, MTGCard, ToolError } from '../types/index.js';
import { DeckStorage } from '../services/deck-storage.js';
import { CardSearchTool } from './card-search.js';
import { logger } from '../utils/logger.js';
import { createErrorResponse } from '../utils/errors.js';

export interface CreateDeckRequest {
  name: string;
  format: string;
  colors?: string[];
  description?: string;
  author?: string;
}

export interface CreateDeckResponse {
  deck: Deck;
}

export interface AddCardToDeckRequest {
  deck_id: string;
  card_name: string;
  quantity?: number;
  set_code?: string;
  board?: 'mainboard' | 'sideboard';
}

export interface AddCardToDeckResponse {
  deck: Deck;
  card_added: DeckCard;
}

export interface RemoveCardFromDeckRequest {
  deck_id: string;
  card_name: string;
  quantity?: number;
  set_code?: string;
  board?: 'mainboard' | 'sideboard';
}

export interface RemoveCardFromDeckResponse {
  deck: Deck;
  cards_removed: number;
}

export interface UpdateCardQuantityRequest {
  deck_id: string;
  card_name: string;
  new_quantity: number;
  set_code?: string;
  board?: 'mainboard' | 'sideboard';
}

export interface UpdateCardQuantityResponse {
  deck: Deck;
  card_updated: DeckCard;
}

export interface GetDeckDetailsRequest {
  deck_id: string;
}

export interface GetDeckDetailsResponse {
  deck: Deck;
  statistics: {
    total_cards: number;
    mainboard_count: number;
    sideboard_count: number;
    total_cmc: number;
    average_cmc: number;
    color_distribution: Record<string, number>;
    type_distribution: Record<string, number>;
  };
}

export class DeckManagementTool {
  private storage: DeckStorage;
  private cardSearch: CardSearchTool;

  constructor() {
    this.storage = new DeckStorage();
    this.cardSearch = new CardSearchTool();
  }

  async createDeck(request: CreateDeckRequest): Promise<CreateDeckResponse | ToolError> {
    try {
      logger.info('Creating new deck', { request });

      const deckId = this.storage.generateDeckId(request.name);
      const now = new Date().toISOString();

      const deck: Deck = {
        id: deckId,
        name: request.name,
        format: request.format,
        colors: request.colors || [],
        mainboard: [],
        sideboard: [],
        created_at: now,
        updated_at: now,
        metadata: {
          ...(request.description && { description: request.description }),
          ...(request.author && { author: request.author }),
          version: 1
        }
      };

      await this.storage.saveDeck(deck);

      logger.info('Deck created successfully', { 
        deckId: deck.id, 
        deckName: deck.name 
      });

      return { deck };
    } catch (error) {
      logger.error('Create deck failed', { error, request });
      return error as ToolError;
    }
  }

  async addCardToDeck(request: AddCardToDeckRequest): Promise<AddCardToDeckResponse | ToolError> {
    try {
      logger.info('Adding card to deck', { request });

      const deck = await this.storage.loadDeck(request.deck_id);
      const quantity = request.quantity || 1;
      const board = request.board || 'mainboard';

      const card = await this.cardSearch.getCardDetails(
        request.card_name,
        request.set_code
      );

      const targetBoard = board === 'mainboard' ? deck.mainboard : deck.sideboard;

      const existingCardIndex = targetBoard.findIndex(dc => 
        dc.card.name === card.name && 
        (!request.set_code || dc.card.set === card.set)
      );

      if (existingCardIndex >= 0 && targetBoard[existingCardIndex]) {
        targetBoard[existingCardIndex]!.quantity += quantity;
      } else {
        targetBoard.push({
          card,
          quantity
        });
      }

      deck.updated_at = new Date().toISOString();
      await this.storage.saveDeck(deck);

      const addedCard: DeckCard = {
        card,
        quantity
      };

      logger.info('Card added to deck successfully', {
        deckId: deck.id,
        cardName: card.name,
        quantity,
        board
      });

      return { deck, card_added: addedCard };
    } catch (error) {
      logger.error('Add card to deck failed', { error, request });
      return error as ToolError;
    }
  }

  async removeCardFromDeck(request: RemoveCardFromDeckRequest): Promise<RemoveCardFromDeckResponse | ToolError> {
    try {
      logger.info('Removing card from deck', { request });

      const deck = await this.storage.loadDeck(request.deck_id);
      const quantity = request.quantity || 1;
      const board = request.board || 'mainboard';
      const targetBoard = board === 'mainboard' ? deck.mainboard : deck.sideboard;

      const existingCardIndex = targetBoard.findIndex(dc => 
        dc.card.name === request.card_name && 
        (!request.set_code || dc.card.set === request.set_code)
      );

      if (existingCardIndex === -1) {
        return createErrorResponse('CARD_NOT_IN_DECK', 
          `Card "${request.card_name}" not found in ${board}`);
      }

      const existingCard = targetBoard[existingCardIndex];
      let cardsRemoved = 0;

      if (existingCard && existingCard.quantity <= quantity) {
        cardsRemoved = existingCard.quantity;
        targetBoard.splice(existingCardIndex, 1);
      } else if (existingCard) {
        cardsRemoved = Math.min(quantity, existingCard.quantity);
        existingCard.quantity -= cardsRemoved;
      }

      deck.updated_at = new Date().toISOString();
      await this.storage.saveDeck(deck);

      logger.info('Card removed from deck successfully', {
        deckId: deck.id,
        cardName: request.card_name,
        cardsRemoved,
        board
      });

      return { deck, cards_removed: cardsRemoved };
    } catch (error) {
      logger.error('Remove card from deck failed', { error, request });
      return error as ToolError;
    }
  }

  async updateCardQuantity(request: UpdateCardQuantityRequest): Promise<UpdateCardQuantityResponse | ToolError> {
    try {
      logger.info('Updating card quantity in deck', { request });

      const deck = await this.storage.loadDeck(request.deck_id);
      const board = request.board || 'mainboard';
      const targetBoard = board === 'mainboard' ? deck.mainboard : deck.sideboard;

      const existingCardIndex = targetBoard.findIndex(dc => 
        dc.card.name === request.card_name && 
        (!request.set_code || dc.card.set === request.set_code)
      );

      if (existingCardIndex === -1) {
        return createErrorResponse('CARD_NOT_IN_DECK', 
          `Card "${request.card_name}" not found in ${board}`);
      }

      const existingCard = targetBoard[existingCardIndex];
      if (!existingCard) {
        return createErrorResponse('CARD_NOT_IN_DECK', 
          `Card "${request.card_name}" not found in ${board}`);
      }

      if (request.new_quantity <= 0) {
        targetBoard.splice(existingCardIndex, 1);
        deck.updated_at = new Date().toISOString();
        await this.storage.saveDeck(deck);

        logger.info('Card removed from deck (quantity set to 0)', {
          deckId: deck.id,
          cardName: request.card_name,
          board
        });

        return { 
          deck, 
          card_updated: { ...existingCard, quantity: 0 }
        };
      }

      existingCard.quantity = request.new_quantity;

      deck.updated_at = new Date().toISOString();
      await this.storage.saveDeck(deck);

      logger.info('Card quantity updated successfully', {
        deckId: deck.id,
        cardName: request.card_name,
        newQuantity: request.new_quantity,
        board
      });

      return { deck, card_updated: existingCard };
    } catch (error) {
      logger.error('Update card quantity failed', { error, request });
      return error as ToolError;
    }
  }

  async getDeckDetails(request: GetDeckDetailsRequest): Promise<GetDeckDetailsResponse | ToolError> {
    try {
      logger.info('Getting deck details', { request });

      const deck = await this.storage.loadDeck(request.deck_id);

      const allCards = [...deck.mainboard, ...deck.sideboard];
      const totalCards = allCards.reduce((sum, dc) => sum + dc.quantity, 0);
      const mainboardCount = deck.mainboard.reduce((sum, dc) => sum + dc.quantity, 0);
      const sideboardCount = deck.sideboard.reduce((sum, dc) => sum + dc.quantity, 0);

      const totalCmc = allCards.reduce((sum, dc) => sum + (dc.card.cmc * dc.quantity), 0);
      const averageCmc = totalCards > 0 ? totalCmc / totalCards : 0;

      const colorDistribution: Record<string, number> = {};
      const typeDistribution: Record<string, number> = {};

      allCards.forEach(dc => {
        dc.card.colors.forEach(color => {
          colorDistribution[color] = (colorDistribution[color] || 0) + dc.quantity;
        });

        const primaryType = dc.card.type_line.split(' ')[0];
        if (primaryType) {
          typeDistribution[primaryType] = (typeDistribution[primaryType] || 0) + dc.quantity;
        }
      });

      const statistics = {
        total_cards: totalCards,
        mainboard_count: mainboardCount,
        sideboard_count: sideboardCount,
        total_cmc: totalCmc,
        average_cmc: Math.round(averageCmc * 100) / 100,
        color_distribution: colorDistribution,
        type_distribution: typeDistribution
      };

      logger.info('Deck details retrieved successfully', {
        deckId: deck.id,
        totalCards,
        averageCmc: statistics.average_cmc
      });

      return { deck, statistics };
    } catch (error) {
      logger.error('Get deck details failed', { error, request });
      return error as ToolError;
    }
  }
}