package agnost

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
)

// SessionManager manages analytics sessions
type SessionManager struct {
	endpoint   string
	orgID      string
	httpClient *http.Client
	config     *AgnostConfig
	adapter    ServerAdapter

	mu       sync.RWMutex
	sessions map[string]string // sessionKey -> sessionID
}

// NewSessionManager creates a new session manager
func NewSessionManager(
	endpoint string,
	orgID string,
	httpClient *http.Client,
	config *AgnostConfig,
	adapter ServerAdapter,
) *SessionManager {
	return &SessionManager{
		endpoint:   endpoint,
		orgID:      orgID,
		httpClient: httpClient,
		config:     config,
		adapter:    adapter,
		sessions:   make(map[string]string),
	}
}

// GetOrCreateSession gets or creates a session for the given session info
func (sm *SessionManager) GetOrCreateSession(sessionInfo *SessionInfo) (string, error) {
	if sessionInfo == nil {
		sessionInfo = &SessionInfo{
			SessionKey: "default",
			ClientName: "unknown",
		}
	}

	// Check if session exists
	sm.mu.RLock()
	sessionID, exists := sm.sessions[sessionInfo.SessionKey]
	sm.mu.RUnlock()

	if exists {
		Debug("Using existing session: %s", sessionID)
		return sessionID, nil
	}

	// Create new session
	sessionID, err := sm.createSession(sessionInfo)
	if err != nil {
		return "", err
	}

	// Store session
	sm.mu.Lock()
	sm.sessions[sessionInfo.SessionKey] = sessionID
	sm.mu.Unlock()

	Info("Created new session: %s (key: %s)", sessionID, sessionInfo.SessionKey)
	return sessionID, nil
}

// createSession creates a new session via API
func (sm *SessionManager) createSession(sessionInfo *SessionInfo) (string, error) {
	// Extract tools from server
	var tools []string
	if sm.adapter != nil {
		tools = sm.adapter.ExtractTools()
	}

	// Get user identity if identify function is provided
	var user UserIdentity
	if sm.config.Identify != nil {
		// Get environment variables
		env := make(map[string]string)
		for _, e := range os.Environ() {
			pair := strings.SplitN(e, "=", 2)
			if len(pair) == 2 {
				env[pair[0]] = pair[1]
			}
		}

		// TODO: Pass actual request when available in HTTP transport
		user = sm.config.Identify(nil, env)
	}

	// Generate session ID
	sessionID := generateSessionID()

	// Prepare session data (matching Python SDK format)
	sessionData := SessionData{
		SessionID:      sessionID,
		ClientConfig:   sessionInfo.ClientName,
		ConnectionType: "",
		IP:             "",
		UserData:       user,
		Tools:          tools,
	}

	// Marshal to JSON
	jsonData, err := json.Marshal(sessionData)
	if err != nil {
		return "", Errorf("failed to marshal session data: %v", err)
	}

	// Create HTTP request
	url := fmt.Sprintf("%s/api/v1/capture-session", sm.endpoint)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", Errorf("failed to create session request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Org-id", sm.orgID)

	// Send request
	Debug("Creating session at %s with payload: %s", url, string(jsonData))
	resp, err := sm.httpClient.Do(req)
	if err != nil {
		return "", Errorf("failed to create session: %v", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", Errorf("failed to read session response: %v", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		Warning("Session creation failed with status %d: %s", resp.StatusCode, string(body))
		// Return session ID anyway - we'll continue tracking events with it
		Debug("Using session ID %s despite creation failure", sessionID)
		return sessionID, nil
	}

	Info("Session created successfully: %s", sessionID)
	// Return the session ID we generated
	return sessionID, nil
}

// Clear clears all cached sessions
func (sm *SessionManager) Clear() {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.sessions = make(map[string]string)
}
