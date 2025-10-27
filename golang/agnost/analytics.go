package agnost

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/mark3labs/mcp-go/server"
)

// AgnostAnalytics is the main client for Agnost Analytics
type AgnostAnalytics struct {
	config         *AgnostConfig
	orgID          string
	initialized    bool
	overrideApplied bool

	httpClient      *http.Client
	sessionManager  *SessionManager
	eventProcessor  *EventProcessor
	serverAdapter   ServerAdapter

	mu sync.RWMutex
}

// NewAgnostAnalytics creates a new Agnost Analytics client
func NewAgnostAnalytics() *AgnostAnalytics {
	return &AgnostAnalytics{
		initialized: false,
	}
}

// Initialize initializes the SDK with the given configuration
func (a *AgnostAnalytics) Initialize(s *server.MCPServer, orgID string, config *AgnostConfig) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.initialized {
		Debug("SDK already initialized")
		return nil
	}

	// Validate inputs
	if s == nil {
		return fmt.Errorf("server cannot be nil")
	}
	if orgID == "" {
		return fmt.Errorf("organization ID is required")
	}
	if config == nil {
		config = DefaultConfig()
	}

	// Set log level
	SetLogLevel(config.LogLevel)

	Info("Initializing Agnost Analytics SDK - Org ID: %s, Endpoint: %s", orgID, config.Endpoint)

	// Initialize components
	a.config = config
	a.orgID = orgID
	a.httpClient = &http.Client{
		Timeout: config.RequestTimeout,
	}

	// Create server adapter
	a.serverAdapter = NewMCPGoAdapter(s)

	// Create session manager
	a.sessionManager = NewSessionManager(
		config.Endpoint,
		orgID,
		a.httpClient,
		config,
		a.serverAdapter,
	)

	// Create event processor
	a.eventProcessor = NewEventProcessor(
		config.Endpoint,
		orgID,
		config,
	)

	a.initialized = true
	Info("Agnost Analytics SDK initialized successfully")

	return nil
}

// RecordEvent records an analytics event
func (a *AgnostAnalytics) RecordEvent(
	primitiveType string,
	primitiveName string,
	args any,
	latency int64,
	success bool,
	result any,
) error {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if !a.initialized {
		return fmt.Errorf("SDK not initialized")
	}

	// Get session info
	sessionInfo := a.serverAdapter.GetSessionInfo()
	sessionID, err := a.sessionManager.GetOrCreateSession(sessionInfo)
	if err != nil {
		Warning("Failed to get session: %v", err)
		return err
	}

	// Prepare arguments
	var argsJSON string
	if !a.config.DisableInput && args != nil {
		if jsonBytes, err := json.Marshal(args); err == nil {
			argsJSON = string(jsonBytes)
		}
	}

	// Prepare result
	var resultJSON string
	if !a.config.DisableOutput && result != nil {
		if jsonBytes, err := json.Marshal(result); err == nil {
			resultJSON = string(jsonBytes)
		}
	}

	// Create event data
	event := &EventData{
		SessionID:     sessionID,
		PrimitiveType: primitiveType,
		PrimitiveName: primitiveName,
		Latency:       latency,
		Success:       success,
		Input:         argsJSON,
		Output:        resultJSON,
	}

	// Queue event for processing
	if a.config.EnableRequestQueuing {
		a.eventProcessor.QueueEvent(event)
	} else {
		// Send synchronously
		if err := a.eventProcessor.sendEvent(event); err != nil {
			Warning("Failed to send event: %v", err)
			return err
		}
	}

	Debug("Event recorded: %s/%s (success: %v, latency: %dms)", primitiveType, primitiveName, success, latency)
	return nil
}

// analyticsCallback is the callback function for tool execution
func (a *AgnostAnalytics) analyticsCallback(
	toolName string,
	arguments any,
	execTime int64,
	success bool,
	result any,
	startTime time.Time,
) {
	Debug("Recording analytics for tool '%s' - Execution time: %dms, Success: %v", toolName, execTime, success)

	if err := a.RecordEvent("tool", toolName, arguments, execTime, success, result); err != nil {
		Warning("Failed to record event for tool '%s': %v", toolName, err)
	}
}

// TrackMCP enables tracking for an MCP server instance
func (a *AgnostAnalytics) TrackMCP(s *server.MCPServer, orgID string, config *AgnostConfig) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.overrideApplied {
		Debug("Server already tracked")
		return nil
	}

	// Initialize if not already initialized (must be done before using the adapter)
	if !a.initialized {
		a.mu.Unlock() // Unlock before calling Initialize which locks again
		if err := a.Initialize(s, orgID, config); err != nil {
			Error("Failed to initialize analytics: %v", err)
			return err
		}
		a.mu.Lock() // Re-lock after Initialize
	}

	// Patch the server to wrap tool handlers
	if err := a.serverAdapter.PatchServer(a.analyticsCallback); err != nil {
		Error("Failed to patch server: %v", err)
		return err
	}

	a.overrideApplied = true
	Info("MCP server tracking enabled successfully")

	// Create initial session
	go func() {
		sessionInfo := a.serverAdapter.GetSessionInfo()
		if _, err := a.sessionManager.GetOrCreateSession(sessionInfo); err != nil {
			Warning("Failed to create initial session: %v", err)
		}
	}()

	return nil
}

// Shutdown gracefully shuts down the analytics client
func (a *AgnostAnalytics) Shutdown() {
	a.mu.Lock()
	defer a.mu.Unlock()

	if !a.initialized {
		return
	}

	Info("Shutting down Agnost Analytics SDK...")

	// Shutdown event processor
	if a.eventProcessor != nil {
		a.eventProcessor.Shutdown()
	}

	// Clear session manager
	if a.sessionManager != nil {
		a.sessionManager.Clear()
	}

	a.initialized = false
	Info("Agnost Analytics SDK shut down successfully")
}

// IsInitialized returns whether the SDK is initialized
func (a *AgnostAnalytics) IsInitialized() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.initialized
}

// GetConfig returns the current configuration
func (a *AgnostAnalytics) GetConfig() *AgnostConfig {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.config
}
