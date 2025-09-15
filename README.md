# Memory Graph MCP

A lightweight, purpose-built Memory Graph MCP server for persistent AI workspace memory. Designed specifically for the MCP Platform with minimal dependencies and fast deployment.

## Features

- **Persistent Memory Storage**: SQLite-based storage for memories with key-value access
- **Knowledge Graph**: Create relationships between memories with typed connections
- **Tag System**: Organize memories with tags for easy categorization
- **Search & Discovery**: Full-text search across memory content and metadata
- **Relationship Traversal**: Navigate connected memories through relationship paths
- **Lightweight**: No heavy ML dependencies, fast startup and deployment

## MCP Tools

### Core Memory Operations

1. **save_memory** - Store a memory with key, content, tags, and metadata
2. **recall_memory** - Retrieve a memory by key, optionally with related memories
3. **delete_memory** - Remove a memory and all its relationships

### Search & Discovery

4. **search_memories** - Search memories by content or filter by tags
5. **list_all_memories** - List all stored memories with pagination

### Knowledge Graph Features

6. **link_memories** - Create typed relationships between memories
7. **get_related_memories** - Discover memories connected through relationships

### Analytics

8. **get_memory_stats** - Get statistics about total memories, relationships, and tags

## Usage Examples

### Basic Memory Operations

```javascript
// Save a memory
await mcp.callTool('save_memory', {
  key: 'project_requirements',
  content: 'Build a memory system for AI workspace persistence',
  tags: ['project', 'requirements'],
  metadata: { priority: 'high', due_date: '2024-01-15' }
});

// Recall a memory
await mcp.callTool('recall_memory', {
  key: 'project_requirements',
  include_related: true
});

// Search memories
await mcp.callTool('search_memories', {
  query: 'memory system',
  tags: ['project'],
  limit: 10
});
```

### Knowledge Graph Operations

```javascript
// Create relationships
await mcp.callTool('link_memories', {
  from_key: 'project_requirements',
  to_key: 'technical_architecture',
  relationship_type: 'requires',
  strength: 0.9
});

await mcp.callTool('link_memories', {
  from_key: 'technical_architecture',
  to_key: 'implementation_plan',
  relationship_type: 'leads_to',
  strength: 0.8
});

// Discover related memories
await mcp.callTool('get_related_memories', {
  key: 'project_requirements',
  relationship_type: 'requires'
});
```

## Relationship Types

Common relationship types for organizing knowledge:

- `relates_to` - General association
- `depends_on` - Dependency relationship
- `caused_by` - Causal relationship
- `leads_to` - Sequential relationship
- `requires` - Requirement relationship
- `implements` - Implementation relationship
- `references` - Reference relationship

## Data Schema

### Memory Structure
```json
{
  "key": "unique_identifier",
  "content": "The actual memory content",
  "metadata": {
    "custom": "fields",
    "priority": "high"
  },
  "tags": ["tag1", "tag2"],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### Relationship Structure
```json
{
  "from_key": "source_memory",
  "to_key": "target_memory",
  "relationship_type": "relates_to",
  "strength": 0.8
}
```

## Deployment

This MCP server is designed for deployment in the MCP Platform's Kubernetes infrastructure:

- **Lightweight**: Only uses SQLite, uuid, and MCP SDK dependencies
- **Fast Startup**: No compilation or heavy initialization required
- **Memory Efficient**: Uses in-memory SQLite for fast access
- **Container Ready**: Works with standard Node.js containers

## Development

```bash
# Install dependencies
npm install

# Run the server
npm start

# For development with auto-reload
npm run dev
```

## License

MIT