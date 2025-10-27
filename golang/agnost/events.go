package agnost

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// EventProcessor processes analytics events in the background
type EventProcessor struct {
	endpoint   string
	orgID      string
	httpClient *http.Client
	config     *AgnostConfig

	queue      chan *EventData
	batchQueue []*EventData
	mu         sync.Mutex
	wg         sync.WaitGroup
	ctx        context.Context
	cancel     context.CancelFunc
}

// NewEventProcessor creates a new event processor
func NewEventProcessor(endpoint string, orgID string, config *AgnostConfig) *EventProcessor {
	ctx, cancel := context.WithCancel(context.Background())

	ep := &EventProcessor{
		endpoint:   endpoint,
		orgID:      orgID,
		httpClient: &http.Client{Timeout: config.RequestTimeout},
		config:     config,
		queue:      make(chan *EventData, 100), // Buffered channel
		batchQueue: make([]*EventData, 0, config.BatchSize),
		ctx:        ctx,
		cancel:     cancel,
	}

	// Start background worker
	ep.wg.Add(1)
	go ep.worker()

	return ep
}

// QueueEvent queues an event for processing
func (ep *EventProcessor) QueueEvent(event *EventData) {
	select {
	case ep.queue <- event:
		Debug("Event queued: %s/%s", event.PrimitiveType, event.PrimitiveName)
	case <-ep.ctx.Done():
		Warning("Event processor shutting down, event dropped")
	default:
		Warning("Event queue full, event dropped: %s/%s", event.PrimitiveType, event.PrimitiveName)
	}
}

// worker processes events from the queue
func (ep *EventProcessor) worker() {
	defer ep.wg.Done()

	ticker := time.NewTicker(5 * time.Second) // Flush batch every 5 seconds
	defer ticker.Stop()

	for {
		select {
		case event := <-ep.queue:
			ep.addToBatch(event)

			// Send batch if it's full
			if len(ep.batchQueue) >= ep.config.BatchSize {
				ep.flushBatch()
			}

		case <-ticker.C:
			// Periodic flush
			if len(ep.batchQueue) > 0 {
				ep.flushBatch()
			}

		case <-ep.ctx.Done():
			// Flush remaining events before shutdown
			if len(ep.batchQueue) > 0 {
				ep.flushBatch()
			}
			return
		}
	}
}

// addToBatch adds an event to the batch queue
func (ep *EventProcessor) addToBatch(event *EventData) {
	ep.mu.Lock()
	defer ep.mu.Unlock()
	ep.batchQueue = append(ep.batchQueue, event)
}

// flushBatch sends the current batch of events
func (ep *EventProcessor) flushBatch() {
	ep.mu.Lock()
	if len(ep.batchQueue) == 0 {
		ep.mu.Unlock()
		return
	}

	// Get current batch and reset
	batch := ep.batchQueue
	ep.batchQueue = make([]*EventData, 0, ep.config.BatchSize)
	ep.mu.Unlock()

	Debug("Flushing batch of %d events", len(batch))

	// Send each event (TODO: implement batch API endpoint)
	for _, event := range batch {
		if err := ep.sendEvent(event); err != nil {
			Warning("Failed to send event: %v", err)
		}
	}
}

// sendEvent sends a single event to the API
func (ep *EventProcessor) sendEvent(event *EventData) error {
	// Marshal to JSON
	jsonData, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %v", err)
	}

	// Create HTTP request
	url := fmt.Sprintf("%s/api/v1/capture-event", ep.endpoint)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create event request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Org-id", ep.orgID)

	// Send request with retries
	var lastErr error
	for attempt := 0; attempt <= ep.config.MaxRetries; attempt++ {
		if attempt > 0 {
			Debug("Retrying event send (attempt %d/%d)", attempt, ep.config.MaxRetries)
			time.Sleep(ep.config.RetryDelay)
		}

		resp, err := ep.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		// Read and close response body
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		// Check status code
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			Debug("Event sent successfully: %s/%s", event.PrimitiveType, event.PrimitiveName)
			return nil
		}

		lastErr = fmt.Errorf("event send failed with status %d: %s", resp.StatusCode, string(body))
	}

	return fmt.Errorf("failed after %d retries: %v", ep.config.MaxRetries, lastErr)
}

// Shutdown gracefully shuts down the event processor
func (ep *EventProcessor) Shutdown() {
	Info("Shutting down event processor...")
	ep.cancel()
	ep.wg.Wait()
	Info("Event processor shut down")
}

// Flush flushes any pending events
func (ep *EventProcessor) Flush() {
	ep.mu.Lock()
	if len(ep.batchQueue) > 0 {
		ep.mu.Unlock()
		ep.flushBatch()
	} else {
		ep.mu.Unlock()
	}
}
