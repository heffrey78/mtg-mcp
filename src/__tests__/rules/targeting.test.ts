import { TargetingManager, Target, TargetRestriction } from '../../rules/targeting';
import { MTGCard, GameState } from '../../types';

describe('TargetingManager', () => {
  let targetingManager: TargetingManager;
  let mockGameState: GameState;

  beforeEach(() => {
    targetingManager = TargetingManager.getInstance();
    
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
          hand: [],
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
        player: [
          {
            id: 'creature-1',
            name: 'Grizzly Bears',
            type_line: 'Creature — Bear',
            mana_cost: '{1}{G}',
            cmc: 2,
            power: '2',
            toughness: '2',
            colors: ['G'],
            color_identity: ['G'],
            legalities: {},
            set: 'LEA',
            set_name: 'Limited Edition Alpha',
            rarity: 'common'
          }
        ],
        ai: [
          {
            id: 'creature-2',
            name: 'Savannah Lions',
            type_line: 'Creature — Cat',
            mana_cost: '{W}',
            cmc: 1,
            power: '2',
            toughness: '1',
            colors: ['W'],
            color_identity: ['W'],
            legalities: {},
            set: 'LEA',
            set_name: 'Limited Edition Alpha',
            rarity: 'rare'
          }
        ]
      },
      stack: [],
      game_log: []
    };
  });

  describe('parseTargetRequirements', () => {
    it('should parse simple creature target', () => {
      const card: MTGCard = {
        id: 'spell-1',
        name: 'Lightning Bolt',
        oracle_text: 'Lightning Bolt deals 3 damage to target creature or player.',
        type_line: 'Instant',
        mana_cost: '{R}',
        cmc: 1,
        colors: ['R'],
        color_identity: ['R'],
        legalities: {},
        set: 'LEA',
        set_name: 'Limited Edition Alpha',
        rarity: 'common'
      };

      const requirements = targetingManager.parseTargetRequirements(card);

      expect(requirements).toHaveLength(1);
      expect(requirements[0]?.type).toBe('creature');
      expect(requirements[0]?.count).toBe(1);
      expect(requirements[0]?.optional).toBe(false);
    });

    it('should parse creature you control target', () => {
      const card: MTGCard = {
        id: 'spell-2',
        name: 'Giant Growth',
        oracle_text: 'Target creature you control gets +3/+3 until end of turn.',
        type_line: 'Instant',
        mana_cost: '{G}',
        cmc: 1,
        colors: ['G'],
        color_identity: ['G'],
        legalities: {},
        set: 'LEA',
        set_name: 'Limited Edition Alpha',
        rarity: 'common'
      };

      const requirements = targetingManager.parseTargetRequirements(card);

      expect(requirements).toHaveLength(1);
      expect(requirements[0]?.type).toBe('creature');
      expect(requirements[0]?.restrictions).toContain('you_control');
    });

    it('should parse up to X targets', () => {
      const card: MTGCard = {
        id: 'spell-3',
        name: 'Forked Lightning',
        oracle_text: 'Forked Lightning deals 2 damage to up to two target creatures.',
        type_line: 'Sorcery',
        mana_cost: '{3}{R}',
        cmc: 4,
        colors: ['R'],
        color_identity: ['R'],
        legalities: {},
        set: 'LEA',
        set_name: 'Limited Edition Alpha',
        rarity: 'rare'
      };

      const requirements = targetingManager.parseTargetRequirements(card);

      expect(requirements).toHaveLength(1);
      expect(requirements[0]?.type).toBe('creature');
      expect(requirements[0]?.count).toBe(1);
      expect(requirements[0]?.optional).toBe(false);
    });

    it('should parse no targets for non-targeted spells', () => {
      const card: MTGCard = {
        id: 'spell-4',
        name: 'Wrath of God',
        oracle_text: 'Destroy all creatures.',
        type_line: 'Sorcery',
        mana_cost: '{2}{W}{W}',
        cmc: 4,
        colors: ['W'],
        color_identity: ['W'],
        legalities: {},
        set: 'LEA',
        set_name: 'Limited Edition Alpha',
        rarity: 'rare'
      };

      const requirements = targetingManager.parseTargetRequirements(card);

      expect(requirements).toHaveLength(0);
    });
  });

  describe('validateTargets', () => {
    it('should validate correct creature target', () => {
      const card: MTGCard = {
        id: 'spell-1',
        name: 'Lightning Bolt',
        oracle_text: 'Lightning Bolt deals 3 damage to target creature or player.',
        type_line: 'Instant',
        mana_cost: '{R}',
        cmc: 1,
        colors: ['R'],
        color_identity: ['R'],
        legalities: {},
        set: 'LEA',
        set_name: 'Limited Edition Alpha',
        rarity: 'common'
      };

      const targets: Target[] = [
        { id: 'creature-1', type: 'creature', controller: 'player' }
      ];

      const isValid = targetingManager.validateTargets(card, targets, mockGameState);

      expect(isValid).toBe(true);
    });

    it('should validate player target', () => {
      const card: MTGCard = {
        id: 'spell-1',
        name: 'Lightning Bolt',
        oracle_text: 'Lightning Bolt deals 3 damage to target player.',
        type_line: 'Instant',
        mana_cost: '{R}',
        cmc: 1,
        colors: ['R'],
        color_identity: ['R'],
        legalities: {},
        set: 'LEA',
        set_name: 'Limited Edition Alpha',
        rarity: 'common'
      };

      const targets: Target[] = [
        { id: 'player', type: 'player', controller: 'player' }
      ];

      const isValid = targetingManager.validateTargets(card, targets, mockGameState);

      expect(isValid).toBe(true);
    });

    it('should reject wrong number of targets', () => {
      const card: MTGCard = {
        id: 'spell-1',
        name: 'Lightning Bolt',
        oracle_text: 'Lightning Bolt deals 3 damage to target creature or player.',
        type_line: 'Instant',
        mana_cost: '{R}',
        cmc: 1,
        colors: ['R'],
        color_identity: ['R'],
        legalities: {},
        set: 'LEA',
        set_name: 'Limited Edition Alpha',
        rarity: 'common'
      };

      const targets: Target[] = [
        { id: 'creature-1', type: 'creature', controller: 'player' },
        { id: 'creature-2', type: 'creature', controller: 'ai' }
      ];

      const isValid = targetingManager.validateTargets(card, targets, mockGameState);

      expect(isValid).toBe(false);
    });

    it('should validate no targets for non-targeted spell', () => {
      const card: MTGCard = {
        id: 'spell-4',
        name: 'Wrath of God',
        oracle_text: 'Destroy all creatures.',
        type_line: 'Sorcery',
        mana_cost: '{2}{W}{W}',
        cmc: 4,
        colors: ['W'],
        color_identity: ['W'],
        legalities: {},
        set: 'LEA',
        set_name: 'Limited Edition Alpha',
        rarity: 'rare'
      };

      const targets: Target[] = [];

      const isValid = targetingManager.validateTargets(card, targets, mockGameState);

      expect(isValid).toBe(true);
    });
  });

  describe('getValidTargets', () => {
    it('should find all valid creature targets', () => {
      const card: MTGCard = {
        id: 'spell-1',
        name: 'Lightning Bolt',
        oracle_text: 'Lightning Bolt deals 3 damage to target creature.',
        type_line: 'Instant',
        mana_cost: '{R}',
        cmc: 1,
        colors: ['R'],
        color_identity: ['R'],
        legalities: {},
        set: 'LEA',
        set_name: 'Limited Edition Alpha',
        rarity: 'common'
      };

      const validTargets = targetingManager.getValidTargets(card, mockGameState, 'player');

      expect(validTargets).toHaveLength(2);
      expect(validTargets.some(t => t.id === 'creature-1')).toBe(true);
      expect(validTargets.some(t => t.id === 'creature-2')).toBe(true);
    });

    it('should find valid player targets', () => {
      const card: MTGCard = {
        id: 'spell-1',
        name: 'Lightning Bolt',
        oracle_text: 'Lightning Bolt deals 3 damage to target player.',
        type_line: 'Instant',
        mana_cost: '{R}',
        cmc: 1,
        colors: ['R'],
        color_identity: ['R'],
        legalities: {},
        set: 'LEA',
        set_name: 'Limited Edition Alpha',
        rarity: 'common'
      };

      const validTargets = targetingManager.getValidTargets(card, mockGameState, 'player');

      expect(validTargets).toHaveLength(2);
      expect(validTargets.some(t => t.id === 'player')).toBe(true);
      expect(validTargets.some(t => t.id === 'ai')).toBe(true);
    });

    it('should filter by control restrictions', () => {
      const card: MTGCard = {
        id: 'spell-2',
        name: 'Giant Growth',
        oracle_text: 'Target creature you control gets +3/+3 until end of turn.',
        type_line: 'Instant',
        mana_cost: '{G}',
        cmc: 1,
        colors: ['G'],
        color_identity: ['G'],
        legalities: {},
        set: 'LEA',
        set_name: 'Limited Edition Alpha',
        rarity: 'common'
      };

      const validTargets = targetingManager.getValidTargets(card, mockGameState, 'player');

      expect(validTargets).toHaveLength(1);
      expect(validTargets[0]?.id).toBe('creature-1');
      expect(validTargets[0]?.controller).toBe('player');
    });

    it('should return empty array for spells with no targets', () => {
      const card: MTGCard = {
        id: 'spell-4',
        name: 'Wrath of God',
        oracle_text: 'Destroy all creatures.',
        type_line: 'Sorcery',
        mana_cost: '{2}{W}{W}',
        cmc: 4,
        colors: ['W'],
        color_identity: ['W'],
        legalities: {},
        set: 'LEA',
        set_name: 'Limited Edition Alpha',
        rarity: 'rare'
      };

      const validTargets = targetingManager.getValidTargets(card, mockGameState, 'player');

      expect(validTargets).toHaveLength(0);
    });
  });
});