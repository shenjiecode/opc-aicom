package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/pkg/config"
	"gorm.io/gorm"
)

// AlibabaCloudService handles Alibaba Cloud credit synchronization
type AlibabaCloudService struct {
	config     *config.AlibabaCloudConfig
	httpClient *http.Client
	db         *gorm.DB
}

// AlibabaCloudAPIResponse represents the response from Alibaba Cloud API
type AlibabaCloudAPIResponse struct {
	Success      bool `json:"success"`
	Code         string `json:"code"`
	Message      string `json:"message"`
	Data         struct {
		UserID        string `json:"user_id"`
		CreditBalance int    `json:"credit_balance"`
	} `json:"data"`
}

// NewAlibabaCloudService creates a new AlibabaCloudService instance
func NewAlibabaCloudService(cfg *config.AlibabaCloudConfig, db *gorm.DB) *AlibabaCloudService {
	return &AlibabaCloudService{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		db: db,
	}
}

// SyncCredit synchronizes credit amount for a user from Alibaba Cloud
// This updates the local database with the credit amount from Alibaba Cloud
func (s *AlibabaCloudService) SyncCredit(ctx context.Context, userID string, creditAmount int) error {
	// Validate inputs
	if userID == "" {
		return fmt.Errorf("userID cannot be empty")
	}
	if creditAmount < 0 {
		return fmt.Errorf("creditAmount cannot be negative")
	}

	// Parse userID to uint
	var uid uint
	if _, err := fmt.Sscanf(userID, "%d", &uid); err != nil {
		return fmt.Errorf("invalid userID format: %w", err)
	}

	// Get or create user asset
	var asset model.UserAsset
	if err := s.db.Where("user_id = ?", uid).First(&asset).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create new asset record
			asset = model.UserAsset{
				UserID:        uid,
				Points:        0,
				AlibabaCredit: creditAmount,
			}
			if err := s.db.Create(&asset).Error; err != nil {
				return fmt.Errorf("failed to create user asset: %w", err)
			}
			return nil
		}
		return fmt.Errorf("failed to query user asset: %w", err)
	}

	// Update Alibaba credit
	asset.AlibabaCredit = creditAmount
	if err := s.db.Save(&asset).Error; err != nil {
		return fmt.Errorf("failed to update user asset: %w", err)
	}

	return nil
}

// SyncCreditFromAPI fetches credit balance from Alibaba Cloud API and syncs to local DB
func (s *AlibabaCloudService) SyncCreditFromAPI(ctx context.Context, userID string) error {
	// Validate config
	if s.config.AccessKeyID == "" || s.config.AccessKeySecret == "" {
		return fmt.Errorf("Alibaba Cloud credentials not configured")
	}

	// Build API URL
	apiURL := fmt.Sprintf("https://%s.alicloudapi.com/credit/balance?user_id=%s", s.config.Region, userID)

	// Create request
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set authentication headers
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.config.AccessKeyID))
	req.Header.Set("X-AccessKey-Secret", s.config.AccessKeySecret)
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call Alibaba Cloud API: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	// Check HTTP status
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Alibaba Cloud API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var apiResp AlibabaCloudAPIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return fmt.Errorf("failed to parse API response: %w", err)
	}

	// Check API response
	if !apiResp.Success {
		return fmt.Errorf("Alibaba Cloud API error: %s - %s", apiResp.Code, apiResp.Message)
	}

	// Sync credit to local database
	return s.SyncCredit(ctx, userID, apiResp.Data.CreditBalance)
}

// GetCreditBalance retrieves the Alibaba Cloud credit balance for a user
func (s *AlibabaCloudService) GetCreditBalance(ctx context.Context, userID string) (int, error) {
	// Validate input
	if userID == "" {
		return 0, fmt.Errorf("userID cannot be empty")
	}

	// Parse userID to uint
	var uid uint
	if _, err := fmt.Sscanf(userID, "%d", &uid); err != nil {
		return 0, fmt.Errorf("invalid userID format: %w", err)
	}

	// Query user asset
	var asset model.UserAsset
	if err := s.db.Where("user_id = ?", uid).First(&asset).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return 0, nil // Return 0 if no record exists
		}
		return 0, fmt.Errorf("failed to query user asset: %w", err)
	}

	return asset.AlibabaCredit, nil
}

// GetCreditBalanceFromAPI fetches credit balance directly from Alibaba Cloud API
func (s *AlibabaCloudService) GetCreditBalanceFromAPI(ctx context.Context, userID string) (int, error) {
	// Validate config
	if s.config.AccessKeyID == "" || s.config.AccessKeySecret == "" {
		return 0, fmt.Errorf("Alibaba Cloud credentials not configured")
	}

	// Build API URL
	apiURL := fmt.Sprintf("https://%s.alicloudapi.com/credit/balance?user_id=%s", s.config.Region, userID)

	// Create request
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to create request: %w", err)
	}

	// Set authentication headers
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.config.AccessKeyID))
	req.Header.Set("X-AccessKey-Secret", s.config.AccessKeySecret)
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("failed to call Alibaba Cloud API: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check HTTP status
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("Alibaba Cloud API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var apiResp AlibabaCloudAPIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return 0, fmt.Errorf("failed to parse API response: %w", err)
	}

	// Check API response
	if !apiResp.Success {
		return 0, fmt.Errorf("Alibaba Cloud API error: %s - %s", apiResp.Code, apiResp.Message)
	}

	return apiResp.Data.CreditBalance, nil
}

// SetHTTPClient allows setting a custom HTTP client (useful for testing)
func (s *AlibabaCloudService) SetHTTPClient(client *http.Client) {
	s.httpClient = client
}
