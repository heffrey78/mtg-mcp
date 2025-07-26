import { promises as fs } from 'fs';
import path from 'path';
import { Deck, DeckCard, MTGCard } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { createErrorResponse } from '../utils/errors.js';

export class DeckStorage {
  private readonly deckDir: string;

  constructor(baseDir: string = 'decks') {
    this.deckDir = path.resolve(baseDir);
  }

  async ensureDeckDirectory(): Promise<void> {
    try {
      await fs.access(this.deckDir);
    } catch {
      await fs.mkdir(this.deckDir, { recursive: true });
      logger.info('Created deck storage directory', { path: this.deckDir });
    }
  }

  private getDeckPath(deckId: string): string {
    return path.join(this.deckDir, `${deckId}.json`);
  }

  async saveDeck(deck: Deck): Promise<void> {
    await this.ensureDeckDirectory();
    const deckPath = this.getDeckPath(deck.id);
    
    try {
      await fs.writeFile(deckPath, JSON.stringify(deck, null, 2), 'utf8');
      logger.info('Deck saved successfully', { 
        deckId: deck.id, 
        deckName: deck.name,
        path: deckPath 
      });
    } catch (error) {
      logger.error('Failed to save deck', { deckId: deck.id, error });
      throw createErrorResponse('DECK_SAVE_FAILED', `Failed to save deck: ${deck.id}`);
    }
  }

  async loadDeck(deckId: string): Promise<Deck> {
    const deckPath = this.getDeckPath(deckId);
    
    try {
      const data = await fs.readFile(deckPath, 'utf8');
      const deck: Deck = JSON.parse(data);
      logger.info('Deck loaded successfully', { 
        deckId: deck.id, 
        deckName: deck.name 
      });
      return deck;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw createErrorResponse('DECK_NOT_FOUND', `Deck not found: ${deckId}`);
      }
      logger.error('Failed to load deck', { deckId, error });
      throw createErrorResponse('DECK_LOAD_FAILED', `Failed to load deck: ${deckId}`);
    }
  }

  async deleteDeck(deckId: string): Promise<void> {
    const deckPath = this.getDeckPath(deckId);
    
    try {
      await fs.unlink(deckPath);
      logger.info('Deck deleted successfully', { deckId });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw createErrorResponse('DECK_NOT_FOUND', `Deck not found: ${deckId}`);
      }
      logger.error('Failed to delete deck', { deckId, error });
      throw createErrorResponse('DECK_DELETE_FAILED', `Failed to delete deck: ${deckId}`);
    }
  }

  async listDecks(): Promise<string[]> {
    await this.ensureDeckDirectory();
    
    try {
      const files = await fs.readdir(this.deckDir);
      const deckIds = files
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));
      
      logger.info('Listed decks', { count: deckIds.length });
      return deckIds;
    } catch (error) {
      logger.error('Failed to list decks', { error });
      throw createErrorResponse('DECK_LIST_FAILED', 'Failed to list decks');
    }
  }

  async deckExists(deckId: string): Promise<boolean> {
    const deckPath = this.getDeckPath(deckId);
    
    try {
      await fs.access(deckPath);
      return true;
    } catch {
      return false;
    }
  }

  generateDeckId(name: string): string {
    const timestamp = Date.now();
    const sanitized = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    return sanitized ? `${sanitized}-${timestamp}` : `${timestamp}`;
  }
}