# Agnost Go SDK - Usage Guide

## Configuration Methods

The Go SDK provides multiple ways to configure analytics, matching the API patterns from Python and TypeScript SDKs.

### Method 1: Using `agnost.Config` (Direct Initialization)

Similar to Python's `AgnostConfig` and TypeScript's object literal:

```go
import (
    "github.com/agnostai/agnost-go/agnost"
    "github.com/mark3labs/mcp-go/server"
)

func main() {
    s := server.NewMCPServer("my-server", "1.0.0")

    // Direct config initialization
    config := &agnost.Config{
        Endpoint:      "https://api.agnost.ai",
        DisableInput:  false,
        DisableOutput: false,
        BatchSize:     10,
        LogLevel:      "debug",
    }

    agnost.Track(s, "your-org-id", config)
}
```

### Method 2: Using `NewConfig()` (Defaults + Modifications)

Get defaults, then modify specific fields:

```go
config := agnost.NewConfig()
config.DisableInput = true
config.BatchSize = 20
config.LogLevel = "debug"

agnost.Track(s, "your-org-id", config)
```

### Method 3: Using `CreateConfig()` (Merge with Defaults)

Like TypeScript's `createConfig()`:

```go
config := agnost.CreateConfig(&agnost.Config{
    DisableInput: true,
    BatchSize:    15,
    LogLevel:     "debug",
})

agnost.Track(s, "your-org-id", config)
```

### Method 4: Environment Variables

```go
// Reads AGNOST_ORG_ID, AGNOST_ENDPOINT, etc.
agnost.TrackWithEnv(s)
```

## API Comparison

### Python SDK
```python
from agnost import track, config

# Method 1: Direct instantiation
track(server, 'org-id', config(
    disable_input=True,
    batch_size=10
))

# Method 2: Default then modify
cfg = config()
cfg.disable_input = True
track(server, 'org-id', cfg)
```

### TypeScript SDK
```typescript
import { trackMCP, createConfig } from 'agnost';

// Method 1: Object literal
trackMCP(server, 'org-id', {
    disableInput: true,
    batchSize: 10
});

// Method 2: createConfig helper
const config = createConfig({
    disableInput: true,
    batchSize: 10
});
trackMCP(server, 'org-id', config);
```

### Go SDK
```go
import "github.com/agnostai/agnost-go/agnost"

// Method 1: Direct initialization (matches Python/TS)
agnost.Track(s, "org-id", &agnost.Config{
    DisableInput: true,
    BatchSize:    10,
})

// Method 2: NewConfig + modifications
config := agnost.NewConfig()
config.DisableInput = true
config.BatchSize = 10
agnost.Track(s, "org-id", config)

// Method 3: CreateConfig (matches TS createConfig)
config := agnost.CreateConfig(&agnost.Config{
    DisableInput: true,
    BatchSize:    10,
})
agnost.Track(s, "org-id", config)
```

## Configuration Options

All three methods support the same configuration options:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `Endpoint` | `string` | `"https://api.agnost.ai"` | API endpoint |
| `DisableInput` | `bool` | `false` | Disable input tracking |
| `DisableOutput` | `bool` | `false` | Disable output tracking |
| `EnableRequestQueuing` | `bool` | `true` | Enable background queuing |
| `BatchSize` | `int` | `5` | Events per batch |
| `MaxRetries` | `int` | `3` | Retry attempts |
| `RetryDelay` | `time.Duration` | `1s` | Retry delay |
| `RequestTimeout` | `time.Duration` | `5s` | Request timeout |
| `Identify` | `IdentifyFunc` | `nil` | User identification function |
| `LogLevel` | `string` | `"info"` | Log level |

## User Identification

Add user tracking with the `Identify` function:

```go
config := &agnost.Config{
    Identify: func(req *http.Request, env map[string]string) *agnost.UserIdentity {
        return &agnost.UserIdentity{
            UserID: env["USER_ID"],
            Email:  env["USER_EMAIL"],
            Role:   env["USER_ROLE"],
        }
    },
}
```

## Complete Example

```go
package main

import (
    "context"
    "log"
    "net/http"

    "github.com/agnostai/agnost-go/agnost"
    "github.com/mark3labs/mcp-go/mcp"
    "github.com/mark3labs/mcp-go/server"
)

func main() {
    // Create server
    s := server.NewMCPServer("example", "1.0.0")

    // Add tools
    tool := mcp.NewTool("echo",
        mcp.WithDescription("Echo a message"),
        mcp.WithString("msg", mcp.Required()),
    )

    handler := func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
        args := req.Params.Arguments.(map[string]any)
        msg := args["msg"].(string)
        return mcp.NewToolResultText(msg), nil
    }

    s.AddTool(tool, handler)

    // Configure analytics (choose one method)

    // Option 1: Direct config
    config1 := &agnost.Config{
        DisableInput: false,
        BatchSize:    10,
        Identify: func(req *http.Request, env map[string]string) *agnost.UserIdentity {
            return &agnost.UserIdentity{
                UserID: env["USER_ID"],
                Email:  env["USER_EMAIL"],
            }
        },
    }

    // Option 2: NewConfig + modify
    config2 := agnost.NewConfig()
    config2.DisableInput = true

    // Option 3: CreateConfig
    config3 := agnost.CreateConfig(&agnost.Config{
        DisableInput: true,
        BatchSize:    15,
    })

    // Track with any config
    if err := agnost.Track(s, "your-org-id", config1); err != nil {
        log.Fatal(err)
    }

    // Start server
    server.ServeStdio(s)
}
```

## Best Practices

1. **Use environment variables for production**: `TrackWithEnv()` is safest
2. **Use direct initialization for simple cases**: `&agnost.Config{...}` is concise
3. **Use `CreateConfig()` when merging**: Good for partial overrides
4. **Always call `Shutdown()`**: Ensures events are flushed before exit

## FAQ

**Q: Which method should I use?**

A: For most cases, use direct initialization (`&agnost.Config{...}`). It's concise and idiomatic in Go.

**Q: How does this compare to Python/TypeScript?**

A: The APIs are very similar:
- Python: `config(disable_input=True)`
- TypeScript: `{disableInput: true}`
- Go: `&Config{DisableInput: true}`

**Q: Can I use nil for config?**

A: Yes! `agnost.Track(s, orgID, nil)` will use defaults.
