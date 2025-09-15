#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import Database from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';

class MemoryGraphServer {
  constructor() {
    this.server = new Server(
      {
        name: 'memory-graph-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupDatabase();
    this.setupHandlers();
  }

  setupDatabase() {
    this.db = new Database.Database(':memory:', (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.error('Memory Graph MCP: SQLite database initialized');
      }
    });

    // Create tables for memory graph
    this.db.serialize(() => {
      // Memories table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          key TEXT UNIQUE NOT NULL,
          content TEXT NOT NULL,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Relationships table for knowledge graph
      this.db.run(`
        CREATE TABLE IF NOT EXISTS relationships (
          id TEXT PRIMARY KEY,
          from_memory_id TEXT NOT NULL,
          to_memory_id TEXT NOT NULL,
          relationship_type TEXT NOT NULL,
          strength REAL DEFAULT 1.0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (from_memory_id) REFERENCES memories (id),
          FOREIGN KEY (to_memory_id) REFERENCES memories (id)
        )
      `);

      // Tags table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          memory_id TEXT NOT NULL,
          tag TEXT NOT NULL,
          FOREIGN KEY (memory_id) REFERENCES memories (id)
        )
      `);

      // Create indexes
      this.db.run('CREATE INDEX IF NOT EXISTS idx_memories_key ON memories (key)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships (from_memory_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships (to_memory_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_tags_memory ON tags (memory_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags (tag)');
    });
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'save_memory',
          description: 'Save a memory with a key and content',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Unique key for the memory' },
              content: { type: 'string', description: 'Content to store' },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional tags for categorization'
              },
              metadata: {
                type: 'object',
                description: 'Optional metadata object'
              }
            },
            required: ['key', 'content']
          }
        },
        {
          name: 'recall_memory',
          description: 'Retrieve a memory by key',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Key of the memory to retrieve' },
              include_related: {
                type: 'boolean',
                description: 'Include related memories',
                default: false
              }
            },
            required: ['key']
          }
        },
        {
          name: 'search_memories',
          description: 'Search memories by content or tags',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags'
              },
              limit: {
                type: 'number',
                description: 'Maximum results to return',
                default: 10
              }
            }
          }
        },
        {
          name: 'link_memories',
          description: 'Create a relationship between two memories',
          inputSchema: {
            type: 'object',
            properties: {
              from_key: { type: 'string', description: 'Source memory key' },
              to_key: { type: 'string', description: 'Target memory key' },
              relationship_type: {
                type: 'string',
                description: 'Type of relationship (e.g., "relates_to", "depends_on", "caused_by")'
              },
              strength: {
                type: 'number',
                description: 'Relationship strength (0.0 to 1.0)',
                default: 1.0
              }
            },
            required: ['from_key', 'to_key', 'relationship_type']
          }
        },
        {
          name: 'get_related_memories',
          description: 'Get memories related to a given memory',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Key of the source memory' },
              relationship_type: {
                type: 'string',
                description: 'Filter by relationship type'
              },
              max_depth: {
                type: 'number',
                description: 'Maximum relationship depth to traverse',
                default: 1
              }
            },
            required: ['key']
          }
        },
        {
          name: 'list_all_memories',
          description: 'List all stored memories',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum results to return',
                default: 50
              },
              offset: {
                type: 'number',
                description: 'Offset for pagination',
                default: 0
              }
            }
          }
        },
        {
          name: 'delete_memory',
          description: 'Delete a memory and its relationships',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Key of the memory to delete' }
            },
            required: ['key']
          }
        },
        {
          name: 'get_memory_stats',
          description: 'Get statistics about the memory graph',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'save_memory':
            return await this.saveMemory(args);
          case 'recall_memory':
            return await this.recallMemory(args);
          case 'search_memories':
            return await this.searchMemories(args);
          case 'link_memories':
            return await this.linkMemories(args);
          case 'get_related_memories':
            return await this.getRelatedMemories(args);
          case 'list_all_memories':
            return await this.listAllMemories(args);
          case 'delete_memory':
            return await this.deleteMemory(args);
          case 'get_memory_stats':
            return await this.getMemoryStats(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ]
        };
      }
    });
  }

  // Tool implementations
  async saveMemory(args) {
    const { key, content, tags = [], metadata = {} } = args;
    const id = uuidv4();
    const metadataJson = JSON.stringify(metadata);

    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO memories (id, key, content, metadata) VALUES (?, ?, ?, ?)',
        [id, key, content, metadataJson],
        function(err) {
          if (err) {
            reject(err);
            return;
          }

          // Save tags
          if (tags.length > 0) {
            const stmt = this.db.prepare('INSERT INTO tags (id, memory_id, tag) VALUES (?, ?, ?)');
            tags.forEach(tag => {
              stmt.run(uuidv4(), id, tag);
            });
            stmt.finalize();
          }

          resolve({
            content: [
              {
                type: 'text',
                text: `Memory saved successfully with key: ${key}`
              }
            ]
          });
        }.bind(this)
      );
    });
  }

  async recallMemory(args) {
    const { key, include_related = false } = args;

    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM memories WHERE key = ?',
        [key],
        async (err, memory) => {
          if (err) {
            reject(err);
            return;
          }

          if (!memory) {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `No memory found with key: ${key}`
                }
              ]
            });
            return;
          }

          let result = {
            key: memory.key,
            content: memory.content,
            metadata: JSON.parse(memory.metadata || '{}'),
            created_at: memory.created_at,
            updated_at: memory.updated_at
          };

          if (include_related) {
            const related = await this.getRelatedMemories({ key });
            result.related_memories = related.content[0].text;
          }

          resolve({
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          });
        }
      );
    });
  }

  async searchMemories(args) {
    const { query, tags = [], limit = 10 } = args;

    let sql = 'SELECT DISTINCT m.* FROM memories m';
    let params = [];
    let conditions = [];

    if (tags.length > 0) {
      sql += ' JOIN tags t ON m.id = t.memory_id';
      conditions.push(`t.tag IN (${tags.map(() => '?').join(', ')})`);
      params.push(...tags);
    }

    if (query) {
      conditions.push('(m.content LIKE ? OR m.key LIKE ?)');
      params.push(`%${query}%`, `%${query}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ` ORDER BY m.updated_at DESC LIMIT ?`;
    params.push(limit);

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, memories) => {
        if (err) {
          reject(err);
          return;
        }

        const results = memories.map(memory => ({
          key: memory.key,
          content: memory.content,
          metadata: JSON.parse(memory.metadata || '{}'),
          created_at: memory.created_at
        }));

        resolve({
          content: [
            {
              type: 'text',
              text: JSON.stringify({ memories: results, total: results.length }, null, 2)
            }
          ]
        });
      });
    });
  }

  async linkMemories(args) {
    const { from_key, to_key, relationship_type, strength = 1.0 } = args;

    return new Promise((resolve, reject) => {
      // First get the memory IDs
      this.db.all(
        'SELECT id, key FROM memories WHERE key IN (?, ?)',
        [from_key, to_key],
        (err, memories) => {
          if (err) {
            reject(err);
            return;
          }

          if (memories.length !== 2) {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `Error: One or both memories not found (${from_key}, ${to_key})`
                }
              ]
            });
            return;
          }

          const fromMemory = memories.find(m => m.key === from_key);
          const toMemory = memories.find(m => m.key === to_key);

          const relationshipId = uuidv4();
          this.db.run(
            'INSERT INTO relationships (id, from_memory_id, to_memory_id, relationship_type, strength) VALUES (?, ?, ?, ?, ?)',
            [relationshipId, fromMemory.id, toMemory.id, relationship_type, strength],
            function(err) {
              if (err) {
                reject(err);
                return;
              }

              resolve({
                content: [
                  {
                    type: 'text',
                    text: `Relationship created: ${from_key} --[${relationship_type}]--> ${to_key}`
                  }
                ]
              });
            }
          );
        }
      );
    });
  }

  async getRelatedMemories(args) {
    const { key, relationship_type, max_depth = 1 } = args;

    return new Promise((resolve, reject) => {
      // Get the source memory ID
      this.db.get(
        'SELECT id FROM memories WHERE key = ?',
        [key],
        (err, memory) => {
          if (err) {
            reject(err);
            return;
          }

          if (!memory) {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `No memory found with key: ${key}`
                }
              ]
            });
            return;
          }

          let sql = `
            SELECT m.key, m.content, r.relationship_type, r.strength
            FROM relationships r
            JOIN memories m ON (r.to_memory_id = m.id OR r.from_memory_id = m.id)
            WHERE (r.from_memory_id = ? OR r.to_memory_id = ?) AND m.id != ?
          `;
          let params = [memory.id, memory.id, memory.id];

          if (relationship_type) {
            sql += ' AND r.relationship_type = ?';
            params.push(relationship_type);
          }

          this.db.all(sql, params, (err, related) => {
            if (err) {
              reject(err);
              return;
            }

            resolve({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ related_memories: related }, null, 2)
                }
              ]
            });
          });
        }
      );
    });
  }

  async listAllMemories(args) {
    const { limit = 50, offset = 0 } = args;

    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT key, content, created_at FROM memories ORDER BY updated_at DESC LIMIT ? OFFSET ?',
        [limit, offset],
        (err, memories) => {
          if (err) {
            reject(err);
            return;
          }

          resolve({
            content: [
              {
                type: 'text',
                text: JSON.stringify({ memories, count: memories.length }, null, 2)
              }
            ]
          });
        }
      );
    });
  }

  async deleteMemory(args) {
    const { key } = args;

    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id FROM memories WHERE key = ?',
        [key],
        (err, memory) => {
          if (err) {
            reject(err);
            return;
          }

          if (!memory) {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `No memory found with key: ${key}`
                }
              ]
            });
            return;
          }

          // Delete relationships
          this.db.run(
            'DELETE FROM relationships WHERE from_memory_id = ? OR to_memory_id = ?',
            [memory.id, memory.id]
          );

          // Delete tags
          this.db.run('DELETE FROM tags WHERE memory_id = ?', [memory.id]);

          // Delete memory
          this.db.run('DELETE FROM memories WHERE id = ?', [memory.id], function(err) {
            if (err) {
              reject(err);
              return;
            }

            resolve({
              content: [
                {
                  type: 'text',
                  text: `Memory deleted: ${key}`
                }
              ]
            });
          });
        }
      );
    });
  }

  async getMemoryStats(args) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT
          (SELECT COUNT(*) FROM memories) as total_memories,
          (SELECT COUNT(*) FROM relationships) as total_relationships,
          (SELECT COUNT(DISTINCT tag) FROM tags) as unique_tags
      `, [], (err, stats) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats[0], null, 2)
            }
          ]
        });
      });
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Memory Graph MCP server running on stdio');
  }
}

const server = new MemoryGraphServer();
server.run().catch(console.error);