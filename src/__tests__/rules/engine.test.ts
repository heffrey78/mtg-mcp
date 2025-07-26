import { MTGRulesEngine, GameAction, RuleValidationResult } from '../../rules/engine';
import { MTGCard, GameState, ManaPool } from '../../types';

describe('MTGRulesEngine', () => {
  let rulesEngine: MTGRulesEngine;
  let mockGameState: GameState;
  let mockCard: MTGCard;

  beforeEach(() => {
    rulesEngine = MTGRulesEngine.getInstance();
    
    mockCard = {
      id: 'test-card-1',
      name: 'Lightning Bolt',
      mana_cost: '{R}',
      cmc: 1,
      type_line: 'Instant',
      oracle_text: 'Lightning Bolt deals 3 damage to any target.',
      colors: ['R'],
      color_identity: ['R'],
      legalities: { standard: 'legal', modern: 'legal' },
      set: 'LEA',
      set_name: 'Limited Edition Alpha',
      rarity: 'common'
    };

    mockGameState = {
      game_id: 'test-game',
      turn_number: 1,
      active_player: 'player',
      phase: 'main1',
      priority: 'player',
      players: {
        player: {
          life: 20,
          mana_pool: { white: 0, blue: 0, black: 0, red: 1, green: 0, colorless: 0 },
          hand: [mockCard],
          library: [],
          graveyard: [],
          exile: []
        },
        ai: {
          life: 20,
          mana_pool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
          hand: [],
          library: [],
          graveyard: [],
          exile: []
        }
      },
      battlefield: {
        player: [],
        ai: []
      },
      stack: [],
      game_log: []
    };
  });

  describe('validateAction', () => {
    it('should validate a legal spell cast', () => {
      const action: GameAction = {
        type: 'cast_spell',
        player: 'player',
        cardId: 'test-card-1',
        manaPayment: { red: 1 }
      };

      const result = rulesEngine.validateAction(action, mockGameState);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject spell cast with insufficient mana', () => {
      const action: GameAction = {
        type: 'cast_spell',
        player: 'player',
        cardId: 'test-card-1',
        manaPayment: { white: 1 }
      };

      const result = rulesEngine.validateAction(action, mockGameState);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Insufficient mana to cast Lightning Bolt');
    });

    it('should reject spell cast from wrong zone', () => {
      mockGameState.players.player.hand = [];
      
      const action: GameAction = {
        type: 'cast_spell',
        player: 'player',
        cardId: 'test-card-1'
      };

      const result = rulesEngine.validateAction(action, mockGameState);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Card not found in player hand');
    });

    it('should validate land play during main phase', () => {
      const landCard: MTGCard = {
        ...mockCard,
        id: 'test-land-1',
        name: 'Mountain',
        type_line: 'Basic Land — Mountain',
        mana_cost: undefined,
        cmc: 0
      };
      
      mockGameState.players.player.hand = [landCard];
      
      const action: GameAction = {
        type: 'play_land',
        player: 'player',
        cardId: 'test-land-1'
      };

      const result = rulesEngine.validateAction(action, mockGameState);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject land play during combat', () => {
      const landCard: MTGCard = {
        ...mockCard,
        id: 'test-land-1',
        name: 'Mountain',
        type_line: 'Basic Land — Mountain',
        mana_cost: undefined,
        cmc: 0
      };
      
      mockGameState.players.player.hand = [landCard];
      mockGameState.phase = 'combat';
      
      const action: GameAction = {
        type: 'play_land',
        player: 'player',
        cardId: 'test-land-1'
      };

      const result = rulesEngine.validateAction(action, mockGameState);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot play land at current timing');
    });

    it('should validate attacker declaration during combat', () => {
      mockGameState.phase = 'combat';
      mockGameState.step = 'declare_attackers';
      
      const action: GameAction = {
        type: 'declare_attackers',
        player: 'player'
      };

      const result = rulesEngine.validateAction(action, mockGameState);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject attacker declaration by non-active player', () => {
      mockGameState.phase = 'combat';
      mockGameState.step = 'declare_attackers';
      
      const action: GameAction = {
        type: 'declare_attackers',
        player: 'ai'
      };

      const result = rulesEngine.validateAction(action, mockGameState);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Only active player can declare attackers');
    });
  });

  describe('checkStateBasedActions', () => {
    it('should detect player death from 0 life', () => {
      mockGameState.players.player.life = 0;
      
      const actions = rulesEngine.checkStateBasedActions(mockGameState);
      
      expect(actions).toContain('player loses the game due to 0 or less life');
    });

    it('should detect player loss from empty library', () => {
      mockGameState.players.ai.library = [];
      
      const actions = rulesEngine.checkStateBasedActions(mockGameState);
      
      expect(actions).toContain('ai loses the game by drawing from empty library');
    });

    it('should detect creature death from 0 toughness', () => {
      const creature: MTGCard = {
        ...mockCard,
        id: 'creature-1',
        name: 'Test Creature',
        type_line: 'Creature — Human',
        power: '1',
        toughness: '0'
      };
      
      mockGameState.battlefield.player = [creature];
      
      const actions = rulesEngine.checkStateBasedActions(mockGameState);
      
      expect(actions).toContain('Test Creature is put into player\'s graveyard (0 toughness)');
    });
  });

  describe('validateFormatLegality', () => {
    it('should validate legal Standard deck', () => {
      const deck = {
        mainboard: [
          { card: mockCard, quantity: 4 }
        ]
      };

      const result = rulesEngine.validateFormatLegality(deck, 'Standard');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Deck too small (4/60)');
    });

    it('should reject deck with banned card', () => {
      const bannedCard = {
        ...mockCard,
        legalities: { standard: 'banned' }
      };
      
      const deck = {
        mainboard: [
          { card: bannedCard, quantity: 4 }
        ]
      };

      const result = rulesEngine.validateFormatLegality(deck, 'Standard');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Lightning Bolt is banned in Standard');
    });

    it('should reject deck with too many copies', () => {
      const fullDeck = Array(60).fill({ card: mockCard, quantity: 1 });
      fullDeck[0] = { card: mockCard, quantity: 5 };
      
      const deck = {
        mainboard: fullDeck
      };

      const result = rulesEngine.validateFormatLegality(deck, 'Standard');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Too many copies of Lightning Bolt (5/4)');
    });

    it('should validate Commander deck with commander', () => {
      const commander: MTGCard = {
        ...mockCard,
        id: 'commander-1',
        name: 'Alesha, Who Smiles at Death',
        type_line: 'Legendary Creature — Human Warrior',
        legalities: { commander: 'legal' }
      };
      
      const basicCard: MTGCard = {
        ...mockCard,
        id: 'basic-1',
        name: 'Mountain',
        type_line: 'Basic Land — Mountain',
        legalities: { commander: 'legal' }
      };
      
      const deck = {
        mainboard: Array(99).fill({ card: basicCard, quantity: 1 }).concat([
          { card: commander, quantity: 1 }
        ])
      };

      const result = rulesEngine.validateFormatLegality(deck, 'Commander');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject Commander deck without commander', () => {
      const deck = {
        mainboard: Array(100).fill({ card: mockCard, quantity: 1 })
      };

      const result = rulesEngine.validateFormatLegality(deck, 'Commander');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Commander format requires a legendary creature or planeswalker commander');
    });
  });

  describe('mana cost parsing', () => {
    it('should parse simple colored mana costs', () => {
      const engine = rulesEngine as any;
      
      const result = engine.parseManaCost('{R}');
      expect(result).toEqual({
        white: 0, blue: 0, black: 0, red: 1, green: 0, colorless: 0
      });
    });

    it('should parse hybrid mana costs', () => {
      const engine = rulesEngine as any;
      
      const result = engine.parseManaCost('{2}{R}{G}');
      expect(result).toEqual({
        white: 0, blue: 0, black: 0, red: 1, green: 1, colorless: 2
      });
    });

    it('should parse complex mana costs', () => {
      const engine = rulesEngine as any;
      
      const result = engine.parseManaCost('{3}{W}{U}{B}');
      expect(result).toEqual({
        white: 1, blue: 1, black: 1, red: 0, green: 0, colorless: 3
      });
    });
  });
});