import { ApiClient, ApiConfig } from './api-client.js';
import { MTGCard } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Scryfall API response types
export interface ScryfallCard {
  id: string;
  oracle_id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors: string[];
  color_identity: string[];
  legalities: Record<string, string>;
  set: string;
  set_name: string;
  rarity: string;
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
    art_crop?: string;
    border_crop?: string;
  };
  card_faces?: ScryfallCardFace[];
  layout: string;
  games: string[];
  reserved: boolean;
  foil: boolean;
  nonfoil: boolean;
  finishes: string[];
  oversized: boolean;
  promo: boolean;
  reprint: boolean;
  variation: boolean;
  set_id: string;
  set_uri: string;
  scryfall_uri: string;
  uri: string;
  card_back_id?: string;
  artist?: string;
  artist_ids?: string[];
  illustration_id?: string;
  border_color: string;
  frame: string;
  security_stamp?: string;
  full_art: boolean;
  textless: boolean;
  booster: boolean;
  story_spotlight: boolean;
  prices: {
    usd?: string;
    usd_foil?: string;
    usd_etched?: string;
    eur?: string;
    eur_foil?: string;
    tix?: string;
  };
  related_uris: {
    gatherer?: string;
    tcgplayer_infinite_articles?: string;
    tcgplayer_infinite_decks?: string;
    edhrec?: string;
  };
  purchase_uris: Record<string, string>;
}

export interface ScryfallCardFace {
  name: string;
  mana_cost: string;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors: string[];
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
    art_crop?: string;
    border_crop?: string;
  };
}

export interface ScryfallSearchResult {
  object: 'list';
  total_cards: number;
  has_more: boolean;
  next_page?: string;
  data: ScryfallCard[];
  warnings?: string[];
}

export interface ScryfallSet {
  id: string;
  code: string;
  name: string;
  set_type: string;
  released_at?: string;
  block_code?: string;
  block?: string;
  parent_set_code?: string;
  card_count: number;
  printed_size?: number;
  digital: boolean;
  foil_only: boolean;
  nonfoil_only: boolean;
  scryfall_uri: string;
  uri: string;
  icon_svg_uri: string;
  search_uri: string;
}

export interface ScryfallRuling {
  object: 'ruling';
  oracle_id: string;
  source: string;
  published_at: string;
  comment: string;
}

export interface ScryfallRulingsResult {
  object: 'list';
  has_more: boolean;
  data: ScryfallRuling[];
}

export interface SearchFilters {
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
}

export class ScryfallApi {
  private client: ApiClient;

  constructor() {
    const config: ApiConfig = {
      baseURL: 'https://api.scryfall.com',
      timeout: 10000,
      retryAttempts: 3,
      retryDelayMs: 1000,
      rateLimit: {
        requestsPerSecond: 10, // Scryfall allows 10 requests per second
        maxConcurrent: 5,
      },
      cache: {
        ttl: 3600, // Cache for 1 hour
        maxKeys: 1000,
        persistentCache: {
          enabled: true,
          cacheDir: './cache/scryfall',
          maxFileAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
          compressionEnabled: true,
        },
      },
    };

    this.client = new ApiClient(config);
  }

  async searchCards(query: string, filters?: SearchFilters): Promise<MTGCard[]> {
    try {
      const searchQuery = this.buildSearchQuery(query, filters);
      logger.debug(`Searching cards with query: ${searchQuery}`);

      const response = await this.client.get<ScryfallSearchResult>('/cards/search', {
        params: {
          q: searchQuery,
          order: 'name',
          unique: 'cards',
          include_extras: false,
        },
      });

      return response.data.data.map(card => this.transformScryfallCard(card));
    } catch (error) {
      logger.error('Failed to search cards:', error as Record<string, unknown>);
      throw new Error(`Card search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCardByName(name: string, exact: boolean = false): Promise<MTGCard> {
    try {
      const endpoint = exact ? '/cards/named' : '/cards/named';
      const params = exact ? { exact: name } : { fuzzy: name };

      const response = await this.client.get<ScryfallCard>(endpoint, { params });
      return this.transformScryfallCard(response.data);
    } catch (error) {
      logger.error(`Failed to get card "${name}":`, error as Record<string, unknown>);
      throw new Error(`Card lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCardById(id: string): Promise<MTGCard> {
    try {
      const response = await this.client.get<ScryfallCard>(`/cards/${id}`);
      return this.transformScryfallCard(response.data);
    } catch (error) {
      logger.error(`Failed to get card with ID "${id}":`, error as Record<string, unknown>);
      throw new Error(`Card lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSets(): Promise<ScryfallSet[]> {
    try {
      const response = await this.client.get<{ object: 'list'; data: ScryfallSet[] }>('/sets');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get sets:', error as Record<string, unknown>);
      throw new Error(`Sets lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSetByCode(code: string): Promise<ScryfallSet> {
    try {
      const response = await this.client.get<ScryfallSet>(`/sets/${code}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get set "${code}":`, error as Record<string, unknown>);
      throw new Error(`Set lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRulings(cardId: string): Promise<ScryfallRuling[]> {
    try {
      const response = await this.client.get<ScryfallRulingsResult>(`/cards/${cardId}/rulings`);
      return response.data.data;
    } catch (error) {
      logger.error(`Failed to get rulings for card "${cardId}":`, error as Record<string, unknown>);
      throw new Error(`Rulings lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildSearchQuery(query: string, filters?: SearchFilters): string {
    let searchQuery = query;

    if (!filters) return searchQuery;

    if (filters.colors && filters.colors.length > 0) {
      searchQuery += ` c:${filters.colors.join('')}`;
    }

    if (filters.color_identity && filters.color_identity.length > 0) {
      searchQuery += ` id:${filters.color_identity.join('')}`;
    }

    if (filters.type) {
      searchQuery += ` t:${filters.type}`;
    }

    if (filters.set) {
      searchQuery += ` s:${filters.set}`;
    }

    if (filters.rarity) {
      searchQuery += ` r:${filters.rarity}`;
    }

    if (filters.power) {
      searchQuery += ` pow:${filters.power}`;
    }

    if (filters.toughness) {
      searchQuery += ` tou:${filters.toughness}`;
    }

    if (filters.cmc !== undefined) {
      searchQuery += ` cmc:${filters.cmc}`;
    }

    if (filters.format && filters.is_legal !== undefined) {
      const legality = filters.is_legal ? 'legal' : 'banned';
      searchQuery += ` f:${filters.format} legal:${legality}`;
    }

    return searchQuery.trim();
  }

  private transformScryfallCard(scryfallCard: ScryfallCard): MTGCard {
    return {
      id: scryfallCard.id,
      name: scryfallCard.name,
      mana_cost: scryfallCard.mana_cost,
      cmc: scryfallCard.cmc,
      type_line: scryfallCard.type_line,
      oracle_text: scryfallCard.oracle_text,
      power: scryfallCard.power,
      toughness: scryfallCard.toughness,
      colors: scryfallCard.colors,
      color_identity: scryfallCard.color_identity,
      legalities: scryfallCard.legalities,
      set: scryfallCard.set,
      set_name: scryfallCard.set_name,
      rarity: scryfallCard.rarity,
      image_uris: scryfallCard.image_uris ? {
        small: scryfallCard.image_uris.small,
        normal: scryfallCard.image_uris.normal,
        large: scryfallCard.image_uris.large,
      } as { small?: string | undefined; normal?: string | undefined; large?: string | undefined; } : undefined,
    };
  }

  // Utility methods
  async getCacheStats() {
    return await this.client.getCacheStats();
  }

  async getApiHealth() {
    return {
      circuitBreakerState: this.client.getCircuitBreakerState(),
      cacheStats: await this.getCacheStats(),
    };
  }

  async clearCache(): Promise<void> {
    await this.client.clearCache();
  }

  async cleanup(): Promise<void> {
    await this.client.cleanup();
  }
}