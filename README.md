# Agnost AI

Analytics SDK for Model Context Protocol Servers. This tool provides a comprehensive solution for tracking and analyzing usage of AI models and LLM calls within your applications.

## Features

- Track usage of various AI models and tools
- Capture performance metrics like latency and success rates
- Visualize analytics through a React dashboard
- Advanced analytics with Grafana
- SDK integrations for JavaScript and Python
- Optimized storage with ClickHouse

## Architecture

The system consists of several components:

- **Backend**: Go service that handles API requests and data processing
- **Databases**: ClickHouse for analytics data
- **Dashboard**: React-based admin UI
- **Grafana**: Pre-built dashboards for advanced analytics (in progress)
- **SDKs**: Client libraries for JavaScript and Python

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 16+ (for local development)
- Go 1.18+ (for local development)

### Setup

1. Clone the repository
   ```
   git clone https://github.com/AgnostAI/agnostai.git
   cd agnostai
   ```

2. Configure environment variables
   ```
   cp backend/.env.example backend/.env
   cp dashboard/.env.example dashboard/.env
   ```

3. Start the services
   ```
   docker-compose up -d
   ```

4. Access the dashboard at `http://localhost:3000`

## SDK Usage

### TypeScript

```typescript
import { trackMCP } from 'agnost';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Your existing server
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

// Add all your tools and resources to the server...

// One line to add analytics
trackMCP(server, "YOUR_ORGANIZATION_ID");
```

#### TypeScript with User Identification

```typescript
import { trackMCP } from 'agnost';

// Track with user identification
trackMCP(server, 'YOUR_ORGANIZATION_ID', {
  identify: (request, env) => ({
    userId: request?.headers?.['x-user-id'] || env?.USER_ID || 'anonymous',
    email: request?.headers?.['x-user-email'] || env?.USER_EMAIL,
    role: request?.headers?.['x-user-role'] || env?.USER_ROLE || 'user'
  })
});
```

### Python

```python
from mcp.server import FastMCP
from agnost import track

# Your existing server
server = FastMCP()

# Add all your tools and resources to the server...

# One line to add analytics
track(server, "YOUR_ORGANIZATION_ID")
```

#### Python with User Identification

```python
from agnost import track, config

# Track with user identification
track(server, 'YOUR_ORGANIZATION_ID', config(
    identify=lambda req, env: {
        'userId': req.get('headers', {}).get('x-user-id') or env.get('USER_ID') or 'anonymous',
        'email': req.get('headers', {}).get('x-user-email') or env.get('USER_EMAIL'),
        'role': req.get('headers', {}).get('x-user-role') or env.get('USER_ROLE', 'user')
    }
))
```

## API Endpoints

### SDK API Endpoints

- `POST /api/v1/capture-session` - Start a new session
- `POST /api/v1/capture-event` - Record an event

### Dashboard API Endpoints

- `GET /dashboard/api/profile` - Get user profile
- `GET /dashboard/api/organizations` - Get user organizations
- `POST /dashboard/api/create-organization` - Create a new organization
- `POST /dashboard/api/add-user-to-organization` - Add a user to an organization
- `POST /dashboard/api/generate-api-key` - Generate a new API key
- `GET /dashboard/api/dashboard` - Get dashboard metrics
- `GET /dashboard/api/user-stories` - Get user session stories
- `GET /dashboard/api/tool-stats` - Get tool usage statistics
- `GET /dashboard/api/errors` - Get error statistics

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.
