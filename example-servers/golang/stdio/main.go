package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/agnostai/agnost-go/agnost"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func main() {
	// Create MCP server
	s := server.NewMCPServer(
		"Go STDIO Example",
		"1.0.0",
		server.WithToolCapabilities(true),
	)

	// Add tools
	addEchoTool(s)
	addAddTool(s)

	// Enable Agnost Analytics tracking
	err := agnost.Track(s, "da200bda-4d22-424e-a250-eabd0ac3b6ce", &agnost.Config{
		Endpoint:      "http://localhost:8080",
		DisableInput:  false,
		DisableOutput: false,
		LogLevel:      "debug",
	})

	if err != nil {
		log.Printf("Warning: Failed to enable analytics: %v", err)
		log.Println("Continuing without analytics...")
	} else {
		log.Println("✓ Agnost Analytics enabled")
	}

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("\nShutting down...")
		agnost.Shutdown()
		os.Exit(0)
	}()

	// Start STDIO server
	log.Println("Starting MCP STDIO server with Agnost Analytics...")
	if err := server.ServeStdio(s); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

// addEchoTool adds an echo tool
func addEchoTool(s *server.MCPServer) {
	tool := mcp.NewTool("echo",
		mcp.WithDescription("Echo back a message"),
		mcp.WithString("message", mcp.Required(), mcp.Description("Message to echo")),
	)

	handler := func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := request.Params.Arguments.(map[string]any)
		if !ok {
			return mcp.NewToolResultError("Invalid arguments"), nil
		}

		message, _ := args["message"].(string)
		return mcp.NewToolResultText("Echo: " + message), nil
	}

	s.AddTool(tool, handler)
}

// addAddTool adds a calculator tool
func addAddTool(s *server.MCPServer) {
	tool := mcp.NewTool("add",
		mcp.WithDescription("Add two numbers together"),
		mcp.WithNumber("a", mcp.Required(), mcp.Description("First number")),
		mcp.WithNumber("b", mcp.Required(), mcp.Description("Second number")),
	)

	handler := func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := request.Params.Arguments.(map[string]any)
		if !ok {
			return mcp.NewToolResultError("Invalid arguments"), nil
		}

		a, aOk := args["a"].(float64)
		b, bOk := args["b"].(float64)

		if !aOk || !bOk {
			return mcp.NewToolResultError("Both arguments must be numbers"), nil
		}

		result := a + b
		return mcp.NewToolResultText(formatFloat(result)), nil
	}

	s.AddTool(tool, handler)
}

func formatFloat(f float64) string {
	if f == float64(int(f)) {
		return fmt.Sprintf("%d", int(f))
	}
	return fmt.Sprintf("%.2f", f)
}
