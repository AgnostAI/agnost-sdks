# Agnost Analytics SDK (TypeScript)

[![npm version](https://badge.fury.io/js/agnost.svg)](https://badge.fury.io/js/agnost)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Analytics SDK for tracking and analyzing Model Context Protocol (MCP) server interactions.

## Installation

```bash
npm install agnost
```

## Setup Example

```typescript
import { trackMCP, createConfig } from 'agnost';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Create your MCP server instance
const server = new Server(
  {
    name: "my-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Configure analytics
const config = createConfig({
  endpoint: "https://api.agnost.ai",
  disableInput: false,
  disableOutput: false
});

// Enable analytics tracking
const trackedServer = trackMCP(server, "your-organization-id", config);
```

## Configuration Example

```typescript
import { trackMCP, createConfig } from 'agnost';

// Create a custom configuration
const config = createConfig({
  endpoint: "https://api.agnost.ai",
  disableInput: false,   // Set to true to disable input tracking
  disableOutput: false   // Set to true to disable output tracking
});

// Apply the configuration
trackMCP(
  server,
  "your-organization-id",
  config
);
```

## User Identification

The SDK supports user identification to track analytics per user. This is especially useful for understanding usage patterns across different users and roles.

### Basic User Identification

```typescript
import { trackMCP, createConfig } from 'agnost';

// Enable user identification
trackMCP(server, 'your-org-id', {
  // .. other config like disableInput, disableOutput
  identify: (request, env) => ({
    userId: request?.headers?.['x-user-id'] || env?.USER_ID || 'anonymous',
    email: request?.headers?.['x-user-email'] || env?.USER_EMAIL,
    role: request?.headers?.['x-user-role'] || env?.USER_ROLE || 'user'
  })
});
```

### Advanced User Identification

```typescript
import { trackMCP, createConfig } from 'agnost';

// Complex identification logic with async operations
trackMCP(server, 'your-org-id', {
  identify: async (request, env) => {
    try {
      // Extract token from headers
      const token = request?.headers?.['authorization']?.replace('Bearer ', '');
      if (!token) {
        return { userId: 'anonymous' };
      }

      // You could validate token and fetch user info
      // const userInfo = await validateTokenAndGetUser(token);

      // Return user identity with custom fields
      return {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'admin',
        organization: 'acme-corp',
        subscription: 'premium'
      };
    } catch (error) {
      console.warn('User identification failed:', error);
      return { userId: 'anonymous' };
    }
  }
});
```

### User Identity Interface

The identify function should return a `UserIdentity` object or `null`:

```typescript
interface UserIdentity {
  userId: string;        // Required: Unique user identifier
  [key: string]: any;   // Optional: Any additional user properties
}

type IdentifyFunction = (
  request?: any,                              // MCP request object with headers, params, etc.
  env?: Record<string, string | undefined>    // Environment variables (process.env)
) => UserIdentity | null | Promise<UserIdentity | null>;
```

### Identify Function Parameters

- **`request`**: The incoming MCP request object containing:
  - `headers`: HTTP-style headers (e.g., `x-user-id`, `authorization`)
  - `params`: Request parameters including tool name and arguments
  - Other request metadata from the MCP protocol

- **`env`**: Environment variables from `process.env`, useful for:
  - Reading user info from environment variables
  - Accessing configuration secrets
  - Getting deployment-specific user context

### Common Usage Patterns

#### 1. Header-based Identification
```typescript
identify: (request, env) => ({
  userId: request?.headers?.['x-user-id'] || 'anonymous',
  role: request?.headers?.['x-user-role'] || 'user'
})
```

#### 2. Environment Variable Identification
```typescript
identify: (request, env) => ({
  userId: env?.USER_ID || env?.LOGGED_IN_USER || 'anonymous',
  workspace: env?.WORKSPACE_ID
})
```

#### 3. Token-based Identification
```typescript
identify: async (request, env) => {
  const authHeader = request?.headers?.['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const decoded = await decodeJWT(token);
    return {
      userId: decoded.sub,
      email: decoded.email,
      role: decoded.role
    };
  }
  return { userId: 'anonymous' };
}
```

### Important Notes

- The `userId` field is **required** in the returned `UserIdentity` object
- If identification fails, return `null` or `{ userId: 'anonymous' }`
- User identification happens once per session and is cached
- Any errors in the identify function are logged and fallback to anonymous tracking
- Additional fields beyond `userId` are included in analytics for segmentation

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | `string` | `"https://api.agnost.ai"` | API endpoint URL |
| `disableInput` | `boolean` | `false` | Disable tracking of input arguments |
| `disableOutput` | `boolean` | `false` | Disable tracking of output results |
| `identify` | `IdentifyFunction` | `undefined` | Function to identify users from request context |
