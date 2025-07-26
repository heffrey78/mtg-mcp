import { ScryfallApi, ScryfallRuling } from '../services/scryfall-api.js';
import { logger } from '../utils/logger.js';

export interface GetRulingsRequest {
  card_name?: string;
  card_id?: string;
  oracle_id?: string;
}

export interface GetRulingsResponse {
  rulings: ScryfallRuling[];
  card_info: {
    id: string;
    name: string;
    oracle_id?: string;
  };
  total_rulings: number;
  cache_info?: {
    cached: boolean;
    cache_stats?: any;
  };
}

export class RulingsTool {
  private scryfallApi: ScryfallApi;

  constructor() {
    this.scryfallApi = new ScryfallApi();
  }

  async getRulings(request: GetRulingsRequest): Promise<GetRulingsResponse> {
    try {
      logger.info('Getting card rulings', { request });

      let cardId: string;
      let cardName: string;
      let oracleId: string | undefined;

      // Determine how to find the card
      if (request.card_id) {
        // Direct card ID lookup
        cardId = request.card_id;
        const card = await this.scryfallApi.getCardById(cardId);
        cardName = card.name;
        oracleId = card.id; // In Scryfall, card.id is the oracle_id for some operations
      } else if (request.card_name) {
        // Search by card name
        const card = await this.scryfallApi.getCardByName(request.card_name, false);
        cardId = card.id;
        cardName = card.name;
        oracleId = card.id;
      } else if (request.oracle_id) {
        // Oracle ID lookup - need to get card details first
        const card = await this.scryfallApi.getCardById(request.oracle_id);
        cardId = card.id;
        cardName = card.name;
        oracleId = request.oracle_id;
      } else {
        throw new Error('Must provide either card_name, card_id, or oracle_id');
      }

      // Get rulings for the card
      const rulings = await this.scryfallApi.getRulings(cardId);

      // Sort rulings by date (newest first)
      rulings.sort((a, b) => b.published_at.localeCompare(a.published_at));

      // Get cache statistics
      const cacheStats = await this.scryfallApi.getCacheStats();

      const response: GetRulingsResponse = {
        rulings,
        card_info: {
          id: cardId,
          name: cardName,
          oracle_id: oracleId,
        },
        total_rulings: rulings.length,
        cache_info: {
          cached: false,
          cache_stats: cacheStats,
        },
      };

      logger.info('Rulings retrieved', { 
        cardName,
        rulings_found: rulings.length 
      });

      return response;
    } catch (error) {
      logger.error('Get rulings failed', { error, request });
      throw new Error(`Failed to get rulings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cleanup(): Promise<void> {
    await this.scryfallApi.cleanup();
  }
}