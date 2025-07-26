import { SetSearchTool } from '../../tools/set-search.js';
import { ScryfallApi } from '../../services/scryfall-api.js';

// Mock the ScryfallApi
jest.mock('../../services/scryfall-api.js');
const MockedScryfallApi = ScryfallApi as jest.MockedClass<typeof ScryfallApi>;

describe('SetSearchTool', () => {
  let setSearchTool: SetSearchTool;
  let mockScryfallApi: jest.Mocked<ScryfallApi>;

  const mockSets = [
    {
      id: 'set-1',
      code: 'lea',
      name: 'Limited Edition Alpha',
      set_type: 'core',
      released_at: '1993-08-05',
      card_count: 295,
      digital: false,
      foil_only: false,
      nonfoil_only: true,
      scryfall_uri: 'https://scryfall.com/sets/lea',
      uri: 'https://api.scryfall.com/sets/lea',
      icon_svg_uri: 'https://svgs.scryfall.io/sets/lea.svg',
      search_uri: 'https://api.scryfall.com/cards/search?order=set&q=e%3Alea',
    },
    {
      id: 'set-2',
      code: 'm21',
      name: 'Core Set 2021',
      set_type: 'core',
      released_at: '2020-07-03',
      card_count: 274,
      digital: false,
      foil_only: false,
      nonfoil_only: false,
      scryfall_uri: 'https://scryfall.com/sets/m21',
      uri: 'https://api.scryfall.com/sets/m21',
      icon_svg_uri: 'https://svgs.scryfall.io/sets/m21.svg',
      search_uri: 'https://api.scryfall.com/cards/search?order=set&q=e%3Am21',
    },
    {
      id: 'set-3',
      code: 'arena',
      name: 'Arena League',
      set_type: 'promo',
      card_count: 6,
      digital: true,
      foil_only: false,
      nonfoil_only: false,
      scryfall_uri: 'https://scryfall.com/sets/arena',
      uri: 'https://api.scryfall.com/sets/arena',
      icon_svg_uri: 'https://svgs.scryfall.io/sets/arena.svg',
      search_uri: 'https://api.scryfall.com/cards/search?order=set&q=e%3Aarena',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockScryfallApi = {
      getSets: jest.fn(),
      getSetByCode: jest.fn(),
      getCacheStats: jest.fn().mockResolvedValue({
        memory: { keys: 3, hits: 5, misses: 1 },
        file: { totalFiles: 2, totalSize: 512, oldestEntry: Date.now() - 1800000, newestEntry: Date.now() }
      }),
      cleanup: jest.fn().mockResolvedValue(undefined),
    } as any;

    MockedScryfallApi.mockImplementation(() => mockScryfallApi);
    
    setSearchTool = new SetSearchTool();
  });

  describe('searchSets', () => {

    it('should search all sets without filters', async () => {
      mockScryfallApi.getSets.mockResolvedValue(mockSets);

      const result = await setSearchTool.searchSets();

      expect(result.sets).toEqual(mockSets);
      expect(result.total_found).toBe(3);
      expect(result.cache_info).toBeDefined();
      expect(mockScryfallApi.getSets).toHaveBeenCalled();
    });

    it('should filter sets by query', async () => {
      mockScryfallApi.getSets.mockResolvedValue(mockSets);

      const result = await setSearchTool.searchSets({ query: 'Core' });

      expect(result.sets).toHaveLength(1);
      expect(result.sets[0]!.name).toBe('Core Set 2021');
      expect(result.total_found).toBe(1);
    });

    it('should filter sets by set type', async () => {
      mockScryfallApi.getSets.mockResolvedValue(mockSets);

      const result = await setSearchTool.searchSets({ set_type: 'core' });

      expect(result.sets).toHaveLength(2);
      expect(result.sets.every(set => set.set_type === 'core')).toBe(true);
      expect(result.total_found).toBe(2);
    });

    it('should filter sets by digital flag', async () => {
      mockScryfallApi.getSets.mockResolvedValue(mockSets);

      const result = await setSearchTool.searchSets({ digital: true });

      expect(result.sets).toHaveLength(1);
      expect(result.sets[0]!.name).toBe('Arena League');
      expect(result.total_found).toBe(1);
    });

    it('should apply limit to results', async () => {
      mockScryfallApi.getSets.mockResolvedValue(mockSets);

      const result = await setSearchTool.searchSets({ limit: 2 });

      expect(result.sets).toHaveLength(2);
      expect(result.total_found).toBe(3);
    });

    it('should sort sets by release date', async () => {
      mockScryfallApi.getSets.mockResolvedValue(mockSets);

      const result = await setSearchTool.searchSets();

      // Should be sorted newest first
      expect(result.sets[0]!.code).toBe('m21'); // 2020
      expect(result.sets[1]!.code).toBe('lea'); // 1993
    });

    it('should handle search errors', async () => {
      mockScryfallApi.getSets.mockRejectedValue(new Error('API Error'));

      await expect(setSearchTool.searchSets())
        .rejects.toThrow('Set search failed: API Error');
    });
  });

  describe('getSetDetails', () => {
    it('should get set details by code', async () => {
      const mockSet = mockSets[0]!;
      mockScryfallApi.getSetByCode.mockResolvedValue(mockSet);

      const result = await setSearchTool.getSetDetails('lea');

      expect(result).toEqual(mockSet);
      expect(mockScryfallApi.getSetByCode).toHaveBeenCalledWith('lea');
    });

    it('should handle get set details errors', async () => {
      mockScryfallApi.getSetByCode.mockRejectedValue(new Error('Set not found'));

      await expect(setSearchTool.getSetDetails('xyz'))
        .rejects.toThrow('Failed to get set details: Set not found');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await setSearchTool.cleanup();
      expect(mockScryfallApi.cleanup).toHaveBeenCalled();
    });
  });
});