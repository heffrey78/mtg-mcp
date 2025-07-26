import { DeckStorage } from '../../services/deck-storage.js';
import { Deck } from '../../types/index.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('DeckStorage', () => {
  let storage: DeckStorage;
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(__dirname, '../../test-decks');
    storage = new DeckStorage(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('generateDeckId', () => {
    it('should generate valid deck ID from name', () => {
      const id = storage.generateDeckId('My Test Deck');
      expect(id).toMatch(/^my-test-deck-\d+$/);
    });

    it('should handle special characters', () => {
      const id = storage.generateDeckId('Deck w/ Special @#$ Characters!');
      expect(id).toMatch(/^deck-w-special-characters-\d+$/);
    });

    it('should handle empty name', () => {
      const id = storage.generateDeckId('');
      expect(id).toMatch(/^\d+$/);
    });
  });

  describe('saveDeck and loadDeck', () => {
    const mockDeck: Deck = {
      id: 'test-deck-123',
      name: 'Test Deck',
      format: 'standard',
      colors: ['U', 'R'],
      mainboard: [],
      sideboard: [],
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z'
    };

    it('should save and load deck successfully', async () => {
      await storage.saveDeck(mockDeck);
      const loaded = await storage.loadDeck(mockDeck.id);
      
      expect(loaded).toEqual(mockDeck);
    });

    it('should create directory if it does not exist', async () => {
      await storage.saveDeck(mockDeck);
      
      const dirExists = await fs.access(testDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    });

    it('should throw error when loading non-existent deck', async () => {
      await expect(storage.loadDeck('non-existent')).rejects.toMatchObject({
        error: {
          code: 'DECK_NOT_FOUND'
        }
      });
    });
  });

  describe('deleteDeck', () => {
    const mockDeck: Deck = {
      id: 'delete-test-123',
      name: 'Delete Test',
      format: 'modern',
      colors: [],
      mainboard: [],
      sideboard: [],
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z'
    };

    it('should delete existing deck', async () => {
      await storage.saveDeck(mockDeck);
      await storage.deleteDeck(mockDeck.id);
      
      await expect(storage.loadDeck(mockDeck.id)).rejects.toMatchObject({
        error: {
          code: 'DECK_NOT_FOUND'
        }
      });
    });

    it('should throw error when deleting non-existent deck', async () => {
      await expect(storage.deleteDeck('non-existent')).rejects.toMatchObject({
        error: {
          code: 'DECK_NOT_FOUND'
        }
      });
    });
  });

  describe('listDecks', () => {
    it('should return empty list for empty directory', async () => {
      const decks = await storage.listDecks();
      expect(decks).toEqual([]);
    });

    it('should list existing decks', async () => {
      const deck1: Deck = {
        id: 'deck-1',
        name: 'Deck 1',
        format: 'standard',
        colors: [],
        mainboard: [],
        sideboard: [],
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      const deck2: Deck = {
        id: 'deck-2',
        name: 'Deck 2',
        format: 'modern',
        colors: [],
        mainboard: [],
        sideboard: [],
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      await storage.saveDeck(deck1);
      await storage.saveDeck(deck2);

      const decks = await storage.listDecks();
      expect(decks).toContain('deck-1');
      expect(decks).toContain('deck-2');
      expect(decks).toHaveLength(2);
    });
  });

  describe('deckExists', () => {
    const mockDeck: Deck = {
      id: 'exists-test-123',
      name: 'Exists Test',
      format: 'legacy',
      colors: [],
      mainboard: [],
      sideboard: [],
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z'
    };

    it('should return true for existing deck', async () => {
      await storage.saveDeck(mockDeck);
      const exists = await storage.deckExists(mockDeck.id);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent deck', async () => {
      const exists = await storage.deckExists('non-existent');
      expect(exists).toBe(false);
    });
  });
});