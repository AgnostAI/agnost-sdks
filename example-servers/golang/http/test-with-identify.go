package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/agnostai/agnost-go/agnost"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func main() {
	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "3014"
	}

	// Create MCP server
	s := server.NewMCPServer(
		"Go HTTP Example with Identify",
		"1.0.0",
		server.WithToolCapabilities(true),
	)

	// Add tools
	addEchoTool(s)
	addAddTool(s)

	// Enable Agnost Analytics tracking with Identify function
	err := agnost.Track(s, "efed291c-4173-4c46-9c68-dbf7fa3d4473", &agnost.Config{
		Endpoint:      "http://localhost:8080",
		DisableInput:  false,
		DisableOutput: false,
		LogLevel:      "debug",
		Identify: func(req *http.Request, env map[string]string) agnost.UserIdentity {
			// Extract user info from environment variables
			userID := env["USER_ID"]
			userEmail := env["USER_EMAIL"]

			if userID == "" {
				userID = "anonymous"
			}

			log.Printf("Identify function called - USER_ID: %s, USER_EMAIL: %s", userID, userEmail)

			return agnost.UserIdentity{
				"user_id": userID,
				"email":   userEmail,
				"role":    "developer",
			}
		},
	})

	if err != nil {
		log.Printf("Warning: Failed to enable analytics: %v", err)
		log.Println("Continuing without analytics...")
	} else {
		log.Println("✓ Agnost Analytics enabled with Identify function")
	}

	// Create SSE server
	sseServer := server.NewSSEServer(s)

	// Create HTTP server
	httpServer := &http.Server{
		Addr:         ":" + port,
		Handler:      sseServer,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("\nShutting down server...")

		// Shutdown HTTP server
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := httpServer.Shutdown(ctx); err != nil {
			log.Printf("HTTP server shutdown error: %v", err)
		}

		// Shutdown analytics
		agnost.Shutdown()
		os.Exit(0)
	}()

	// Start HTTP server
	log.Printf("Starting MCP HTTP server with Agnost Analytics on port %s...", port)
	log.Printf("Connect using: http://localhost:%s/sse", port)
	log.Printf("Set USER_ID and USER_EMAIL environment variables to test identify function")

	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
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

		time.Sleep(2 * time.Second) // Simulate processing delay

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
