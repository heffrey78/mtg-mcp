# Magic: The Gathering MCP Server

A comprehensive Magic: The Gathering (MTG) MCP server providing card database access, deck building tools, AI-powered gameplay, and interactive tutorials over STDIO.

## 🎯 Project Status

✅ **Foundation Complete** - MCP server foundation implemented and tested  
🎯 **Next**: Card Database Search Tools (TASK-0002-00-00)

### Recent Milestone: TASK-0001-00-00 ✅
- **MCP Server Foundation** with TypeScript and STDIO communication
- **Complete Testing Suite** (23 tests passing)
- **Build & Development Tools** (TypeScript, ESLint, Jest)
- **Error Handling & Logging** framework
- **Project Structure** and documentation

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the server
npm run build

# Start development server
npm run dev

# Type checking
npm run typecheck

# Lint code
npm run lint
```

## 📋 Features (Planned)

### 🃏 Card Database & Research
- Search MTG cards by name, type, mana cost, abilities
- Get comprehensive card information including rulings and legality
- Browse Magic sets and expansions
- Access official rulings and clarifications

### 🧩 Deck Building & Management
- Create and manage MTG decks with format validation
- Add/remove cards with quantity validation and sideboard support
- Analyze deck composition (mana curve, type distribution, synergies)
- AI-powered card recommendations based on strategy and budget
- Import/export decks in various formats

### 🎮 Game State Management
- Full MTG game simulation with turn-based play
- Combat system with attacker/blocker declarations
- Stack management with proper priority handling
- Complete game state tracking (phases, players, battlefield, etc.)

### 🎓 Learning & Tutorial System
- Interactive tutorials for MTG basics and advanced concepts
- Mechanic explanations with examples and rulings
- Play analysis and strategic feedback
- Contextual hints during gameplay

### 🤖 AI Opponent
- Intelligent AI opponent with configurable difficulty
- Multiple deck archetypes (aggro, control, combo, midrange)
- Strategic decision-making with reasoning explanations
- Mulligan decisions based on deck strategy

## 🏗️ Architecture

Built on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) specification:

- **Tools**: Card search, deck management, game actions, tutorials, AI opponent
- **Resources**: Game sessions, deck collections, card database, tutorial progress
- **Prompts**: Deck building assistant, rules tutor, play analyzer, AI opponent

### Tech Stack
- **Language**: TypeScript with strict configuration
- **Runtime**: Node.js 18+
- **Protocol**: MCP over STDIO
- **Testing**: Jest with comprehensive test suite
- **External APIs**: Scryfall, EDHREC, MTGTop8

## 📊 Implementation Progress

| Component | Status | Tasks |
|-----------|--------|-------|
| MCP Server Foundation | ✅ Complete | TASK-0001-00-00 |
| Card Database Tools | 🎯 Next | TASK-0002-00-00 |
| Deck Management | 📋 Planned | TASK-0003-00-00 |
| Rules Engine | 📋 Planned | TASK-0004-00-00 |
| Game State Management | 📋 Planned | TASK-0005-00-00 |
| Testing Framework | ✅ Complete | TASK-0006-00-00 |
| Tutorial System | 📋 Planned | TASK-0007-00-00 |
| AI Opponent | 📋 Planned | TASK-0008-00-00 |

## 🧪 Testing

Comprehensive test suite with:
- **Unit Tests**: Core functionality and utilities
- **Integration Tests**: MCP protocol and external APIs
- **Rules Validation**: MTG game rules and interactions
- **Coverage**: Configured thresholds and reporting

```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
```

## 📖 Documentation

- **[CLAUDE.md](./CLAUDE.md)**: Development guidance for Claude Code
- **[idea.md](./idea.md)**: Complete architecture specification
- **Requirements & ADRs**: Managed via lifecycle-mcp

## 🤝 Contributing

This project uses structured requirements and task management:
- **Requirements**: Managed via lifecycle-mcp
- **Architecture Decisions**: Recorded as ADRs
- **Tasks**: Tracked with clear acceptance criteria
- **Testing**: Required for all new functionality

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🔗 Repository

**GitHub**: [heffrey78/mtg-mcp](https://github.com/heffrey78/mtg-mcp)

---

*🤖 Generated with [Claude Code](https://claude.ai/code)*