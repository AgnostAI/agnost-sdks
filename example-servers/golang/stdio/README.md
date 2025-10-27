# Go MCP STDIO Server Example

A minimal MCP server using STDIO transport with Agnost Analytics integration.

## Features

- ✅ STDIO transport (standard input/output)
- ✅ Agnost Analytics integration
- ✅ Two example tools: `echo` and `add`
- ✅ Graceful shutdown handling

## Prerequisites

- Go 1.23 or higher
- Agnost Analytics endpoint (default: `http://localhost:8080`)

## Setup

1. Install dependencies:
```bash
go mod download
```

2. Build the server:
```bash
go build -o stdio-server
```

## Configuration

Edit `main.go` to configure your organization ID and analytics settings:

```go
err := agnost.Track(s, "YOUR_ORG_ID", &agnost.Config{
    Endpoint:      "http://localhost:8080",  // Your Agnost endpoint
    DisableInput:  false,                     // Set true to disable input tracking
    DisableOutput: false,                     // Set true to disable output tracking
    LogLevel:      "info",                    // debug, info, warning, error
})
```

**Note**: Tools must be added to the server **before** calling `agnost.Track()` so the SDK can properly wrap them for analytics.

## Running Locally & Testing

### Add as MCP Server to Claude Desktop

1. Build the server:
```bash
go build -o stdio-server
```

2. Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "go-stdio-example": {
      "command": "/absolute/path/to/example-servers/golang/stdio/stdio-server"
    }
  }
}
```

3. Restart Claude Desktop

4. Test the tools in Claude:
   - Try: "Use the echo tool to say hello"
   - Try: "Add 5 and 7 using the add tool"

### Verify Analytics

Check your Agnost Analytics dashboard to see:
- Tool invocations
- Execution times
- Success/failure rates
- Input/output data (if not disabled)

## Available Tools

### echo
Echoes back a message.

**Parameters:**
- `message` (string, required): Message to echo

**Example:**
```json
{
  "message": "Hello, World!"
}
```

### add
Adds two numbers together.

**Parameters:**
- `a` (number, required): First number
- `b` (number, required): Second number

**Example:**
```json
{
  "a": 5,
  "b": 7
}
```

## Troubleshooting

### Server not connecting
- Ensure the path in `claude_desktop_config.json` is absolute
- Check that the binary has execute permissions: `chmod +x stdio-server`
- Check Claude Desktop logs for errors

### Analytics not working
- Verify your Agnost endpoint is running: `curl http://localhost:8080/health`
- Check the server logs for Agnost initialization messages
- Verify your organization ID is correct

### Build errors
- Ensure Go 1.23+ is installed: `go version`
- Run `go mod tidy` to sync dependencies
- Check that the SDK path in `go.mod` is correct

## Development

To modify or add tools, edit `main.go` and follow the pattern:

```go
func addMyTool(s *server.MCPServer) {
    tool := mcp.NewTool("my-tool",
        mcp.WithDescription("Description"),
        mcp.WithString("param", mcp.Required(), mcp.Description("Param description")),
    )

    handler := func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
        // Implementation
        return mcp.NewToolResultText("result"), nil
    }

    s.AddTool(tool, handler)
}
```

Then call `addMyTool(s)` in `main()`.
