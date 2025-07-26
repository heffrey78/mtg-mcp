import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from './utils/logger.js';
import { handleError } from './utils/errors.js';
import { CardSearchTool, SetSearchTool, RulingsTool, DeckManagementTool } from './tools/index.js';

export class MTGMCPServer {
  private server: Server;
  private isRunning = false;
  private cardSearchTool: CardSearchTool;
  private setSearchTool: SetSearchTool;
  private rulingsTool: RulingsTool;
  private deckTool: DeckManagementTool;

  constructor() {
    this.server = new Server(
      {
        name: 'mtg-stdio-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    // Initialize tools
    this.cardSearchTool = new CardSearchTool();
    this.setSearchTool = new SetSearchTool();
    this.rulingsTool = new RulingsTool();
    this.deckTool = new DeckManagementTool();

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Tools handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.info('Received list_tools request');
      return {
        tools: [
          {
            name: 'search_cards',
            description: 'Search MTG card database by name, type, mana cost, abilities, and other criteria',
            inputSchema: {
              type: 'object',
              properties: {
                query: { 
                  type: 'string', 
                  description: 'Card name, partial name, or search query' 
                },
                filters: { 
                  type: 'object',
                  properties: {
                    colors: { 
                      type: 'array', 
                      items: { type: 'string' },
                      description: 'Card colors (W, U, B, R, G)' 
                    },
                    color_identity: { 
                      type: 'array', 
                      items: { type: 'string' },
                      description: 'Commander color identity' 
                    },
                    type: { type: 'string', description: 'Card type (creature, instant, etc.)' },
                    set: { type: 'string', description: 'Set code' },
                    rarity: { type: 'string', description: 'Card rarity (common, uncommon, rare, mythic)' },
                    cmc: { type: 'number', description: 'Converted mana cost' },
                    power: { type: 'string', description: 'Creature power' },
                    toughness: { type: 'string', description: 'Creature toughness' },
                    format: { type: 'string', description: 'Format for legality check' },
                    is_legal: { type: 'boolean', description: 'Whether card should be legal in format' }
                  }
                },
                limit: { type: 'number', default: 20, description: 'Maximum number of results' }
              },
              required: ['query']
            }
          },
          {
            name: 'get_card_details',
            description: 'Get comprehensive information about a specific MTG card',
            inputSchema: {
              type: 'object',
              properties: {
                card_name: { 
                  type: 'string', 
                  description: 'Name of the card (exact or fuzzy match)' 
                },
                set_code: { 
                  type: 'string', 
                  description: 'Optional set code for specific printing' 
                }
              },
              required: ['card_name']
            }
          },
          {
            name: 'search_sets',
            description: 'Search MTG sets and expansions by name, type, or other criteria',
            inputSchema: {
              type: 'object',
              properties: {
                query: { 
                  type: 'string', 
                  description: 'Set name, code, or block name to search for' 
                },
                set_type: { 
                  type: 'string', 
                  description: 'Type of set (core, expansion, masters, etc.)' 
                },
                block: { 
                  type: 'string', 
                  description: 'Block name' 
                },
                digital: { 
                  type: 'boolean', 
                  description: 'Whether set is digital-only' 
                },
                foil_only: { 
                  type: 'boolean', 
                  description: 'Whether set is foil-only' 
                },
                limit: { 
                  type: 'number', 
                  default: 50, 
                  description: 'Maximum number of results' 
                }
              }
            }
          },
          {
            name: 'get_rulings',
            description: 'Get official rulings and clarifications for a specific MTG card',
            inputSchema: {
              type: 'object',
              properties: {
                card_name: { 
                  type: 'string', 
                  description: 'Name of the card to get rulings for' 
                },
                card_id: { 
                  type: 'string', 
                  description: 'Scryfall card ID' 
                },
                oracle_id: { 
                  type: 'string', 
                  description: 'Scryfall oracle ID' 
                }
              },
              oneOf: [
                { required: ['card_name'] },
                { required: ['card_id'] },
                { required: ['oracle_id'] }
              ]
            }
          },
          {
            name: 'create_deck',
            description: 'Create a new MTG deck with specified format and colors',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Name of the deck' },
                format: { type: 'string', description: 'Deck format (standard, modern, commander, etc.)' },
                colors: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Color identity (W, U, B, R, G)' 
                },
                description: { type: 'string', description: 'Optional deck description' },
                author: { type: 'string', description: 'Optional deck author' }
              },
              required: ['name', 'format']
            }
          },
          {
            name: 'add_card_to_deck',
            description: 'Add cards to a deck (mainboard or sideboard)',
            inputSchema: {
              type: 'object',
              properties: {
                deck_id: { type: 'string', description: 'ID of the deck' },
                card_name: { type: 'string', description: 'Name of the card to add' },
                quantity: { type: 'number', default: 1, description: 'Number of copies to add' },
                set_code: { type: 'string', description: 'Optional specific set code' },
                board: { 
                  type: 'string', 
                  enum: ['mainboard', 'sideboard'], 
                  default: 'mainboard',
                  description: 'Which board to add to' 
                }
              },
              required: ['deck_id', 'card_name']
            }
          },
          {
            name: 'remove_card_from_deck',
            description: 'Remove cards from a deck',
            inputSchema: {
              type: 'object',
              properties: {
                deck_id: { type: 'string', description: 'ID of the deck' },
                card_name: { type: 'string', description: 'Name of the card to remove' },
                quantity: { type: 'number', default: 1, description: 'Number of copies to remove' },
                set_code: { type: 'string', description: 'Optional specific set code' },
                board: { 
                  type: 'string', 
                  enum: ['mainboard', 'sideboard'], 
                  default: 'mainboard',
                  description: 'Which board to remove from' 
                }
              },
              required: ['deck_id', 'card_name']
            }
          },
          {
            name: 'update_card_quantity',
            description: 'Update the quantity of a specific card in a deck',
            inputSchema: {
              type: 'object',
              properties: {
                deck_id: { type: 'string', description: 'ID of the deck' },
                card_name: { type: 'string', description: 'Name of the card to update' },
                new_quantity: { type: 'number', description: 'New quantity (0 to remove)' },
                set_code: { type: 'string', description: 'Optional specific set code' },
                board: { 
                  type: 'string', 
                  enum: ['mainboard', 'sideboard'], 
                  default: 'mainboard',
                  description: 'Which board to update' 
                }
              },
              required: ['deck_id', 'card_name', 'new_quantity']
            }
          },
          {
            name: 'get_deck_details',
            description: 'Get comprehensive deck information and statistics',
            inputSchema: {
              type: 'object',
              properties: {
                deck_id: { type: 'string', description: 'ID of the deck' }
              },
              required: ['deck_id']
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      logger.info('Received call_tool request', { tool: request.params.name });
      
      try {
        const { name, arguments: args } = request.params;
        
        switch (name) {
          case 'search_cards':
            return await this.handleSearchCards(args);
          case 'get_card_details':
            return await this.handleGetCardDetails(args);
          case 'search_sets':
            return await this.handleSearchSets(args);
          case 'get_rulings':
            return await this.handleGetRulings(args);
          case 'create_deck':
            return await this.handleCreateDeck(args);
          case 'add_card_to_deck':
            return await this.handleAddCardToDeck(args);
          case 'remove_card_from_deck':
            return await this.handleRemoveCardFromDeck(args);
          case 'update_card_quantity':
            return await this.handleUpdateCardQuantity(args);
          case 'get_deck_details':
            return await this.handleGetDeckDetails(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error('Tool execution failed', { error, tool: request.params.name });
        return {
          content: [handleError(error)]
        };
      }
    });

    // Resources handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      logger.info('Received list_resources request');
      return {
        resources: []
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      logger.info('Received read_resource request', { uri: request.params.uri });
      throw new Error('Resource reading not yet implemented');
    });

    // Prompts handlers
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      logger.info('Received list_prompts request');
      return {
        prompts: []
      };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      logger.info('Received get_prompt request', { name: request.params.name });
      throw new Error('Prompt handling not yet implemented');
    });
  }

  private async handleSearchCards(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    logger.info('Handling search_cards', { args });
    
    const request = args as any;
    const result = await this.cardSearchTool.searchCards(request);
    
    // Format response for MCP
    const summary = `Found ${result.total_found} cards matching "${result.query_used}"`;
    const cardsList = result.cards.map(card => {
      const colors = card.colors.length > 0 ? ` (${card.colors.join('')})` : '';
      const manaCost = card.mana_cost ? ` ${card.mana_cost}` : '';
      const ptText = card.power && card.toughness ? ` ${card.power}/${card.toughness}` : '';
      return `• **${card.name}**${manaCost}${colors} - ${card.type_line}${ptText} [${card.set.toUpperCase()}]`;
    }).join('\n');
    
    const cacheInfo = result.cache_info ? `\n\nCache: Memory ${result.cache_info.cache_stats.memory.keys} keys, File ${result.cache_info.cache_stats.file?.totalFiles || 0} files` : '';
    
    return {
      content: [
        {
          type: 'text',
          text: `${summary}\n\n${cardsList}${cacheInfo}`
        }
      ]
    };
  }

  private async handleGetCardDetails(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    logger.info('Handling get_card_details', { args });
    
    const request = args as any;
    const card = await this.cardSearchTool.getCardDetails(request.card_name, request.set_code);
    
    // Format detailed card information
    const manaCost = card.mana_cost ? `**Mana Cost:** ${card.mana_cost}\n` : '';
    const colors = card.colors.length > 0 ? `**Colors:** ${card.colors.join(', ')}\n` : '';
    const colorIdentity = card.color_identity.length > 0 ? `**Color Identity:** ${card.color_identity.join(', ')}\n` : '';
    const pt = card.power && card.toughness ? `**Power/Toughness:** ${card.power}/${card.toughness}\n` : '';
    const oracleText = card.oracle_text ? `**Oracle Text:**\n${card.oracle_text}\n\n` : '';
    
    // Format legalities
    const legalFormats = Object.entries(card.legalities)
      .filter(([, status]) => status === 'legal')
      .map(([format]) => format)
      .join(', ');
    const legalities = legalFormats ? `**Legal in:** ${legalFormats}\n` : '';
    
    const cardInfo = `**${card.name}** [${card.set.toUpperCase()}]\n` +
                    `${manaCost}` +
                    `**CMC:** ${card.cmc}\n` +
                    `**Type:** ${card.type_line}\n` +
                    `${colors}${colorIdentity}${pt}` +
                    `**Rarity:** ${card.rarity}\n` +
                    `**Set:** ${card.set_name}\n` +
                    `${legalities}\n` +
                    `${oracleText}` +
                    `**Scryfall ID:** ${card.id}`;
    
    return {
      content: [
        {
          type: 'text',
          text: cardInfo
        }
      ]
    };
  }

  private async handleSearchSets(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    logger.info('Handling search_sets', { args });
    
    const request = args as any;
    const result = await this.setSearchTool.searchSets(request);
    
    const summary = `Found ${result.total_found} sets`;
    const setsList = result.sets.map(set => {
      const released = set.released_at ? ` (${set.released_at})` : '';
      const cardCount = ` - ${set.card_count} cards`;
      const digital = set.digital ? ' [Digital]' : '';
      const foilOnly = set.foil_only ? ' [Foil Only]' : '';
      return `• **${set.name}** [${set.code.toUpperCase()}]${released}${cardCount}${digital}${foilOnly}`;
    }).join('\n');
    
    return {
      content: [
        {
          type: 'text',
          text: `${summary}\n\n${setsList}`
        }
      ]
    };
  }

  private async handleGetRulings(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    logger.info('Handling get_rulings', { args });
    
    const request = args as any;
    const result = await this.rulingsTool.getRulings(request);
    
    const summary = `**Rulings for ${result.card_info.name}**\n` +
                   `Found ${result.total_rulings} official rulings\n\n`;
    
    const rulingsList = result.rulings.length > 0 
      ? result.rulings.map(ruling => {
          return `**${ruling.published_at}** (${ruling.source}):\n${ruling.comment}\n`;
        }).join('\n')
      : 'No official rulings found for this card.';
    
    return {
      content: [
        {
          type: 'text',
          text: `${summary}${rulingsList}`
        }
      ]
    };
  }

  private async handleCreateDeck(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    logger.info('Handling create_deck', { args });
    
    const request = args as any;
    const result = await this.deckTool.createDeck(request);
    
    if ('error' in result) {
      throw new Error(result.error.message);
    }
    
    const deck = result.deck;
    let deckInfo = `**Deck Created Successfully**\n\n` +
                    `**ID:** ${deck.id}\n` +
                    `**Name:** ${deck.name}\n` +
                    `**Format:** ${deck.format}\n` +
                    `**Colors:** ${deck.colors.join(', ') || 'Colorless'}\n` +
                    `**Created:** ${deck.created_at}\n` +
                    `**Mainboard:** ${deck.mainboard.length} cards\n` +
                    `**Sideboard:** ${deck.sideboard.length} cards`;
    
    if (deck.metadata?.description) {
      deckInfo += `\n**Description:** ${deck.metadata.description}`;
    }
    if (deck.metadata?.author) {
      deckInfo += `\n**Author:** ${deck.metadata.author}`;
    }
    
    return {
      content: [
        {
          type: 'text',
          text: deckInfo
        }
      ]
    };
  }

  private async handleAddCardToDeck(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    logger.info('Handling add_card_to_deck', { args });
    
    const request = args as any;
    const result = await this.deckTool.addCardToDeck(request);
    
    if ('error' in result) {
      throw new Error(result.error.message);
    }
    
    const card = result.card_added.card;
    const quantity = result.card_added.quantity;
    const board = request.board || 'mainboard';
    
    const cardInfo = `**Card Added Successfully**\n\n` +
                    `**Card:** ${card.name}\n` +
                    `**Quantity:** ${quantity}\n` +
                    `**Board:** ${board}\n` +
                    `**Mana Cost:** ${card.mana_cost || 'N/A'}\n` +
                    `**Type:** ${card.type_line}\n` +
                    `**Set:** ${card.set_name} [${card.set.toUpperCase()}]`;
    
    return {
      content: [
        {
          type: 'text',
          text: cardInfo
        }
      ]
    };
  }

  private async handleRemoveCardFromDeck(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    logger.info('Handling remove_card_from_deck', { args });
    
    const request = args as any;
    const result = await this.deckTool.removeCardFromDeck(request);
    
    if ('error' in result) {
      throw new Error(result.error.message);
    }
    
    const board = request.board || 'mainboard';
    const removeInfo = `**Card Removed Successfully**\n\n` +
                      `**Card:** ${request.card_name}\n` +
                      `**Removed:** ${result.cards_removed} copies\n` +
                      `**From:** ${board}`;
    
    return {
      content: [
        {
          type: 'text',
          text: removeInfo
        }
      ]
    };
  }

  private async handleUpdateCardQuantity(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    logger.info('Handling update_card_quantity', { args });
    
    const request = args as any;
    const result = await this.deckTool.updateCardQuantity(request);
    
    if ('error' in result) {
      throw new Error(result.error.message);
    }
    
    const board = request.board || 'mainboard';
    const updateInfo = `**Card Quantity Updated**\n\n` +
                      `**Card:** ${request.card_name}\n` +
                      `**New Quantity:** ${request.new_quantity}\n` +
                      `**Board:** ${board}`;
    
    return {
      content: [
        {
          type: 'text',
          text: updateInfo
        }
      ]
    };
  }

  private async handleGetDeckDetails(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    logger.info('Handling get_deck_details', { args });
    
    const request = args as any;
    const result = await this.deckTool.getDeckDetails(request);
    
    if ('error' in result) {
      throw new Error(result.error.message);
    }
    
    const deck = result.deck;
    const stats = result.statistics;
    
    // Basic deck info
    let deckInfo = `**${deck.name}** [${deck.id}]\n` +
                  `**Format:** ${deck.format}\n` +
                  `**Colors:** ${deck.colors.join(', ') || 'Colorless'}\n` +
                  `**Created:** ${deck.created_at}\n` +
                  `**Updated:** ${deck.updated_at}\n\n`;
    
    // Statistics
    deckInfo += `**Deck Statistics**\n` +
               `• Total Cards: ${stats.total_cards}\n` +
               `• Mainboard: ${stats.mainboard_count}\n` +
               `• Sideboard: ${stats.sideboard_count}\n` +
               `• Average CMC: ${stats.average_cmc}\n\n`;
    
    // Color distribution
    if (Object.keys(stats.color_distribution).length > 0) {
      const colorCounts = Object.entries(stats.color_distribution)
        .map(([color, count]) => `${color}: ${count}`)
        .join(', ');
      deckInfo += `**Color Distribution:** ${colorCounts}\n\n`;
    }
    
    // Type distribution
    if (Object.keys(stats.type_distribution).length > 0) {
      const typeCounts = Object.entries(stats.type_distribution)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');
      deckInfo += `**Type Distribution:** ${typeCounts}\n\n`;
    }
    
    // Card lists
    if (deck.mainboard.length > 0) {
      deckInfo += `**Mainboard (${stats.mainboard_count} cards):**\n`;
      deck.mainboard.forEach(dc => {
        const manaCost = dc.card.mana_cost ? ` ${dc.card.mana_cost}` : '';
        deckInfo += `• ${dc.quantity}x ${dc.card.name}${manaCost}\n`;
      });
      deckInfo += '\n';
    }
    
    if (deck.sideboard.length > 0) {
      deckInfo += `**Sideboard (${stats.sideboard_count} cards):**\n`;
      deck.sideboard.forEach(dc => {
        const manaCost = dc.card.mana_cost ? ` ${dc.card.mana_cost}` : '';
        deckInfo += `• ${dc.quantity}x ${dc.card.name}${manaCost}\n`;
      });
    }
    
    return {
      content: [
        {
          type: 'text',
          text: deckInfo
        }
      ]
    };
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Server is already running');
      return;
    }

    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.isRunning = true;
      logger.info('MTG MCP Server started successfully');
    } catch (error) {
      logger.error('Failed to start server', { error });
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Server is not running');
      return;
    }

    try {
      // Cleanup tools
      await this.cardSearchTool.cleanup();
      await this.setSearchTool.cleanup();
      await this.rulingsTool.cleanup();
      
      await this.server.close();
      this.isRunning = false;
      logger.info('MTG MCP Server stopped successfully');
    } catch (error) {
      logger.error('Failed to stop server', { error });
      throw error;
    }
  }

  public isServerRunning(): boolean {
    return this.isRunning;
  }
}