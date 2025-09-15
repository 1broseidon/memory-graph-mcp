#!/usr/bin/env node

// Simple test to verify the MCP server works
import { spawn } from 'child_process';

console.log('Testing Memory Graph MCP server...');

const server = spawn('node', ['index.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Test list tools
const listToolsRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
};

server.stdin.write(JSON.stringify(listToolsRequest) + '\n');

let responseData = '';
server.stdout.on('data', (data) => {
  responseData += data.toString();
  console.log('Server response:', responseData);

  // Close after getting response
  setTimeout(() => {
    server.kill();
  }, 1000);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});