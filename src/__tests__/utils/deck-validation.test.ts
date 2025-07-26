import { DeckValidator } from '../../utils/deck-validation.js';
import { Deck, MTGCard } from '../../types/index.js';

describe('DeckValidator', () => {
  let validator: DeckValidator;

  const mockCard: MTGCard = {
    id: 'lightning-bolt-123',
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
    rarity: 'common'
  };

  const basicLand: MTGCard = {
    id: 'mountain-123',
    name: 'Mountain',
    mana_cost: '',
    cmc: 0,
    type_line: 'Basic Land — Mountain',
    oracle_text: '{T}: Add {R}.',
    colors: [],
    color_identity: ['R'],
    legalities: { standard: 'legal', modern: 'legal' },
    set: 'lea',
    set_name: 'Limited Edition Alpha',
    rarity: 'common'
  };

  const commanderCard: MTGCard = {
    id: 'dragon-commander-123',
    name: 'Dragon Commander',
    mana_cost: '{3}{R}{R}',
    cmc: 5,
    type_line: 'Legendary Creature — Dragon',
    oracle_text: 'Flying, haste',
    power: '5',
    toughness: '5',
    colors: ['R'],
    color_identity: ['R'],
    legalities: { commander: 'legal' },
    set: 'test',
    set_name: 'Test Set',
    rarity: 'mythic'
  };

  beforeEach(() => {
    validator = new DeckValidator();
  });

  describe('validateDeck', () => {
    it('should validate standard deck with minimum cards', () => {
      // Create 60 different cards to avoid card copy limit issues
      const mainboard = Array.from({ length: 60 }, (_, i) => ({
        card: {
          ...mockCard,
          id: `card-${i}`,
          name: `Card ${i}`
        },
        quantity: 1
      }));

      const deck: Deck = {
        id: 'test-deck',
        name: 'Standard Deck',
        format: 'standard',
        colors: ['R'],
        mainboard,
        sideboard: [],
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      const result = validator.validateDeck(deck);
      if (!result.isValid) {
        console.log('Validation errors:', result.errors);
      }
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for deck below minimum size', () => {
      const deck: Deck = {
        id: 'test-deck',
        name: 'Small Deck',
        format: 'standard',
        colors: ['R'],
        mainboard: Array(30).fill({ card: mockCard, quantity: 1 }),
        sideboard: [],
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      const result = validator.validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Mainboard has 30 cards, minimum required: 60');
    });

    it('should fail validation for too many copies of non-basic card', () => {
      const deck: Deck = {
        id: 'test-deck',
        name: 'Invalid Deck',
        format: 'standard',
        colors: ['R'],
        mainboard: [
          { card: mockCard, quantity: 5 },
          ...Array(55).fill({ card: basicLand, quantity: 1 })
        ],
        sideboard: [],
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      const result = validator.validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('"Lightning Bolt" has 5 copies, maximum allowed: 4');
    });

    it('should allow unlimited basic lands', () => {
      const deck: Deck = {
        id: 'test-deck',
        name: 'Basic Land Deck',
        format: 'standard',
        colors: ['R'],
        mainboard: [{ card: basicLand, quantity: 60 }],
        sideboard: [],
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      const result = validator.validateDeck(deck);
      expect(result.isValid).toBe(true);
    });

    it('should validate commander deck format', () => {
      const deck: Deck = {
        id: 'commander-deck',
        name: 'Commander Deck',
        format: 'commander',
        colors: ['R'],
        mainboard: [
          { card: commanderCard, quantity: 1 },
          { card: basicLand, quantity: 99 }
        ],
        sideboard: [],
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      const result = validator.validateDeck(deck);
      expect(result.isValid).toBe(true);
    });

    it('should fail commander deck without commander', () => {
      // Create 100 different non-legendary cards
      const mainboard = Array.from({ length: 100 }, (_, i) => ({
        card: {
          ...mockCard,
          id: `card-${i}`,
          name: `Card ${i}`
        },
        quantity: 1
      }));

      const deck: Deck = {
        id: 'commander-deck',
        name: 'Commander Deck',
        format: 'commander',
        colors: ['R'],
        mainboard,
        sideboard: [],
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      const result = validator.validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Commander deck must have a legendary creature as commander');
    });

    it('should fail commander deck with wrong size', () => {
      const deck: Deck = {
        id: 'commander-deck',
        name: 'Commander Deck',
        format: 'commander',
        colors: ['R'],
        mainboard: [
          { card: commanderCard, quantity: 1 },
          { card: basicLand, quantity: 98 }
        ],
        sideboard: [],
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      const result = validator.validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Mainboard has 99 cards, minimum required: 100');
    });

    it('should fail for unknown format', () => {
      const deck: Deck = {
        id: 'test-deck',
        name: 'Unknown Format Deck',
        format: 'unknown',
        colors: [],
        mainboard: [],
        sideboard: [],
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      const result = validator.validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unknown format: unknown');
    });
  });

  describe('getSupportedFormats', () => {
    it('should return list of supported formats', () => {
      const formats = validator.getSupportedFormats();
      expect(formats).toContain('standard');
      expect(formats).toContain('modern');
      expect(formats).toContain('commander');
      expect(formats).toContain('legacy');
      expect(formats).toContain('vintage');
    });
  });

  describe('getFormatDescription', () => {
    it('should return description for standard format', () => {
      const description = validator.getFormatDescription('standard');
      expect(description).toBe('60+ cards, 15 sideboard, max 4 copies per card');
    });

    it('should return description for commander format', () => {
      const description = validator.getFormatDescription('commander');
      expect(description).toBe('100-100 cards, max 1 copies per card');
    });

    it('should return null for unknown format', () => {
      const description = validator.getFormatDescription('unknown');
      expect(description).toBeNull();
    });
  });
});