# Agnost Analytics SDK for Go

[![Go Reference](https://pkg.go.dev/badge/github.com/agnostai/agnost-go.svg)](https://pkg.go.dev/github.com/agnostai/agnost-go)
[![Go Report Card](https://goreportcard.com/badge/github.com/agnostai/agnost-go)](https://goreportcard.com/report/github.com/agnostai/agnost-go)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Track and analyze your [MCP (Model Context Protocol)](https://modelcontextprotocol.io) servers built with [mcp-go](https://github.com/mark3labs/mcp-go) using Agnost Analytics.

## Features

- 🚀 **Simple API**: Just `Track(server, orgID, config)`
- 📊 **Comprehensive Analytics**: Track tool usage, latency, and success rates
- 🔒 **Privacy Controls**: Disable input/output tracking as needed
- ⚡ **High Performance**: Goroutine-based event queuing with minimal overhead
- 🎯 **Type-Safe**: Full Go type safety with compile-time checks
- 👤 **User Identification**: Optional user tracking with custom identify functions

## Installation

```bash
go get github.com/agnostai/agnost-go
```

## Quick Start

```go
package main

import (
    "github.com/agnostai/agnost-go/agnost"
    "github.com/mark3labs/mcp-go/server"
)

func main() {
    // Create your MCP server
    s := server.NewMCPServer("my-server", "1.0.0")

    // Add your tools here...

    // Track with Agnost
    agnost.Track(s, "your-org-id", &agnost.Config{
        DisableInput:  false,
        DisableOutput: false,
        BatchSize:     10,
        LogLevel:      "info",
    })

    // Start server
    server.ServeStdio(s)
}
```

## Usage

### Basic Tracking

```go
agnost.Track(server, "your-org-id", &agnost.Config{
    BatchSize: 10,
    LogLevel:  "info",
})
```

### With User Identification

```go
agnost.Track(server, "your-org-id", &agnost.Config{
    Identify: func(req *http.Request, env map[string]string) *agnost.UserIdentity {
        return &agnost.UserIdentity{
            UserID: env["USER_ID"],
            Email:  env["USER_EMAIL"],
            Role:   env["USER_ROLE"],
        }
    },
})
```

### Privacy Controls

```go
agnost.Track(server, "your-org-id", &agnost.Config{
    DisableInput:  true,  // Don't track input arguments
    DisableOutput: true,  // Don't track output results
})
```

## Configuration

### Config Options

```go
type Config struct {
    // Endpoint is the Agnost Analytics API endpoint
    Endpoint string  // default: "https://api.agnost.ai"

    // Privacy controls
    DisableInput  bool  // default: false
    DisableOutput bool  // default: false

    // Performance settings
    EnableRequestQueuing bool           // default: true
    BatchSize            int            // default: 5
    MaxRetries           int            // default: 3
    RetryDelay           time.Duration  // default: 1s
    RequestTimeout       time.Duration  // default: 5s

    // User identification
    Identify IdentifyFunc  // optional

    // Logging
    LogLevel string  // "debug", "info", "warning", "error" (default: "info")
}
```

### Default Config

Use `nil` to get defaults:

```go
agnost.Track(server, "your-org-id", nil)
```

## Complete Example

```go
package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"

    "github.com/agnostai/agnost-go/agnost"
    "github.com/mark3labs/mcp-go/mcp"
    "github.com/mark3labs/mcp-go/server"
)

func main() {
    // Create MCP server
    s := server.NewMCPServer("example", "1.0.0")

    // Add a tool
    echoTool := mcp.NewTool("echo",
        mcp.WithDescription("Echo a message"),
        mcp.WithString("message", mcp.Required()),
    )

    echoHandler := func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
        args := req.Params.Arguments.(map[string]any)
        msg := args["message"].(string)
        return mcp.NewToolResultText(msg), nil
    }

    s.AddTool(echoTool, echoHandler)

    // Track with Agnost
    err := agnost.Track(s, "your-org-id", &agnost.Config{
        DisableInput:  false,
        DisableOutput: false,
        BatchSize:     10,
        LogLevel:      "info",
        Identify: func(req *http.Request, env map[string]string) *agnost.UserIdentity {
            return &agnost.UserIdentity{
                UserID: env["USER_ID"],
                Email:  env["USER_EMAIL"],
            }
        },
    })

    if err != nil {
        log.Printf("Warning: Analytics disabled: %v", err)
    }

    // Graceful shutdown
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

    go func() {
        <-sigChan
        agnost.Shutdown()
        os.Exit(0)
    }()

    // Start server
    server.ServeStdio(s)
}
```

## API Reference

### Functions

#### `Track(server, orgID, config)`
Enable analytics tracking for an MCP server.

```go
func Track(s *server.MCPServer, orgID string, config *Config) error
```

#### `Shutdown()`
Gracefully shutdown the analytics client (flushes pending events).

```go
func Shutdown()
```

### Types

#### `Config`
Configuration for Agnost Analytics (see Configuration section above)

#### `UserIdentity`
```go
type UserIdentity struct {
    UserID string
    Email  string
    Role   string
}
```

#### `IdentifyFunc`
```go
type IdentifyFunc func(req *http.Request, env map[string]string) *UserIdentity
```

## Examples

See the [examples](./examples) directory for complete examples.

### Running Examples

```bash
cd examples/simple
go run main.go
```

## Performance

- **Goroutine-based queuing**: Non-blocking event recording
- **Batch processing**: Reduces API calls by batching events
- **Automatic retries**: Handles transient failures gracefully
- **Minimal overhead**: Designed for production use

## Development

### Build

```bash
go build ./...
```

### Test

```bash
go test ./...
```

### Format

```bash
go fmt ./...
```

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Support

- **Documentation**: [https://docs.agnost.ai](https://docs.agnost.ai)
- **Issues**: [GitHub Issues](https://github.com/agnostai/agnost-go/issues)
- **Discord**: [Join our community](https://discord.gg/agnost)

## Related Projects

- [mcp-go](https://github.com/mark3labs/mcp-go) - Go implementation of Model Context Protocol
- [Agnost Python SDK](../python) - Python SDK for FastMCP and official MCP
- [Agnost TypeScript SDK](../typescript) - TypeScript SDK for official MCP

## Acknowledgments

Built with ❤️ by the Agnost team. Special thanks to [mark3labs](https://github.com/mark3labs) for the excellent mcp-go library.
