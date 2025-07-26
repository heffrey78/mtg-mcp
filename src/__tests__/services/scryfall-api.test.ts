import { ScryfallApi } from '../../services/scryfall-api.js';
import { ApiClient } from '../../services/api-client.js';

// Mock the ApiClient
jest.mock('../../services/api-client.js');
const MockedApiClient = ApiClient as jest.MockedClass<typeof ApiClient>;

describe('ScryfallApi', () => {
  let scryfallApi: ScryfallApi;
  let mockClient: jest.Mocked<ApiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock client instance
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      getCacheStats: jest.fn().mockResolvedValue({ 
        memory: { keys: 0, hits: 0, misses: 0 },
        file: null 
      }),
      getCircuitBreakerState: jest.fn().mockReturnValue('closed'),
      clearCache: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Mock the constructor to return our mock client
    MockedApiClient.mockImplementation(() => mockClient);

    scryfallApi = new ScryfallApi();
  });

  describe('searchCards', () => {
    it('should search cards with basic query', async () => {
      const mockResponse = {
        data: {
          object: 'list',
          total_cards: 1,
          has_more: false,
          data: [
            {
              id: 'test-id',
              name: 'Lightning Bolt',
              mana_cost: '{R}',
              cmc: 1,
              type_line: 'Instant',
              oracle_text: 'Lightning Bolt deals 3 damage to any target.',
              colors: ['R'],
              color_identity: ['R'],
              legalities: { standard: 'not_legal', modern: 'legal' },
              set: 'lea',
              set_name: 'Limited Edition Alpha',
              rarity: 'common',
            },
          ],
        },
        cached: false,
      };

      mockClient.get.mockResolvedValue(mockResponse);

      const result = await scryfallApi.searchCards('Lightning Bolt');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'test-id',
        name: 'Lightning Bolt',
        mana_cost: '{R}',
        cmc: 1,
        type_line: 'Instant',
        oracle_text: 'Lightning Bolt deals 3 damage to any target.',
        colors: ['R'],
        color_identity: ['R'],
        legalities: { standard: 'not_legal', modern: 'legal' },
        set: 'lea',
        set_name: 'Limited Edition Alpha',
        rarity: 'common',
        image_uris: undefined,
      });
    });

    it('should search cards with filters', async () => {
      const mockResponse = {
        data: {
          object: 'list',
          total_cards: 0,
          has_more: false,
          data: [],
        },
        cached: false,
      };

      mockClient.get.mockResolvedValue(mockResponse);

      await scryfallApi.searchCards('creature', {
        colors: ['R', 'G'],
        type: 'creature',
        cmc: 3,
        rarity: 'rare',
      });

      expect(mockClient.get).toHaveBeenCalledWith('/cards/search', {
        params: {
          q: 'creature c:RG t:creature r:rare cmc:3',
          order: 'name',
          unique: 'cards',
          include_extras: false,
        },
      });
    });

    it('should handle search errors', async () => {
      mockClient.get.mockRejectedValue(new Error('API Error'));

      await expect(scryfallApi.searchCards('test')).rejects.toThrow('Card search failed: API Error');
    });
  });

  describe('getCardByName', () => {
    it('should get card by exact name', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          name: 'Lightning Bolt',
          mana_cost: '{R}',
          cmc: 1,
          type_line: 'Instant',
          colors: ['R'],
          color_identity: ['R'],
          legalities: {},
          set: 'lea',
          set_name: 'Limited Edition Alpha',
          rarity: 'common',
        },
        cached: false,
      };

      mockClient.get.mockResolvedValue(mockResponse);

      const result = await scryfallApi.getCardByName('Lightning Bolt', true);

      expect(mockClient.get).toHaveBeenCalledWith('/cards/named', {
        params: { exact: 'Lightning Bolt' },
      });
      expect(result.name).toBe('Lightning Bolt');
    });

    it('should get card by fuzzy name', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          name: 'Lightning Bolt',
          mana_cost: '{R}',
          cmc: 1,
          type_line: 'Instant',
          colors: ['R'],
          color_identity: ['R'],
          legalities: {},
          set: 'lea',
          set_name: 'Limited Edition Alpha',
          rarity: 'common',
        },
        cached: false,
      };

      mockClient.get.mockResolvedValue(mockResponse);

      await scryfallApi.getCardByName('bolt');

      expect(mockClient.get).toHaveBeenCalledWith('/cards/named', {
        params: { fuzzy: 'bolt' },
      });
    });
  });

  describe('getCardById', () => {
    it('should get card by ID', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          name: 'Lightning Bolt',
          mana_cost: '{R}',
          cmc: 1,
          type_line: 'Instant',
          colors: ['R'],
          color_identity: ['R'],
          legalities: {},
          set: 'lea',
          set_name: 'Limited Edition Alpha',
          rarity: 'common',
        },
        cached: false,
      };

      mockClient.get.mockResolvedValue(mockResponse);

      const result = await scryfallApi.getCardById('test-id');

      expect(mockClient.get).toHaveBeenCalledWith('/cards/test-id');
      expect(result.id).toBe('test-id');
    });
  });

  describe('getSets', () => {
    it('should get all sets', async () => {
      const mockResponse = {
        data: {
          object: 'list',
          data: [
            {
              id: 'set-id',
              code: 'lea',
              name: 'Limited Edition Alpha',
              set_type: 'core',
              card_count: 295,
              digital: false,
              foil_only: false,
              nonfoil_only: true,
              scryfall_uri: 'https://scryfall.com/sets/lea',
              uri: 'https://api.scryfall.com/sets/lea',
              icon_svg_uri: 'https://svgs.scryfall.io/sets/lea.svg',
              search_uri: 'https://api.scryfall.com/cards/search?order=set&q=e%3Alea',
            },
          ],
        },
        cached: false,
      };

      mockClient.get.mockResolvedValue(mockResponse);

      const result = await scryfallApi.getSets();

      expect(mockClient.get).toHaveBeenCalledWith('/sets');
      expect(result).toHaveLength(1);
      expect(result[0]!.code).toBe('lea');
    });
  });

  describe('getRulings', () => {
    it('should get card rulings', async () => {
      const mockResponse = {
        data: {
          object: 'list',
          has_more: false,
          data: [
            {
              object: 'ruling',
              oracle_id: 'test-oracle-id',
              source: 'wotc',
              published_at: '2004-10-04',
              comment: 'This is a ruling comment.',
            },
          ],
        },
        cached: false,
      };

      mockClient.get.mockResolvedValue(mockResponse);

      const result = await scryfallApi.getRulings('test-id');

      expect(mockClient.get).toHaveBeenCalledWith('/cards/test-id/rulings');
      expect(result).toHaveLength(1);
      expect(result[0]!.comment).toBe('This is a ruling comment.');
    });
  });

  describe('utility methods', () => {
    it('should get cache stats', async () => {
      mockClient.getCacheStats.mockResolvedValue({ 
        memory: { keys: 0, hits: 0, misses: 0 },
        file: null 
      });

      const stats = await scryfallApi.getCacheStats();
      expect(stats).toEqual({ 
        memory: { keys: 0, hits: 0, misses: 0 },
        file: null 
      });
    });

    it('should get API health', async () => {
      mockClient.getCacheStats.mockResolvedValue({ 
        memory: { keys: 0, hits: 0, misses: 0 },
        file: null 
      });

      const health = await scryfallApi.getApiHealth();
      expect(health).toEqual({
        circuitBreakerState: 'closed',
        cacheStats: { 
          memory: { keys: 0, hits: 0, misses: 0 },
          file: null 
        },
      });
    });

    it('should clear cache', async () => {
      await expect(scryfallApi.clearCache()).resolves.not.toThrow();
      expect(mockClient.clearCache).toHaveBeenCalled();
    });
  });
});