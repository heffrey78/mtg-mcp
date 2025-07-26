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

export class MTGMCPServer {
  private server: Server;
  private isRunning = false;

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
            description: 'Search MTG card database by name, type, mana cost, abilities',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Card name, partial name, or keyword' },
                filters: { 
                  type: 'object',
                  properties: {
                    color: { type: 'string' },
                    type: { type: 'string' },
                    cmc: { type: 'number' },
                    set: { type: 'string' },
                    format: { type: 'string' }
                  }
                },
                limit: { type: 'number', default: 20 }
              },
              required: ['query']
            }
          },
          {
            name: 'get_card_details',
            description: 'Get comprehensive information about a specific card',
            inputSchema: {
              type: 'object',
              properties: {
                card_name: { type: 'string', description: 'Name of the card' },
                set_code: { type: 'string', description: 'Optional set code' }
              },
              required: ['card_name']
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
    // TODO: Implement card search functionality
    return {
      content: [
        {
          type: 'text',
          text: 'Card search functionality not yet implemented'
        }
      ]
    };
  }

  private async handleGetCardDetails(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    logger.info('Handling get_card_details', { args });
    // TODO: Implement card details functionality
    return {
      content: [
        {
          type: 'text',
          text: 'Card details functionality not yet implemented'
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