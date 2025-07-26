export interface MTGCard {
  id: string;
  name: string;
  mana_cost?: string | undefined;
  cmc: number;
  type_line: string;
  oracle_text?: string | undefined;
  power?: string | undefined;
  toughness?: string | undefined;
  colors: string[];
  color_identity: string[];
  legalities: Record<string, string>;
  set: string;
  set_name: string;
  rarity: string;
  image_uris?: {
    small?: string | undefined;
    normal?: string | undefined;
    large?: string | undefined;
  } | undefined;
}

export interface Deck {
  id: string;
  name: string;
  format: string;
  colors: string[];
  mainboard: DeckCard[];
  sideboard: DeckCard[];
  created_at: string;
  updated_at: string;
  metadata?: {
    description?: string;
    author?: string;
    version?: number;
  };
}

export interface DeckCard {
  card: MTGCard;
  quantity: number;
}

export interface GameState {
  game_id: string;
  turn_number: number;
  active_player: 'player' | 'ai';
  phase: 'upkeep' | 'draw' | 'main1' | 'combat' | 'main2' | 'end';
  step?: 'declare_attackers' | 'declare_blockers' | 'damage';
  priority: 'player' | 'ai';
  players: {
    player: PlayerState;
    ai: PlayerState;
  };
  battlefield: {
    player: MTGCard[];
    ai: MTGCard[];
  };
  stack: StackObject[];
  combat?: {
    attackers: CombatCreature[];
    blockers: BlockAssignment[];
  };
  game_log: GameEvent[];
}

export interface PlayerState {
  life: number;
  mana_pool: ManaPool;
  hand: MTGCard[];
  library: MTGCard[];
  graveyard: MTGCard[];
  exile: MTGCard[];
}

export interface ManaPool {
  white: number;
  blue: number;
  black: number;
  red: number;
  green: number;
  colorless: number;
}

export interface StackObject {
  id: string;
  source: MTGCard;
  controller: 'player' | 'ai';
  targets?: string[];
}

export interface CombatCreature {
  id: string;
  card: MTGCard;
  attacking_player?: 'player' | 'ai';
}

export interface BlockAssignment {
  attacker_id: string;
  blocker_id: string;
}

export interface GameEvent {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  player: 'player' | 'ai';
  data?: Record<string, unknown>;
}

export interface ToolError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}