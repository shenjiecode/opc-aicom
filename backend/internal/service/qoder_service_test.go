package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/opc-aicom/backend/pkg/config"
)

func TestNewQoderService(t *testing.T) {
	t.Run("with config", func(t *testing.T) {
		cfg := &config.QoderConfig{
			BaseURL:       "https://api.qoder.ai",
			APIKey:        "test-key",
			MonthlyPlanID: "plan-123",
		}

		svc := NewQoderService(cfg)
		if svc == nil {
			t.Fatal("expected service to be created")
		}
		if svc.client.Timeout != 10*time.Second {
			t.Errorf("expected timeout 10s, got %v", svc.client.Timeout)
		}
		if svc.maxRetries != 3 {
			t.Errorf("expected max retries 3, got %d", svc.maxRetries)
		}
	})

	t.Run("with nil config", func(t *testing.T) {
		svc := NewQoderService(nil)
		if svc == nil {
			t.Fatal("expected service to be created")
		}
		if svc.config.BaseURL != "https://api.qoder.ai" {
			t.Errorf("expected default base URL, got %s", svc.config.BaseURL)
		}
	})
}

func TestCreateAccount(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != "POST" {
				t.Errorf("expected POST, got %s", r.Method)
			}
			if r.URL.Path != "/accounts" {
				t.Errorf("expected /accounts, got %s", r.URL.Path)
			}

			auth := r.Header.Get("Authorization")
			if auth != "Bearer test-key" {
				t.Errorf("expected Bearer test-key, got %s", auth)
			}

			var reqBody map[string]string
			if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
				t.Errorf("failed to decode request body: %v", err)
			}
			if reqBody["email"] != "test@example.com" {
				t.Errorf("expected email test@example.com, got %s", reqBody["email"])
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(QoderAccount{
				ID:        "acc-123",
				Email:     "test@example.com",
				Status:    "active",
				CreatedAt: time.Now(),
				PlanID:    "plan-123",
			})
		}))
		defer server.Close()

		cfg := &config.QoderConfig{
			BaseURL:       server.URL,
			APIKey:        "test-key",
			MonthlyPlanID: "plan-123",
		}
		svc := NewQoderService(cfg)

		account, err := svc.CreateAccount(context.Background(), "test@example.com")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if account.ID != "acc-123" {
			t.Errorf("expected account ID acc-123, got %s", account.ID)
		}
		if account.Email != "test@example.com" {
			t.Errorf("expected email test@example.com, got %s", account.Email)
		}
	})

	t.Run("empty email", func(t *testing.T) {
		svc := NewQoderService(nil)
		_, err := svc.CreateAccount(context.Background(), "")
		if err == nil {
			t.Fatal("expected error for empty email")
		}
	})

	t.Run("client error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"error": "invalid email"}`))
		}))
		defer server.Close()

		cfg := &config.QoderConfig{
			BaseURL:       server.URL,
			APIKey:        "test-key",
			MonthlyPlanID: "plan-123",
		}
		svc := NewQoderService(cfg)

		_, err := svc.CreateAccount(context.Background(), "invalid")
		if err == nil {
			t.Fatal("expected error for client error")
		}
	})
}

func TestGetAccountStatus(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != "GET" {
				t.Errorf("expected GET, got %s", r.Method)
			}
			expectedPath := "/accounts/acc-123/status"
			if r.URL.Path != expectedPath {
				t.Errorf("expected %s, got %s", expectedPath, r.URL.Path)
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(AccountStatus{
				AccountID:    "acc-123",
				Status:       "active",
				PlanID:       "plan-123",
				PlanName:     "Monthly Pro",
				CreditsUsed:  100,
				CreditsLimit: 1000,
			})
		}))
		defer server.Close()

		cfg := &config.QoderConfig{
			BaseURL: server.URL,
			APIKey:  "test-key",
		}
		svc := NewQoderService(cfg)

		status, err := svc.GetAccountStatus(context.Background(), "acc-123")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if status.AccountID != "acc-123" {
			t.Errorf("expected account ID acc-123, got %s", status.AccountID)
		}
		if status.CreditsUsed != 100 {
			t.Errorf("expected credits used 100, got %d", status.CreditsUsed)
		}
	})

	t.Run("empty account ID", func(t *testing.T) {
		svc := NewQoderService(nil)
		_, err := svc.GetAccountStatus(context.Background(), "")
		if err == nil {
			t.Fatal("expected error for empty account ID")
		}
	})
}

func TestRetryLogic(t *testing.T) {
	t.Run("retries on server error", func(t *testing.T) {
		attempts := 0
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			attempts++
			if attempts < 3 {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(QoderAccount{
				ID:     "acc-123",
				Email:  "test@example.com",
				Status: "active",
			})
		}))
		defer server.Close()

		cfg := &config.QoderConfig{
			BaseURL:       server.URL,
			APIKey:        "test-key",
			MonthlyPlanID: "plan-123",
		}
		svc := NewQoderService(cfg)
		svc.baseBackoff = 10 * time.Millisecond // speed up test

		account, err := svc.CreateAccount(context.Background(), "test@example.com")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if account.ID != "acc-123" {
			t.Errorf("expected account ID acc-123, got %s", account.ID)
		}
		if attempts != 3 {
			t.Errorf("expected 3 attempts, got %d", attempts)
		}
	})

	t.Run("fails after max retries", func(t *testing.T) {
		attempts := 0
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			attempts++
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer server.Close()

		cfg := &config.QoderConfig{
			BaseURL:       server.URL,
			APIKey:        "test-key",
			MonthlyPlanID: "plan-123",
		}
		svc := NewQoderService(cfg)
		svc.baseBackoff = 10 * time.Millisecond // speed up test

		_, err := svc.CreateAccount(context.Background(), "test@example.com")
		if err == nil {
			t.Fatal("expected error after max retries")
		}
		if attempts != 4 { // initial + 3 retries
			t.Errorf("expected 4 attempts, got %d", attempts)
		}
	})

	t.Run("does not retry on client error", func(t *testing.T) {
		attempts := 0
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			attempts++
			w.WriteHeader(http.StatusBadRequest)
		}))
		defer server.Close()

		cfg := &config.QoderConfig{
			BaseURL:       server.URL,
			APIKey:        "test-key",
			MonthlyPlanID: "plan-123",
		}
		svc := NewQoderService(cfg)

		_, err := svc.CreateAccount(context.Background(), "test@example.com")
		if err == nil {
			t.Fatal("expected error for client error")
		}
		if attempts != 1 {
			t.Errorf("expected 1 attempt (no retry), got %d", attempts)
		}
	})
}

func TestContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cfg := &config.QoderConfig{
		BaseURL:       server.URL,
		APIKey:        "test-key",
		MonthlyPlanID: "plan-123",
	}
	svc := NewQoderService(cfg)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	_, err := svc.CreateAccount(ctx, "test@example.com")
	if err == nil {
		t.Fatal("expected error due to context cancellation")
	}
}

func TestIsTransientError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{"context deadline", context.DeadlineExceeded, true},
		{"connection refused", fmt.Errorf("connection refused"), true},
		{"connection reset", fmt.Errorf("connection reset by peer"), true},
		{"timeout", fmt.Errorf("request timeout"), true},
		{"server error", fmt.Errorf("server error: status 500"), true},
		{"client error", fmt.Errorf("client error: status 400"), false},
		{"invalid request", fmt.Errorf("invalid request"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isTransientError(tt.err)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}
