import { ScryfallApi, SearchFilters } from '../services/scryfall-api.js';
import { MTGCard } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface SearchCardsRequest {
  query: string;
  filters?: {
    colors?: string[];
    color_identity?: string[];
    type?: string;
    set?: string;
    rarity?: string;
    cmc?: number;
    power?: string;
    toughness?: string;
    format?: string;
    is_legal?: boolean;
  };
  limit?: number;
}

export interface SearchCardsResponse {
  cards: MTGCard[];
  total_found: number;
  query_used: string;
  cache_info?: {
    cached: boolean;
    cache_stats?: any;
  };
}

export class CardSearchTool {
  private scryfallApi: ScryfallApi;

  constructor() {
    this.scryfallApi = new ScryfallApi();
  }

  async searchCards(request: SearchCardsRequest): Promise<SearchCardsResponse> {
    try {
      logger.info('Executing card search', { 
        query: request.query, 
        filters: request.filters,
        limit: request.limit 
      });

      // Convert request filters to Scryfall filters
      const scryfallFilters: SearchFilters = {};
      
      if (request.filters) {
        if (request.filters.colors) {
          scryfallFilters.colors = request.filters.colors;
        }
        if (request.filters.color_identity) {
          scryfallFilters.color_identity = request.filters.color_identity;
        }
        if (request.filters.type) {
          scryfallFilters.type = request.filters.type;
        }
        if (request.filters.set) {
          scryfallFilters.set = request.filters.set;
        }
        if (request.filters.rarity) {
          scryfallFilters.rarity = request.filters.rarity;
        }
        if (request.filters.cmc !== undefined) {
          scryfallFilters.cmc = request.filters.cmc;
        }
        if (request.filters.power) {
          scryfallFilters.power = request.filters.power;
        }
        if (request.filters.toughness) {
          scryfallFilters.toughness = request.filters.toughness;
        }
        if (request.filters.format && request.filters.is_legal !== undefined) {
          scryfallFilters.format = request.filters.format;
          scryfallFilters.is_legal = request.filters.is_legal;
        }
      }

      // Execute search
      const cards = await this.scryfallApi.searchCards(request.query, scryfallFilters);
      
      // Apply limit if specified
      const limitedCards = request.limit ? cards.slice(0, request.limit) : cards;
      
      // Get cache statistics for response
      const cacheStats = await this.scryfallApi.getCacheStats();

      const response: SearchCardsResponse = {
        cards: limitedCards,
        total_found: cards.length,
        query_used: request.query,
        cache_info: {
          cached: false, // This would be determined by the API layer
          cache_stats: cacheStats,
        },
      };

      logger.info('Card search completed', { 
        cards_found: cards.length,
        cards_returned: limitedCards.length 
      });

      return response;
    } catch (error) {
      logger.error('Card search failed', { error, request });
      throw new Error(`Card search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCardDetails(cardName: string, setCode?: string): Promise<MTGCard> {
    try {
      logger.info('Getting card details', { cardName, setCode });

      let card: MTGCard;
      
      if (setCode) {
        // If set code provided, search for specific version
        const searchQuery = `!"${cardName}" set:${setCode}`;
        const cards = await this.scryfallApi.searchCards(searchQuery);
        
        if (cards.length === 0) {
          throw new Error(`Card "${cardName}" not found in set "${setCode}"`);
        }
        
        card = cards[0]!;
      } else {
        // Use fuzzy search for card name
        card = await this.scryfallApi.getCardByName(cardName, false);
      }

      logger.info('Card details retrieved', { 
        cardId: card.id, 
        cardName: card.name,
        set: card.set 
      });

      return card;
    } catch (error) {
      logger.error('Get card details failed', { error, cardName, setCode });
      throw new Error(`Failed to get card details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cleanup(): Promise<void> {
    await this.scryfallApi.cleanup();
  }
}