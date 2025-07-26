import { CardSearchTool } from '../../tools/card-search.js';
import { ScryfallApi } from '../../services/scryfall-api.js';

// Mock the ScryfallApi
jest.mock('../../services/scryfall-api.js');
const MockedScryfallApi = ScryfallApi as jest.MockedClass<typeof ScryfallApi>;

describe('CardSearchTool', () => {
  let cardSearchTool: CardSearchTool;
  let mockScryfallApi: jest.Mocked<ScryfallApi>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockScryfallApi = {
      searchCards: jest.fn(),
      getCardByName: jest.fn(),
      getCardById: jest.fn(),
      getCacheStats: jest.fn().mockResolvedValue({
        memory: { keys: 5, hits: 10, misses: 2 },
        file: { totalFiles: 3, totalSize: 1024, oldestEntry: Date.now() - 3600000, newestEntry: Date.now() }
      }),
      cleanup: jest.fn().mockResolvedValue(undefined),
    } as any;

    MockedScryfallApi.mockImplementation(() => mockScryfallApi);
    
    cardSearchTool = new CardSearchTool();
  });

  describe('searchCards', () => {
    it('should search cards with basic query', async () => {
      const mockCards = [
        {
          id: 'card-1',
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
      ];

      mockScryfallApi.searchCards.mockResolvedValue(mockCards);

      const result = await cardSearchTool.searchCards({ query: 'Lightning Bolt' });

      expect(result.cards).toEqual(mockCards);
      expect(result.total_found).toBe(1);
      expect(result.query_used).toBe('Lightning Bolt');
      expect(result.cache_info).toBeDefined();
      expect(mockScryfallApi.searchCards).toHaveBeenCalledWith('Lightning Bolt', {});
    });

    it('should search cards with filters', async () => {
      const mockCards: any[] = [];
      mockScryfallApi.searchCards.mockResolvedValue(mockCards);

      const request = {
        query: 'dragon',
        filters: {
          colors: ['R'],
          type: 'creature',
          cmc: 5,
          rarity: 'rare',
        },
        limit: 10,
      };

      await cardSearchTool.searchCards(request);

      expect(mockScryfallApi.searchCards).toHaveBeenCalledWith('dragon', {
        colors: ['R'],
        type: 'creature',
        cmc: 5,
        rarity: 'rare',
      });
    });

    it('should apply limit to results', async () => {
      const mockCards: any[] = Array.from({ length: 20 }, (_, i) => ({
        id: `card-${i}`,
        name: `Card ${i}`,
        mana_cost: '{1}',
        cmc: 1,
        type_line: 'Artifact',
        colors: [],
        color_identity: [],
        legalities: {},
        set: 'test',
        set_name: 'Test Set',
        rarity: 'common',
      }));

      mockScryfallApi.searchCards.mockResolvedValue(mockCards);

      const result = await cardSearchTool.searchCards({ query: 'test', limit: 5 });

      expect(result.cards).toHaveLength(5);
      expect(result.total_found).toBe(20);
    });

    it('should handle search errors', async () => {
      mockScryfallApi.searchCards.mockRejectedValue(new Error('API Error'));

      await expect(cardSearchTool.searchCards({ query: 'test' }))
        .rejects.toThrow('Card search failed: API Error');
    });
  });

  describe('getCardDetails', () => {
    it('should get card details by name', async () => {
      const mockCard = {
        id: 'card-1',
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
      };

      mockScryfallApi.getCardByName.mockResolvedValue(mockCard);

      const result = await cardSearchTool.getCardDetails('Lightning Bolt');

      expect(result).toEqual(mockCard);
      expect(mockScryfallApi.getCardByName).toHaveBeenCalledWith('Lightning Bolt', false);
    });

    it('should get card details by name and set', async () => {
      const mockCards = [{
        id: 'card-1',
        name: 'Lightning Bolt',
        mana_cost: '{R}',
        cmc: 1,
        type_line: 'Instant',
        colors: ['R'],
        color_identity: ['R'],
        legalities: {},
        set: 'm11',
        set_name: 'Magic 2011',
        rarity: 'common',
      }];

      mockScryfallApi.searchCards.mockResolvedValue(mockCards);

      const result = await cardSearchTool.getCardDetails('Lightning Bolt', 'm11');

      expect(result).toEqual(mockCards[0]);
      expect(mockScryfallApi.searchCards).toHaveBeenCalledWith('!"Lightning Bolt" set:m11');
    });

    it('should handle card not found in set', async () => {
      mockScryfallApi.searchCards.mockResolvedValue([]);

      await expect(cardSearchTool.getCardDetails('Lightning Bolt', 'xyz'))
        .rejects.toThrow('Card "Lightning Bolt" not found in set "xyz"');
    });

    it('should handle get card details errors', async () => {
      mockScryfallApi.getCardByName.mockRejectedValue(new Error('Card not found'));

      await expect(cardSearchTool.getCardDetails('Nonexistent Card'))
        .rejects.toThrow('Failed to get card details: Card not found');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await cardSearchTool.cleanup();
      expect(mockScryfallApi.cleanup).toHaveBeenCalled();
    });
  });
});