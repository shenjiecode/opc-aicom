package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/opc-aicom/backend/pkg/config"
)

// QoderAccount represents a Qoder account
type QoderAccount struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	PlanID    string    `json:"plan_id"`
}

// AccountStatus represents the status of a Qoder account
type AccountStatus struct {
	AccountID     string    `json:"account_id"`
	Status        string    `json:"status"`
	PlanID        string    `json:"plan_id"`
	PlanName      string    `json:"plan_name"`
	CreditsUsed   int       `json:"credits_used"`
	CreditsLimit  int       `json:"credits_limit"`
	ExpiresAt     time.Time `json:"expires_at"`
	LastActiveAt  time.Time `json:"last_active_at"`
}

// QoderService provides integration with Qoder AI API
type QoderService struct {
	client      *http.Client
	config      *config.QoderConfig
	maxRetries  int
	baseBackoff time.Duration
}

// NewQoderService creates a new Qoder service instance
func NewQoderService(cfg *config.QoderConfig) *QoderService {
	if cfg == nil {
		cfg = &config.QoderConfig{
			BaseURL: "https://api.qoder.ai",
		}
	}

	return &QoderService{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		config:      cfg,
		maxRetries:  3,
		baseBackoff: 100 * time.Millisecond,
	}
}

// CreateAccount creates a new Qoder account with the given email
func (s *QoderService) CreateAccount(ctx context.Context, email string) (*QoderAccount, error) {
	if email == "" {
		return nil, fmt.Errorf("email is required")
	}

	reqBody := map[string]string{
		"email":   email,
		"plan_id": s.config.MonthlyPlanID,
	}

	var account QoderAccount
	err := s.doRequestWithRetry(ctx, "POST", "/accounts", reqBody, &account)
	if err != nil {
		return nil, fmt.Errorf("failed to create account: %w", err)
	}

	return &account, nil
}

// GetAccountStatus retrieves the status of a Qoder account
func (s *QoderService) GetAccountStatus(ctx context.Context, accountID string) (*AccountStatus, error) {
	if accountID == "" {
		return nil, fmt.Errorf("account ID is required")
	}

	var status AccountStatus
	err := s.doRequestWithRetry(ctx, "GET", fmt.Sprintf("/accounts/%s/status", accountID), nil, &status)
	if err != nil {
		return nil, fmt.Errorf("failed to get account status: %w", err)
	}

	return &status, nil
}

// doRequestWithRetry performs an HTTP request with retry logic for transient errors
func (s *QoderService) doRequestWithRetry(ctx context.Context, method, path string, body interface{}, result interface{}) error {
	var lastErr error

	for attempt := 0; attempt <= s.maxRetries; attempt++ {
		if attempt > 0 {
			backoff := s.baseBackoff * time.Duration(1<<(attempt-1)) // exponential backoff
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
			}
		}

		err := s.doRequest(ctx, method, path, body, result)
		if err == nil {
			return nil
		}

		lastErr = err

		// Only retry on transient errors (5xx, network errors, timeout)
		if !isTransientError(err) {
			return err
		}
	}

	return fmt.Errorf("max retries exceeded: %w", lastErr)
}

// doRequest performs a single HTTP request
func (s *QoderService) doRequest(ctx context.Context, method, path string, body interface{}, result interface{}) error {
	url := s.config.BaseURL + path

	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.config.APIKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		return fmt.Errorf("server error: status %d", resp.StatusCode)
	}

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("client error: status %d, body: %s", resp.StatusCode, string(bodyBytes))
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("failed to decode response: %w", err)
		}
	}

	return nil
}

// isTransientError checks if an error is transient and should be retried
func isTransientError(err error) bool {
	// Check for timeout errors
	if err == context.DeadlineExceeded {
		return true
	}

	// Check for network-related errors
	errStr := err.Error()
	transientPatterns := []string{
		"connection refused",
		"connection reset",
		"timeout",
		"temporary failure",
		"server error",
	}

	for _, pattern := range transientPatterns {
		if contains(errStr, pattern) {
			return true
		}
	}

	return false
}

// contains checks if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		match := true
		for j := 0; j < len(substr); j++ {
			sc := s[i+j]
			subc := substr[j]
			// Simple lowercase comparison
			if sc >= 'A' && sc <= 'Z' {
				sc += 32
			}
			if subc >= 'A' && subc <= 'Z' {
				subc += 32
			}
			if sc != subc {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}