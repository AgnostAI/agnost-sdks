// Package agnost provides analytics tracking for MCP servers built with mcp-go
package agnost

import (
	"github.com/mark3labs/mcp-go/server"
)

// Global analytics client instance
var globalClient = NewAgnostAnalytics()

// Config is the configuration for Agnost Analytics
type Config = AgnostConfig

// Track enables analytics tracking for an MCP server by wrapping tool handlers
//
// This function must be called AFTER all tools have been added to the server,
// as it wraps the existing tool handlers to track analytics.
//
// Example:
//
//	s := server.NewMCPServer("my-server", "1.0.0")
//
//	// Add tools first
//	s.AddTool(echoTool, echoHandler)
//	s.AddTool(calcTool, calcHandler)
//
//	// Then enable analytics
//	err := agnost.Track(s, "your-org-id", &agnost.Config{
//	    Endpoint:      "http://localhost:8080",
//	    DisableInput:  false,
//	    DisableOutput: false,
//	    LogLevel:      "info",
//	})
func Track(s *server.MCPServer, orgID string, config *Config) error {
	if config == nil {
		config = DefaultConfig()
	}
	return globalClient.TrackMCP(s, orgID, config)
}

// Shutdown gracefully shuts down the global analytics client
func Shutdown() {
	globalClient.Shutdown()
}
