# Magic: The Gathering MCP Server Architecture

## Core Server Structure

### Server Configuration
```typescript
interface MTGMCPServer {
  name: "mtg-stdio-server"
  version: "1.0.0"
  protocol_version: "2024-11-05"
  capabilities: {
    tools: true
    resources: true
    prompts: true
  }
}
```

## Tool Categories

### 1. Card Database & Research Tools

#### `search_cards`
- **Purpose**: Search MTG card database by name, type, mana cost, abilities
- **Parameters**: 
  - `query`: string (card name, partial name, or keyword)
  - `filters`: object (color, type, cmc, set, format)
  - `limit`: number (default 20)
- **Returns**: Array of card objects with full details

#### `get_card_details`
- **Purpose**: Get comprehensive information about a specific card
- **Parameters**: 
  - `card_name`: string
  - `set_code`: string (optional)
- **Returns**: Full card object with rulings, legality, pricing

#### `search_sets`
- **Purpose**: Browse Magic sets and expansions
- **Parameters**: 
  - `set_name`: string (optional)
  - `release_year`: number (optional)
  - `set_type`: string (core, expansion, masters, etc.)
- **Returns**: Set information with card list

#### `get_rulings`
- **Purpose**: Get official rulings and clarifications for cards
- **Parameters**: 
  - `card_name`: string
- **Returns**: Official rulings and card interactions

### 2. Deck Building Tools

#### `create_deck`
- **Purpose**: Initialize a new deck
- **Parameters**: 
  - `name`: string
  - `format`: string (standard, modern, commander, etc.)
  - `colors`: array of strings
- **Returns**: Deck ID and basic structure

#### `add_card_to_deck`
- **Purpose**: Add cards to a deck with quantity validation
- **Parameters**: 
  - `deck_id`: string
  - `card_name`: string
  - `quantity`: number
  - `sideboard`: boolean (default false)
- **Returns**: Updated deck composition

#### `analyze_deck`
- **Purpose**: Provide deck analysis and suggestions
- **Parameters**: 
  - `deck_id`: string
- **Returns**: Mana curve, type distribution, synergy analysis, suggestions

#### `validate_deck`
- **Purpose**: Check deck legality for specific formats
- **Parameters**: 
  - `deck_id`: string
  - `format`: string
- **Returns**: Legality status and violations

#### `suggest_cards`
- **Purpose**: AI-powered card recommendations for deck improvement
- **Parameters**: 
  - `deck_id`: string
  - `strategy`: string (aggro, control, combo, etc.)
  - `budget`: number (optional)
- **Returns**: Recommended cards with explanations

### 3. Game State Management Tools

#### `start_game`
- **Purpose**: Initialize a new game session
- **Parameters**: 
  - `player_deck`: string (deck_id)
  - `opponent_deck`: string (deck_id or "ai_generated")
  - `game_mode`: string (tutorial, practice, competitive)
- **Returns**: Game session ID and initial state

#### `get_game_state`
- **Purpose**: Retrieve current game state
- **Parameters**: 
  - `game_id`: string
- **Returns**: Complete game state object

#### `play_card`
- **Purpose**: Execute a card play action
- **Parameters**: 
  - `game_id`: string
  - `card_id`: string
  - `targets`: array (optional)
  - `payment`: object (mana costs, additional costs)
- **Returns**: Updated game state

#### `declare_attackers`
- **Purpose**: Declare attacking creatures
- **Parameters**: 
  - `game_id`: string
  - `attackers`: array of creature IDs
- **Returns**: Updated combat state

#### `declare_blockers`
- **Purpose**: Declare blocking creatures
- **Parameters**: 
  - `game_id`: string
  - `blocks`: array of {attacker_id, blocker_id} pairs
- **Returns**: Updated combat state

#### `pass_priority`
- **Purpose**: Pass priority to opponent
- **Parameters**: 
  - `game_id`: string
- **Returns**: Updated game state with priority transfer

### 4. Learning & Tutorial Tools

#### `start_tutorial`
- **Purpose**: Begin interactive tutorial session
- **Parameters**: 
  - `lesson_type`: string (basics, combat, stack, specific_mechanic)
  - `skill_level`: string (beginner, intermediate, advanced)
- **Returns**: Tutorial session with guided steps

#### `explain_mechanic`
- **Purpose**: Detailed explanation of game mechanics
- **Parameters**: 
  - `mechanic`: string (flying, trample, hexproof, etc.)
  - `context`: string (optional - current game situation)
- **Returns**: Explanation with examples and rulings

#### `analyze_play`
- **Purpose**: Provide feedback on player decisions
- **Parameters**: 
  - `game_id`: string
  - `action`: object (the action taken)
  - `alternative_actions`: array (other possible actions)
- **Returns**: Analysis of play quality and suggestions

#### `get_hint`
- **Purpose**: Provide strategic hints during gameplay
- **Parameters**: 
  - `game_id`: string
  - `hint_type`: string (next_play, threat_assessment, line_of_play)
- **Returns**: Contextual hint without spoiling the game

### 5. AI Opponent Tools

#### `generate_ai_deck`
- **Purpose**: Create AI opponent deck
- **Parameters**: 
  - `archetype`: string
  - `power_level`: number (1-10)
  - `format`: string
- **Returns**: Complete deck list for AI opponent

#### `ai_make_decision`
- **Purpose**: AI opponent makes a game decision
- **Parameters**: 
  - `game_id`: string
  - `decision_type`: string (play, attack, block, respond)
  - `difficulty`: string (easy, medium, hard)
- **Returns**: AI's chosen action with reasoning

#### `ai_mulligan_decision`
- **Purpose**: AI decides whether to mulligan
- **Parameters**: 
  - `hand`: array of card objects
  - `deck_strategy`: string
- **Returns**: Mulligan decision with explanation

## Resource Management

### Persistent Resources

#### Game Sessions
- **URI**: `game://sessions/{game_id}`
- **Content**: Complete game state including board, hands, graveyards, life totals
- **Persistence**: In-memory during session, optionally saved to file

#### Deck Collections
- **URI**: `deck://collections/{user_id}/{deck_id}`
- **Content**: Deck lists with metadata
- **Persistence**: File-based storage in JSON format

#### Card Database
- **URI**: `cards://database/`
- **Content**: Scryfall API integration or local card database
- **Persistence**: Cached locally, updated periodically

#### Tutorial Progress
- **URI**: `tutorial://progress/{user_id}`
- **Content**: Completed lessons, skill assessments
- **Persistence**: File-based progress tracking

## Prompt Templates

### Learning Assistant Prompts

#### `deck_builder_assistant`
```
You are an expert Magic: The Gathering deck builder. Help the user create a competitive and fun deck based on their preferences:
- Format: {format}
- Colors: {colors}
- Strategy: {strategy}
- Budget: {budget}

Provide specific card recommendations with explanations of synergies and strategic value.
```

#### `rules_tutor`
```
You are a patient Magic: The Gathering rules expert. Explain the following concept clearly:
- Topic: {topic}
- Player level: {skill_level}
- Current situation: {context}

Use simple examples and break down complex interactions step by step.
```

#### `play_analyzer`
```
Analyze this Magic: The Gathering play:
- Game state: {game_state}
- Action taken: {action}
- Alternative options: {alternatives}

Provide constructive feedback on the decision quality and suggest improvements.
```

### AI Opponent Prompts

#### `ai_opponent`
```
You are playing Magic: The Gathering as an AI opponent with these characteristics:
- Deck archetype: {archetype}
- Skill level: {difficulty}
- Current game state: {game_state}

Make the most strategically sound decision available. Consider:
- Board presence and threats
- Hand size and card advantage
- Mana efficiency
- Win conditions and game plan

Explain your reasoning briefly.
```

## Game State Data Structure

```typescript
interface GameState {
  game_id: string
  turn_number: number
  active_player: "player" | "ai"
  phase: "upkeep" | "draw" | "main1" | "combat" | "main2" | "end"
  step?: "declare_attackers" | "declare_blockers" | "damage"
  priority: "player" | "ai"
  
  players: {
    player: PlayerState
    ai: PlayerState
  }
  
  battlefield: {
    player: Card[]
    ai: Card[]
  }
  
  stack: StackObject[]
  
  combat?: {
    attackers: CombatCreature[]
    blockers: BlockAssignment[]
  }
  
  game_log: GameEvent[]
}

interface PlayerState {
  life: number
  mana_pool: ManaPool
  hand: Card[]
  library: Card[]
  graveyard: Card[]
  exile: Card[]
}
```

## Integration Points

### External APIs
- **Scryfall API**: Card data, images, rulings
- **EDHREC API**: Commander format statistics and recommendations
- **MTGTop8**: Competitive deck lists and meta information

### Data Sources
- **Card Database**: Comprehensive card information with regular updates
- **Rules Database**: Official comprehensive rules and tournament rules
- **Format Legality**: Current format restrictions and banned lists

## Error Handling

### Tool Error Responses
```typescript
interface ToolError {
  error: {
    code: string
    message: string
    details?: any
  }
}
```

### Common Error Scenarios
- Invalid card names or IDs
- Illegal game actions
- Format violations
- Network connectivity issues with external APIs
- Game state corruption

## Performance Considerations

### Caching Strategy
- Card data cached locally with periodic updates
- Game states kept in memory during active sessions
- Frequently accessed card images cached locally

### Rate Limiting
- Respectful API usage with external services
- Internal rate limiting for resource-intensive operations
- Graceful degradation when external services are unavailable

## Security & Privacy

### Data Protection
- No personal information stored beyond local session data
- Deck lists stored locally unless explicitly shared
- No transmission of sensitive user data

### Input Validation
- Sanitize all user inputs for card names and deck data
- Validate game actions against rules engine
- Prevent injection attacks in search queries

## Future Extensions

### Multiplayer Support
- Extension to support multiple human players
- Tournament bracket management
- Draft simulation tools

### Advanced AI Features
- Machine learning for improved AI decision making
- Personalized tutoring based on play patterns
- Meta-game analysis and predictions

### Community Features
- Deck sharing and rating system
- Tournament result tracking
- Social learning features

This MCP server architecture provides a comprehensive foundation for Magic: The Gathering learning and gameplay, with clear separation of concerns and extensibility for future enhancements.