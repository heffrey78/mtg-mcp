import { Deck, DeckCard } from '../types/index.js';
import { logger } from './logger.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FormatRules {
  minDeckSize: number;
  maxDeckSize?: number;
  maxSideboardSize: number;
  maxCopiesPerCard: number;
  bannedCards?: string[];
  restrictedCards?: string[];
  allowedSets?: string[];
}

const FORMAT_RULES: Record<string, FormatRules> = {
  standard: {
    minDeckSize: 60,
    maxSideboardSize: 15,
    maxCopiesPerCard: 4
  },
  modern: {
    minDeckSize: 60,
    maxSideboardSize: 15,
    maxCopiesPerCard: 4
  },
  legacy: {
    minDeckSize: 60,
    maxSideboardSize: 15,
    maxCopiesPerCard: 4
  },
  vintage: {
    minDeckSize: 60,
    maxSideboardSize: 15,
    maxCopiesPerCard: 4
  },
  commander: {
    minDeckSize: 100,
    maxDeckSize: 100,
    maxSideboardSize: 0,
    maxCopiesPerCard: 1
  },
  pauper: {
    minDeckSize: 60,
    maxSideboardSize: 15,
    maxCopiesPerCard: 4
  },
  draft: {
    minDeckSize: 40,
    maxSideboardSize: 0,
    maxCopiesPerCard: 99
  },
  sealed: {
    minDeckSize: 40,
    maxSideboardSize: 0,
    maxCopiesPerCard: 99
  }
};

export class DeckValidator {
  validateDeck(deck: Deck): ValidationResult {
    logger.info('Validating deck', { 
      deckId: deck.id, 
      format: deck.format 
    });

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const rules = this.getFormatRules(deck.format);
    if (!rules) {
      result.errors.push(`Unknown format: ${deck.format}`);
      result.isValid = false;
      return result;
    }

    this.validateDeckSize(deck, rules, result);
    this.validateSideboardSize(deck, rules, result);
    this.validateCardCopies(deck, rules, result);
    this.validateCommanderRules(deck, rules, result);

    logger.info('Deck validation completed', {
      deckId: deck.id,
      isValid: result.isValid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length
    });

    return result;
  }

  private getFormatRules(format: string): FormatRules | null {
    return FORMAT_RULES[format.toLowerCase()] || null;
  }

  private validateDeckSize(deck: Deck, rules: FormatRules, result: ValidationResult): void {
    const mainboardCount = deck.mainboard.reduce((sum, dc) => sum + dc.quantity, 0);

    if (mainboardCount < rules.minDeckSize) {
      result.errors.push(
        `Mainboard has ${mainboardCount} cards, minimum required: ${rules.minDeckSize}`
      );
      result.isValid = false;
    }

    if (rules.maxDeckSize && mainboardCount > rules.maxDeckSize) {
      result.errors.push(
        `Mainboard has ${mainboardCount} cards, maximum allowed: ${rules.maxDeckSize}`
      );
      result.isValid = false;
    }
  }

  private validateSideboardSize(deck: Deck, rules: FormatRules, result: ValidationResult): void {
    const sideboardCount = deck.sideboard.reduce((sum, dc) => sum + dc.quantity, 0);

    if (sideboardCount > rules.maxSideboardSize) {
      result.errors.push(
        `Sideboard has ${sideboardCount} cards, maximum allowed: ${rules.maxSideboardSize}`
      );
      result.isValid = false;
    }
  }

  private validateCardCopies(deck: Deck, rules: FormatRules, result: ValidationResult): void {
    const allCards = [...deck.mainboard, ...deck.sideboard];
    const cardCounts = new Map<string, number>();

    allCards.forEach(dc => {
      const cardName = dc.card.name;
      if (this.isBasicLand(dc.card.type_line)) {
        return;
      }

      const currentCount = cardCounts.get(cardName) || 0;
      cardCounts.set(cardName, currentCount + dc.quantity);
    });

    cardCounts.forEach((count, cardName) => {
      if (count > rules.maxCopiesPerCard) {
        result.errors.push(
          `"${cardName}" has ${count} copies, maximum allowed: ${rules.maxCopiesPerCard}`
        );
        result.isValid = false;
      }
    });
  }

  private validateCommanderRules(deck: Deck, rules: FormatRules, result: ValidationResult): void {
    if (deck.format.toLowerCase() !== 'commander') {
      return;
    }

    const commanders = deck.mainboard.filter(dc => 
      dc.card.type_line.toLowerCase().includes('legendary') &&
      dc.card.type_line.toLowerCase().includes('creature')
    );

    if (commanders.length === 0) {
      result.errors.push('Commander deck must have a legendary creature as commander');
      result.isValid = false;
    } else if (commanders.length > 1) {
      result.errors.push('Commander deck can only have one commander');
      result.isValid = false;
    }

    if (commanders.length === 1) {
      const commander = commanders[0];
      if (commander && commander.quantity !== 1) {
        result.errors.push('Commander must have exactly 1 copy');
        result.isValid = false;
      }

      if (commander) {
        this.validateColorIdentity(deck, commander, result);
      }
    }
  }

  private validateColorIdentity(deck: Deck, commander: DeckCard, result: ValidationResult): void {
    const commanderColors = new Set(commander.card.color_identity);
    
    deck.mainboard.forEach(dc => {
      dc.card.color_identity.forEach(color => {
        if (!commanderColors.has(color)) {
          result.errors.push(
            `"${dc.card.name}" contains color ${color} not in commander's color identity`
          );
          result.isValid = false;
        }
      });
    });
  }

  private isBasicLand(typeLine: string): boolean {
    const basicLands = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'];
    return basicLands.some(land => typeLine.includes(land)) && 
           typeLine.includes('Basic');
  }

  getSupportedFormats(): string[] {
    return Object.keys(FORMAT_RULES);
  }

  getFormatDescription(format: string): string | null {
    const rules = this.getFormatRules(format);
    if (!rules) return null;

    let description = `${rules.minDeckSize}+ cards`;
    if (rules.maxDeckSize) {
      description = `${rules.minDeckSize}-${rules.maxDeckSize} cards`;
    }
    
    if (rules.maxSideboardSize > 0) {
      description += `, ${rules.maxSideboardSize} sideboard`;
    }
    
    description += `, max ${rules.maxCopiesPerCard} copies per card`;
    
    return description;
  }
}