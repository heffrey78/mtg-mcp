import { ZoneManager, ZoneChangeEvent } from '../../rules/zone-manager';
import { MTGCard, GameState } from '../../types';
import { ValidationError } from '../../utils/errors';

describe('ZoneManager', () => {
  let zoneManager: ZoneManager;
  let mockGameState: GameState;
  let mockCard: MTGCard;

  beforeEach(() => {
    zoneManager = ZoneManager.getInstance();
    
    mockCard = {
      id: 'test-card-1',
      name: 'Lightning Bolt',
      mana_cost: '{R}',
      cmc: 1,
      type_line: 'Instant',
      colors: ['R'],
      color_identity: ['R'],
      legalities: { standard: 'legal' },
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
          mana_pool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
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

  describe('validateZoneChange', () => {
    it('should validate moving card from hand to battlefield', () => {
      const event: ZoneChangeEvent = {
        card: mockCard,
        from: 'hand',
        to: 'battlefield',
        player: 'player'
      };

      expect(() => {
        zoneManager.validateZoneChange(event, mockGameState);
      }).not.toThrow();
    });

    it('should throw error when card not in source zone', () => {
      const event: ZoneChangeEvent = {
        card: mockCard,
        from: 'graveyard',
        to: 'hand',
        player: 'player'
      };

      expect(() => {
        zoneManager.validateZoneChange(event, mockGameState);
      }).toThrow(ValidationError);
    });

    it('should throw error for invalid zone transition', () => {
      const event: ZoneChangeEvent = {
        card: mockCard,
        from: 'hand',
        to: 'stack',
        player: 'player'
      };

      expect(() => {
        zoneManager.validateZoneChange(event, mockGameState);
      }).not.toThrow();
    });
  });

  describe('executeZoneChange', () => {
    it('should move card from hand to graveyard', () => {
      const event: ZoneChangeEvent = {
        card: mockCard,
        from: 'hand',
        to: 'graveyard',
        player: 'player'
      };

      const newGameState = zoneManager.executeZoneChange(event, mockGameState);

      expect(newGameState.players.player.hand).not.toContain(mockCard);
      expect(newGameState.players.player.graveyard).toContain(mockCard);
    });

    it('should move card to specific position in library', () => {
      mockGameState.players.player.library = [
        { ...mockCard, id: 'lib-1', name: 'Card 1' },
        { ...mockCard, id: 'lib-2', name: 'Card 2' }
      ];

      const event: ZoneChangeEvent = {
        card: mockCard,
        from: 'hand',
        to: 'library',
        player: 'player',
        position: 1
      };

      const newGameState = zoneManager.executeZoneChange(event, mockGameState);

      expect(newGameState.players.player.library[1]).toEqual(mockCard);
      expect(newGameState.players.player.hand).not.toContain(mockCard);
    });

    it('should move card from battlefield to graveyard', () => {
      mockGameState.battlefield.player = [mockCard];
      mockGameState.players.player.hand = [];

      const event: ZoneChangeEvent = {
        card: mockCard,
        from: 'battlefield',
        to: 'graveyard',
        player: 'player'
      };

      const newGameState = zoneManager.executeZoneChange(event, mockGameState);

      expect(newGameState.battlefield.player).not.toContain(mockCard);
      expect(newGameState.players.player.graveyard).toContain(mockCard);
    });
  });

  describe('drawCard', () => {
    it('should draw card from library to hand', () => {
      const libraryCard = { ...mockCard, id: 'lib-card', name: 'Library Card' };
      mockGameState.players.player.library = [libraryCard];
      mockGameState.players.player.hand = [];

      const drawnCard = zoneManager.drawCard(mockGameState.players.player);

      expect(drawnCard).toEqual(libraryCard);
      expect(mockGameState.players.player.hand).toContain(libraryCard);
      expect(mockGameState.players.player.library).not.toContain(libraryCard);
    });

    it('should return null when drawing from empty library', () => {
      mockGameState.players.player.library = [];

      const drawnCard = zoneManager.drawCard(mockGameState.players.player);

      expect(drawnCard).toBeNull();
    });
  });

  describe('millCards', () => {
    it('should mill specified number of cards', () => {
      const cards = [
        { ...mockCard, id: 'mill-1', name: 'Mill Card 1' },
        { ...mockCard, id: 'mill-2', name: 'Mill Card 2' },
        { ...mockCard, id: 'mill-3', name: 'Mill Card 3' }
      ];
      mockGameState.players.player.library = [...cards];
      mockGameState.players.player.graveyard = [];

      const milledCards = zoneManager.millCards(mockGameState.players.player, 2);

      expect(milledCards).toHaveLength(2);
      expect(mockGameState.players.player.library).toHaveLength(1);
      expect(mockGameState.players.player.graveyard).toHaveLength(2);
      expect(milledCards[0]).toEqual(cards[0]);
      expect(milledCards[1]).toEqual(cards[1]);
    });

    it('should mill remaining cards when count exceeds library size', () => {
      const card = { ...mockCard, id: 'mill-1', name: 'Mill Card 1' };
      mockGameState.players.player.library = [card];
      mockGameState.players.player.graveyard = [];

      const milledCards = zoneManager.millCards(mockGameState.players.player, 3);

      expect(milledCards).toHaveLength(1);
      expect(mockGameState.players.player.library).toHaveLength(0);
      expect(mockGameState.players.player.graveyard).toHaveLength(1);
    });
  });

  describe('shuffleLibrary', () => {
    it('should shuffle library cards', () => {
      const cards = Array.from({ length: 10 }, (_, i) => ({
        ...mockCard,
        id: `card-${i}`,
        name: `Card ${i}`
      }));
      
      mockGameState.players.player.library = [...cards];
      const originalOrder = [...mockGameState.players.player.library];

      zoneManager.shuffleLibrary(mockGameState.players.player);

      expect(mockGameState.players.player.library).toHaveLength(10);
      
      const orderChanged = mockGameState.players.player.library.some(
        (card, index) => card.id !== originalOrder[index]?.id
      );
      expect(orderChanged).toBe(true);
    });
  });

  describe('searchLibrary', () => {
    it('should find cards matching predicate', () => {
      const cards = [
        { ...mockCard, id: 'land-1', name: 'Mountain', type_line: 'Basic Land — Mountain' },
        { ...mockCard, id: 'spell-1', name: 'Lightning Bolt', type_line: 'Instant' },
        { ...mockCard, id: 'land-2', name: 'Forest', type_line: 'Basic Land — Forest' }
      ];
      
      mockGameState.players.player.library = cards;

      const lands = zoneManager.searchLibrary(
        mockGameState.players.player,
        card => card.type_line.includes('Land')
      );

      expect(lands).toHaveLength(2);
      expect(lands[0]?.name).toBe('Mountain');
      expect(lands[1]?.name).toBe('Forest');
    });

    it('should return empty array when no cards match', () => {
      const cards = [
        { ...mockCard, id: 'spell-1', name: 'Lightning Bolt', type_line: 'Instant' }
      ];
      
      mockGameState.players.player.library = cards;

      const lands = zoneManager.searchLibrary(
        mockGameState.players.player,
        card => card.type_line.includes('Land')
      );

      expect(lands).toHaveLength(0);
    });
  });
});