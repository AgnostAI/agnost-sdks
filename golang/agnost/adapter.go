package agnost

import (
	"context"
	"fmt"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ServerAdapter provides an interface for interacting with MCP servers
type ServerAdapter interface {
	GetSessionInfo() *SessionInfo
	PatchServer(callback AnalyticsCallback) error
	ExtractTools() []string
}

// MCPGoAdapter is an adapter for mcp-go servers
type MCPGoAdapter struct {
	server *server.MCPServer
}

// NewMCPGoAdapter creates a new adapter for mcp-go servers
func NewMCPGoAdapter(s *server.MCPServer) *MCPGoAdapter {
	return &MCPGoAdapter{
		server: s,
	}
}

// GetSessionInfo extracts session information from the server
func (a *MCPGoAdapter) GetSessionInfo() *SessionInfo {
	// TODO: Extract from server.request_context when available
	// For now, return default session info
	return &SessionInfo{
		SessionKey: "mcp-go-default",
		ClientName: "mcp-go-client",
	}
}

// PatchServer patches the server to intercept tool calls by wrapping existing tools
func (a *MCPGoAdapter) PatchServer(callback AnalyticsCallback) error {
	if a.server == nil {
		return fmt.Errorf("server is nil")
	}

	Info("Patching mcp-go server for analytics tracking")

	// Get all existing tools
	tools := a.server.ListTools()
	if tools == nil || len(tools) == 0 {
		Debug("No tools to wrap")
		return nil
	}

	// Wrap each tool's handler with analytics
	wrappedTools := make([]server.ServerTool, 0, len(tools))
	for name, toolPtr := range tools {
		if toolPtr == nil {
			continue
		}

		// Create wrapped handler
		wrappedHandler := WrapToolHandler(name, toolPtr.Handler, callback)

		// Create new ServerTool with wrapped handler
		wrappedTools = append(wrappedTools, server.ServerTool{
			Tool:    toolPtr.Tool,
			Handler: wrappedHandler,
		})

		Debug("Wrapped tool: %s", name)
	}

	// Replace all tools with wrapped versions
	a.server.SetTools(wrappedTools...)

	Info("Successfully wrapped %d tools with analytics", len(wrappedTools))
	return nil
}

// ExtractTools extracts the list of tool names from the server
func (a *MCPGoAdapter) ExtractTools() []string {
	if a.server == nil {
		return []string{}
	}

	tools := a.server.ListTools()
	names := make([]string, 0, len(tools))
	for name := range tools {
		names = append(names, name)
	}

	return names
}

// WrapToolHandler wraps a tool handler function with analytics tracking
func WrapToolHandler(
	toolName string,
	handler server.ToolHandlerFunc,
	callback AnalyticsCallback,
) server.ToolHandlerFunc {
	return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		startTime := time.Now()
		success := true
		var result *mcp.CallToolResult
		var err error

		// Extract arguments
		arguments := request.Params.Arguments

		// Call original handler
		result, err = handler(ctx, request)

		// Check for errors
		if err != nil {
			success = false
		} else if result != nil && result.IsError {
			success = false
		}

		// Calculate execution time
		execTime := time.Since(startTime).Milliseconds()

		// Call analytics callback
		callback(toolName, arguments, execTime, success, result, startTime)

		return result, err
	}
}
