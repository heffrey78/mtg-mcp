import { RulingsTool } from '../../tools/rulings.js';
import { ScryfallApi } from '../../services/scryfall-api.js';

// Mock the ScryfallApi
jest.mock('../../services/scryfall-api.js');
const MockedScryfallApi = ScryfallApi as jest.MockedClass<typeof ScryfallApi>;

describe('RulingsTool', () => {
  let rulingsTool: RulingsTool;
  let mockScryfallApi: jest.Mocked<ScryfallApi>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockScryfallApi = {
      getRulings: jest.fn(),
      getCardByName: jest.fn(),
      getCardById: jest.fn(),
      getCacheStats: jest.fn().mockResolvedValue({
        memory: { keys: 2, hits: 3, misses: 0 },
        file: { totalFiles: 1, totalSize: 256, oldestEntry: Date.now() - 900000, newestEntry: Date.now() }
      }),
      cleanup: jest.fn().mockResolvedValue(undefined),
    } as any;

    MockedScryfallApi.mockImplementation(() => mockScryfallApi);
    
    rulingsTool = new RulingsTool();
  });

  const mockCard = {
    id: 'card-1',
    name: 'Black Lotus',
    mana_cost: '{0}',
    cmc: 0,
    type_line: 'Artifact',
    oracle_text: '{T}, Sacrifice Black Lotus: Add three mana of any one color.',
    colors: [],
    color_identity: [],
    legalities: { vintage: 'restricted', legacy: 'banned' },
    set: 'lea',
    set_name: 'Limited Edition Alpha',
    rarity: 'rare',
  };

  const mockRulings = [
    {
      object: 'ruling' as const,
      oracle_id: 'oracle-1',
      source: 'wotc',
      published_at: '2004-10-04',
      comment: 'This is a ruling about the card.',
    },
    {
      object: 'ruling' as const,
      oracle_id: 'oracle-1',
      source: 'scryfall',
      published_at: '2020-01-01',
      comment: 'This is a more recent ruling.',
    },
  ];

  describe('getRulings', () => {
    it('should get rulings by card name', async () => {
      mockScryfallApi.getCardByName.mockResolvedValue(mockCard);
      mockScryfallApi.getRulings.mockResolvedValue(mockRulings);

      const result = await rulingsTool.getRulings({ card_name: 'Black Lotus' });

      expect(result.rulings).toEqual(mockRulings);
      expect(result.card_info).toEqual({
        id: 'card-1',
        name: 'Black Lotus',
        oracle_id: 'card-1',
      });
      expect(result.total_rulings).toBe(2);
      expect(result.cache_info).toBeDefined();
      expect(mockScryfallApi.getCardByName).toHaveBeenCalledWith('Black Lotus', false);
      expect(mockScryfallApi.getRulings).toHaveBeenCalledWith('card-1');
    });

    it('should get rulings by card ID', async () => {
      mockScryfallApi.getCardById.mockResolvedValue(mockCard);
      mockScryfallApi.getRulings.mockResolvedValue(mockRulings);

      const result = await rulingsTool.getRulings({ card_id: 'card-1' });

      expect(result.rulings).toEqual(mockRulings);
      expect(result.card_info.id).toBe('card-1');
      expect(mockScryfallApi.getCardById).toHaveBeenCalledWith('card-1');
      expect(mockScryfallApi.getRulings).toHaveBeenCalledWith('card-1');
    });

    it('should get rulings by oracle ID', async () => {
      mockScryfallApi.getCardById.mockResolvedValue(mockCard);
      mockScryfallApi.getRulings.mockResolvedValue(mockRulings);

      const result = await rulingsTool.getRulings({ oracle_id: 'oracle-1' });

      expect(result.rulings).toEqual(mockRulings);
      expect(result.card_info.oracle_id).toBe('oracle-1');
      expect(mockScryfallApi.getCardById).toHaveBeenCalledWith('oracle-1');
      expect(mockScryfallApi.getRulings).toHaveBeenCalledWith('card-1');
    });

    it('should sort rulings by date (newest first)', async () => {
      mockScryfallApi.getCardByName.mockResolvedValue(mockCard);
      mockScryfallApi.getRulings.mockResolvedValue(mockRulings);

      const result = await rulingsTool.getRulings({ card_name: 'Black Lotus' });

      expect(result.rulings[0]!.published_at).toBe('2020-01-01');
      expect(result.rulings[1]!.published_at).toBe('2004-10-04');
    });

    it('should handle empty rulings', async () => {
      mockScryfallApi.getCardByName.mockResolvedValue(mockCard);
      mockScryfallApi.getRulings.mockResolvedValue([]);

      const result = await rulingsTool.getRulings({ card_name: 'Black Lotus' });

      expect(result.rulings).toEqual([]);
      expect(result.total_rulings).toBe(0);
    });

    it('should require at least one identifier', async () => {
      await expect(rulingsTool.getRulings({}))
        .rejects.toThrow('Must provide either card_name, card_id, or oracle_id');
    });

    it('should handle get rulings errors', async () => {
      mockScryfallApi.getCardByName.mockRejectedValue(new Error('Card not found'));

      await expect(rulingsTool.getRulings({ card_name: 'Nonexistent Card' }))
        .rejects.toThrow('Failed to get rulings: Card not found');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await rulingsTool.cleanup();
      expect(mockScryfallApi.cleanup).toHaveBeenCalled();
    });
  });
});