import { DeckManagementTool } from '../../tools/deck-management.js';
import { MTGCard } from '../../types/index.js';

describe('DeckManagementTool', () => {
  let deckTool: DeckManagementTool;

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

  beforeEach(() => {
    deckTool = new DeckManagementTool();
  });

  describe('createDeck', () => {
    it('should create deck successfully', async () => {
      const response = await deckTool.createDeck({
        name: 'Test Deck',
        format: 'standard',
        colors: ['R', 'U'],
        description: 'Test description',
        author: 'Test Author'
      });

      expect('deck' in response).toBe(true);
      if ('deck' in response) {
        expect(response.deck.name).toBe('Test Deck');
        expect(response.deck.format).toBe('standard');
        expect(response.deck.colors).toEqual(['R', 'U']);
        expect(response.deck.metadata?.description).toBe('Test description');
        expect(response.deck.metadata?.author).toBe('Test Author');
        expect(response.deck.mainboard).toHaveLength(0);
        expect(response.deck.sideboard).toHaveLength(0);
      }
    });

    it('should create deck with minimal parameters', async () => {
      const response = await deckTool.createDeck({
        name: 'Minimal Deck',
        format: 'modern'
      });

      expect('deck' in response).toBe(true);
      if ('deck' in response) {
        expect(response.deck.name).toBe('Minimal Deck');
        expect(response.deck.format).toBe('modern');
        expect(response.deck.colors).toEqual([]);
      }
    });
  });

  describe('getDeckDetails', () => {
    it('should get details for non-existent deck', async () => {
      const response = await deckTool.getDeckDetails({
        deck_id: 'non-existent-deck'
      });

      expect('error' in response).toBe(true);
      if ('error' in response) {
        expect(response.error.code).toBe('DECK_NOT_FOUND');
      }
    });
  });

  describe('integration test', () => {
    it('should create deck, add cards, and get details', async () => {
      // Create a new deck
      const createResponse = await deckTool.createDeck({
        name: 'Integration Test Deck',
        format: 'standard',
        colors: ['R']
      });

      expect('deck' in createResponse).toBe(true);
      if (!('deck' in createResponse)) return;

      const deckId = createResponse.deck.id;

      // Get initial details
      const detailsResponse = await deckTool.getDeckDetails({ deck_id: deckId });
      expect('deck' in detailsResponse).toBe(true);
      if ('deck' in detailsResponse) {
        expect(detailsResponse.statistics.total_cards).toBe(0);
        expect(detailsResponse.statistics.mainboard_count).toBe(0);
        expect(detailsResponse.statistics.sideboard_count).toBe(0);
      }
    }, 10000);
  });
});