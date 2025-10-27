# Go MCP HTTP Server Example

A minimal MCP server using HTTP/SSE transport with Agnost Analytics integration.

## Features

- ✅ HTTP/SSE transport (Server-Sent Events)
- ✅ Agnost Analytics integration
- ✅ Two example tools: `echo` and `add`
- ✅ Graceful shutdown handling
- ✅ Configurable port via environment variable

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
go build -o http-server
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
go build -o http-server
```

2. Start the server:
```bash
./http-server
# Or with custom port:
PORT=8000 ./http-server
```

3. Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "go-http-example": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

> **Note**: The server must be running before Claude Desktop connects to it.

4. Restart Claude Desktop

5. Test the tools in Claude:
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

## Environment Variables

- `PORT`: HTTP server port (default: `3000`)

## Troubleshooting

### Server not connecting
- Ensure the HTTP server is running: `curl http://localhost:3000/sse`
- Verify the URL in `claude_desktop_config.json` matches the server port
- Check Claude Desktop logs for connection errors

### Analytics not working
- Verify your Agnost endpoint is running: `curl http://localhost:8080/health`
- Check the server logs for Agnost initialization messages
- Verify your organization ID is correct

### Build errors
- Ensure Go 1.23+ is installed: `go version`
- Run `go mod tidy` to sync dependencies
- Check that the SDK path in `go.mod` is correct

### Port already in use
- Change the port: `PORT=8000 ./http-server`
- Kill the process using the port: `lsof -ti:3000 | xargs kill`

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

## Production Deployment

For production use:

1. Set proper timeouts and limits
2. Add CORS middleware if needed
3. Use HTTPS with proper certificates
4. Configure proper logging and monitoring
5. Set appropriate `LogLevel` (e.g., `"warning"` or `"error"`)
6. Consider enabling `DisableInput`/`DisableOutput` for sensitive data
