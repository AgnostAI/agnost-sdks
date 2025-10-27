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
- **SDK (Current Repository)**: Client libraries for JavaScript, Python and Golang


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

### Go

```golang
import "github.com/agnostai/agnost-go/agnost"

// With custom configuration
err := agnost.Track(s, "your_org_id", &agnost.Config{
    Endpoint:      "https://api.agnost.ai",
    DisableInput:  false,
    DisableOutput: false,
})
```

#### Go with User Identification

```golang
import (
    "github.com/agnostai/agnost-go/agnost"
    "net/http"
)

// Track with user identification
err := agnost.Track(s, "your-org-id", &agnost.Config{
    Identify: func(req *http.Request, env map[string]string) *agnost.UserIdentity {
        userID := req.Header.Get("x-user-id")
        if userID == "" {
            userID = env["USER_ID"]
        }
        if userID == "" {
            userID = "anonymous"
        }

        return &agnost.UserIdentity{
            UserID: userID,
            Email:  req.Header.Get("x-user-email"),
            Role:   req.Header.Get("x-user-role"),
        }
    },
})
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.
