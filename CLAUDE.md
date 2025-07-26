# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Magic: The Gathering (MTG) MCP server that provides comprehensive Magic card database access, deck building tools, AI-powered gameplay, and interactive tutorials over STDIO. The server enables users to create and edit MTG decks, play against an AI opponent, and receive guided learning experiences.

## Architecture

The project follows the MCP (Model Context Protocol) specification with a TypeScript-based server architecture providing:

- **Card Database & Research Tools**: Search cards, get details, browse sets, access rulings
- **Deck Building Tools**: Create/edit decks, analyze composition, validate format legality, get AI suggestions
- **Game State Management**: Full game simulation with turn-based play, combat, and stack management
- **Learning & Tutorial System**: Interactive tutorials, mechanic explanations, play analysis
- **AI Opponent**: Intelligent opponent with configurable difficulty and deck archetypes

## Key Components

### Tool Categories (from idea.md:19-192)
- Card database integration with Scryfall API
- Deck management with format validation
- Real-time game state tracking
- AI decision engine for opponent behavior
- Educational content delivery system

### Data Structures (from idea.md:272-309)
- `GameState`: Complete game state including players, battlefield, stack, combat
- `PlayerState`: Individual player data (life, mana, hand, library, graveyard, exile)
- Resource management via URI-based persistent storage

### Missing Features to Implement
- **Deck editing tools**: Remove cards from deck, modify quantities, reorder cards
- **Card removal functionality**: `remove_card_from_deck` tool is missing from the architecture

## Development Setup

This is a new project with no existing codebase. The implementation will need:

1. **Language**: TypeScript (based on interfaces in idea.md)
2. **Package Management**: npm/yarn (standard for TypeScript MCP servers)
3. **External Dependencies**: 
   - MCP SDK for TypeScript
   - Scryfall API client
   - Game rules engine
   - Local database (SQLite for game states/decks)

## Common Development Commands

Since this is a new project, these commands will be established during implementation:

```bash
# Install dependencies
npm install

# Build the server
npm run build

# Run tests
npm test

# Run single test
npm test -- --grep "test-name"

# Lint code
npm run lint

# Type checking
npm run typecheck

# Start development server
npm run dev
```

## Project Management

Use the lifecycle-mcp for:
- Requirements gathering and analysis
- Task management and tracking
- Architectural decision records (ADRs)
- Progress monitoring

Use context7 for:
- MTG rules reference documentation
- TypeScript/Node.js API documentation
- MCP protocol specification

## Key Implementation Priorities

1. **MCP Server Foundation**: Basic server setup with STDIO communication
2. **Card Database Integration**: Scryfall API integration with local caching
3. **Deck Management System**: CRUD operations for deck building (including missing edit/remove functionality)
4. **Game Engine Core**: Turn-based gameplay with rules enforcement
5. **AI Opponent Logic**: Decision-making algorithms for computer player
6. **Tutorial System**: Interactive learning modules

## External API Integration

- **Scryfall API**: Primary card database (rate-limited, requires caching)
- **EDHREC API**: Commander format statistics and recommendations  
- **MTGTop8**: Competitive deck lists and meta information

## Security Considerations

- Input validation for card names and game actions
- Rate limiting for external API calls
- Local data storage only (no personal information transmission)
- Sanitization of user search queries

## Testing Strategy

- Unit tests for game rules engine
- Integration tests for API endpoints
- Game state validation tests
- Tutorial flow verification
- AI decision quality testing