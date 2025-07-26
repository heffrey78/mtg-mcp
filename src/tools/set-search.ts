import { ScryfallApi, ScryfallSet } from '../services/scryfall-api.js';
import { logger } from '../utils/logger.js';

export interface SearchSetsRequest {
  query?: string;
  set_type?: string;
  block?: string;
  digital?: boolean;
  foil_only?: boolean;
  limit?: number;
}

export interface SearchSetsResponse {
  sets: ScryfallSet[];
  total_found: number;
  cache_info?: {
    cached: boolean;
    cache_stats?: any;
  };
}

export class SetSearchTool {
  private scryfallApi: ScryfallApi;

  constructor() {
    this.scryfallApi = new ScryfallApi();
  }

  async searchSets(request: SearchSetsRequest = {}): Promise<SearchSetsResponse> {
    try {
      logger.info('Executing set search', { request });

      // Get all sets from Scryfall
      const allSets = await this.scryfallApi.getSets();
      
      // Apply filters
      let filteredSets = allSets;

      if (request.query) {
        const queryLower = request.query.toLowerCase();
        filteredSets = filteredSets.filter(set => 
          set.name.toLowerCase().includes(queryLower) ||
          set.code.toLowerCase().includes(queryLower) ||
          (set.block && set.block.toLowerCase().includes(queryLower))
        );
      }

      if (request.set_type) {
        filteredSets = filteredSets.filter(set => set.set_type === request.set_type);
      }

      if (request.block) {
        filteredSets = filteredSets.filter(set => set.block === request.block);
      }

      if (request.digital !== undefined) {
        filteredSets = filteredSets.filter(set => set.digital === request.digital);
      }

      if (request.foil_only !== undefined) {
        filteredSets = filteredSets.filter(set => set.foil_only === request.foil_only);
      }

      // Sort by release date (newest first) and then by name
      filteredSets.sort((a, b) => {
        if (a.released_at && b.released_at) {
          return b.released_at.localeCompare(a.released_at);
        }
        if (a.released_at && !b.released_at) return -1;
        if (!a.released_at && b.released_at) return 1;
        return a.name.localeCompare(b.name);
      });

      // Apply limit if specified
      const limitedSets = request.limit ? filteredSets.slice(0, request.limit) : filteredSets;

      // Get cache statistics
      const cacheStats = await this.scryfallApi.getCacheStats();

      const response: SearchSetsResponse = {
        sets: limitedSets,
        total_found: filteredSets.length,
        cache_info: {
          cached: false,
          cache_stats: cacheStats,
        },
      };

      logger.info('Set search completed', { 
        sets_found: filteredSets.length,
        sets_returned: limitedSets.length 
      });

      return response;
    } catch (error) {
      logger.error('Set search failed', { error, request });
      throw new Error(`Set search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSetDetails(setCode: string): Promise<ScryfallSet> {
    try {
      logger.info('Getting set details', { setCode });

      const set = await this.scryfallApi.getSetByCode(setCode);

      logger.info('Set details retrieved', { 
        setId: set.id,
        setName: set.name,
        setCode: set.code,
        cardCount: set.card_count
      });

      return set;
    } catch (error) {
      logger.error('Get set details failed', { error, setCode });
      throw new Error(`Failed to get set details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cleanup(): Promise<void> {
    await this.scryfallApi.cleanup();
  }
}