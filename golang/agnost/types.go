package agnost

import (
	"net/http"
	"time"
)

// UserIdentity represents user identification information as a flexible map
// The map must contain a "user_id" key at minimum
type UserIdentity map[string]interface{}

// IdentifyFunc is a function that extracts user identity from request and environment
type IdentifyFunc func(req *http.Request, env map[string]string) UserIdentity

// AgnostConfig represents configuration for Agnost Analytics
type AgnostConfig struct {
	// Endpoint is the URL of the Agnost Analytics API
	Endpoint string

	// DisableInput disables tracking of input arguments
	DisableInput bool

	// DisableOutput disables tracking of output results
	DisableOutput bool

	// EnableRequestQueuing enables background event queuing
	EnableRequestQueuing bool

	// BatchSize is the number of events to batch before sending
	BatchSize int

	// MaxRetries is the maximum number of retry attempts for failed requests
	MaxRetries int

	// RetryDelay is the delay between retry attempts
	RetryDelay time.Duration

	// RequestTimeout is the timeout for HTTP requests
	RequestTimeout time.Duration

	// Identify is a function to extract user identity
	Identify IdentifyFunc

	// LogLevel sets the logging level (debug, info, warning, error)
	LogLevel string
}

// DefaultConfig returns a default configuration
func DefaultConfig() *AgnostConfig {
	return &AgnostConfig{
		Endpoint:             "https://api.agnost.ai",
		DisableInput:         false,
		DisableOutput:        false,
		EnableRequestQueuing: true,
		BatchSize:            5,
		MaxRetries:           3,
		RetryDelay:           1 * time.Second,
		RequestTimeout:       5 * time.Second,
		LogLevel:             "info",
	}
}

// SessionInfo represents session information from the server
type SessionInfo struct {
	SessionKey string
	ClientName string
}

// SessionData represents a session in the analytics system
type SessionData struct {
	SessionID      string       `json:"session_id"`
	ClientConfig   string       `json:"client_config"`
	ConnectionType string       `json:"connection_type"`
	IP             string       `json:"ip"`
	Tools          []string     `json:"tools,omitempty"`
	UserData       UserIdentity `json:"user_data,omitempty"`
}

// SessionResponse represents the response from creating a session
type SessionResponse struct {
	SessionID string `json:"session_id"`
}

// EventData represents an analytics event
type EventData struct {
	SessionID     string `json:"session_id"`
	PrimitiveType string `json:"primitive_type"`
	PrimitiveName string `json:"primitive_name"`
	Latency       int64  `json:"latency"`
	Success       bool   `json:"success"`
	Input         string `json:"args,omitempty"`
	Output        string `json:"result,omitempty"`
}

// EventResponse represents the response from recording an event
type EventResponse struct {
	Success bool   `json:"success"`
	EventID string `json:"event_id,omitempty"`
}

// AnalyticsCallback is a callback function for recording tool execution
type AnalyticsCallback func(
	toolName string,
	arguments any,
	execTime int64,
	success bool,
	result any,
	startTime time.Time,
)
