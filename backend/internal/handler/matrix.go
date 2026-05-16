package handler

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/pkg/config"
)

// MatrixClient handles communication with Matrix homeserver
type MatrixClient struct {
	config *config.Config
}

// NewMatrixClient creates a new Matrix client
func NewMatrixClient(cfg *config.Config) *MatrixClient {
	return &MatrixClient{config: cfg}
}

// MatrixRegisterRequest is the request body for user registration
type MatrixRegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// MatrixLoginRequest is the request body for login
type MatrixLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	DeviceID string `json:"device_id"`
}

// MatrixRegisterResponse is the response for user registration
type MatrixRegisterResponse struct {
	UserID      string `json:"user_id"`
	AccessToken string `json:"access_token"`
	DeviceID    string `json:"device_id"`
}

// MatrixLoginResponse is the response for login
type MatrixLoginResponse struct {
	UserID      string `json:"user_id"`
	AccessToken string `json:"access_token"`
	DeviceID    string `json:"device_id"`
	HomeServer  string `json:"home_server"`
}

// MatrixRoom represents a Matrix room
type MatrixRoom struct {
	RoomID    string   `json:"room_id"`
	Name      string   `json:"name"`
	Topic     string   `json:"topic"`
	AvatarURL string   `json:"avatar_url"`
	Members   []string `json:"members"`
}

// CreateRoomRequest is the request body for creating a room
type CreateRoomRequest struct {
	Name       string   `json:"name" binding:"required"`
	Topic      string   `json:"topic"`
	Visibility string   `json:"visibility"` // "public" or "private"
	Invite     []string `json:"invite"`
}

// MatrixSyncResponse represents the sync response
type MatrixSyncResponse struct {
	Rooms struct {
		Join   map[string]interface{} `json:"join"`
		Invite map[string]interface{} `json:"invite"`
		Leave  map[string]interface{} `json:"leave"`
	} `json:"rooms"`
}

// RegisterMatrixUser registers a user on Matrix server using admin API
// POST /api/matrix/register (requires auth)
func RegisterMatrixUser(matrixClient *MatrixClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req MatrixRegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "Invalid request: " + err.Error(),
			})
			return
		}

		// Get user info from context (set by auth middleware)
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Unauthorized",
			})
			return
		}

		// Create Matrix user using Dendrite shared secret registration
		// Dendrite supports /_synapse/admin/v1/register endpoint
		matrixUserID := fmt.Sprintf("@%s:%s", req.Username, matrixClient.config.Matrix.ServerName)

		// Step 1: Get nonce from Dendrite
		nonceURL := fmt.Sprintf("%s/_synapse/admin/v1/register", matrixClient.config.Matrix.HomeserverURL)
		nonceResp, err := http.Get(nonceURL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to get nonce from Matrix server: " + err.Error(),
			})
			return
		}
		defer nonceResp.Body.Close()

		var nonceResult struct {
			Nonce string `json:"nonce"`
		}
		if err := json.NewDecoder(nonceResp.Body).Decode(&nonceResult); err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to parse nonce response: " + err.Error(),
			})
			return
		}

		// Step 2: Calculate HMAC-SHA1
		// MAC = hmac_sha1(shared_secret, nonce + "\x00" + username + "\x00" + password + "\x00" + "notadmin")
		adminStatus := "notadmin"
		message := nonceResult.Nonce + "\x00" + req.Username + "\x00" + req.Password + "\x00" + adminStatus
		h := hmac.New(sha1.New, []byte(matrixClient.config.Matrix.SharedSecret))
		h.Write([]byte(message))
		mac := hex.EncodeToString(h.Sum(nil))

		// Step 3: Register user
		registerBody := map[string]interface{}{
			"username": req.Username,
			"password": req.Password,
			"nonce":    nonceResult.Nonce,
			"admin":    false,
			"mac":      mac,
		}

		bodyBytes, _ := json.Marshal(registerBody)
		httpReq, err := http.NewRequest("POST", nonceURL, bytes.NewBuffer(bodyBytes))
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to create request: " + err.Error(),
			})
			return
		}

		httpReq.Header.Set("Content-Type", "application/json")

		client := &http.Client{}
		resp, err := client.Do(httpReq)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to connect to Matrix server: " + err.Error(),
			})
			return
		}
		defer resp.Body.Close()

		respBody, _ := io.ReadAll(resp.Body)

		if resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: fmt.Sprintf("Matrix registration failed: %s", string(respBody)),
			})
			return
		}

		var result MatrixRegisterResponse
		if err := json.Unmarshal(respBody, &result); err != nil {
			result.UserID = matrixUserID
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"matrix_user_id": result.UserID,
				"openc_user_id": userID,
			},
		})
	}
}

// LoginMatrixUser logs in a user on Matrix server and returns access token
// POST /api/matrix/login (requires auth)
// If the Matrix user does not exist, it will be auto-registered.
func LoginMatrixUser(matrixClient *MatrixClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req MatrixLoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "Invalid request: " + err.Error(),
			})
			return
		}

		// Use username from request or from auth context
		username := req.Username
		if username == "" {
			userID, exists := c.Get("userID")
			if !exists {
				c.JSON(http.StatusUnauthorized, UnifiedResponse{
					Code:    401,
					Message: "Unauthorized",
				})
				return
			}
			// Convert user ID to string and extract username
			username = fmt.Sprintf("user_%v", userID)
		}

		password := req.Password
		if password == "" {
			password = "password"
		}

		deviceID := req.DeviceID
		if deviceID == "" {
			deviceID = "WEB_CLIENT"
		}

		// Login via Matrix client-server API
		loginURL := fmt.Sprintf("%s/_matrix/client/v3/login", matrixClient.config.Matrix.HomeserverURL)

		loginBody := map[string]interface{}{
			"type": "m.login.password",
			"identifier": map[string]interface{}{
				"type": "m.id.user",
				"user": username,
			},
			"password":                    password,
			"device_id":                   deviceID,
			"initial_device_display_name": "OPC Web Client",
		}

		bodyBytes, _ := json.Marshal(loginBody)
		httpReq, err := http.NewRequest("POST", loginURL, bytes.NewBuffer(bodyBytes))
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to create request: " + err.Error(),
			})
			return
		}

		httpReq.Header.Set("Content-Type", "application/json")

		client := &http.Client{}
		resp, err := client.Do(httpReq)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to connect to Matrix server: " + err.Error(),
			})
			return
		}
		defer resp.Body.Close()

		respBody, _ := io.ReadAll(resp.Body)

		// If login failed (user may not exist), try auto-registering
		if resp.StatusCode != http.StatusOK {
			// Try to register the user first using Dendrite shared secret
			regErr := registerMatrixUserInternal(matrixClient, username, password)
			if regErr != nil {
				c.JSON(http.StatusUnauthorized, UnifiedResponse{
					Code:    401,
					Message: fmt.Sprintf("Matrix login failed and auto-registration failed. Login: %s, Register: %v", string(respBody), regErr),
				})
				return
			}

			// Retry login after registration
			bodyBytes2, _ := json.Marshal(loginBody)
			httpReq2, err := http.NewRequest("POST", loginURL, bytes.NewBuffer(bodyBytes2))
			if err != nil {
				c.JSON(http.StatusInternalServerError, UnifiedResponse{
					Code:    500,
					Message: "Failed to create login request after registration: " + err.Error(),
				})
				return
			}
			httpReq2.Header.Set("Content-Type", "application/json")

			resp2, err := client.Do(httpReq2)
			if err != nil {
				c.JSON(http.StatusInternalServerError, UnifiedResponse{
					Code:    500,
					Message: "Failed to login after registration: " + err.Error(),
				})
				return
			}
			defer resp2.Body.Close()

			respBody, _ = io.ReadAll(resp2.Body)
			if resp2.StatusCode != http.StatusOK {
				c.JSON(http.StatusUnauthorized, UnifiedResponse{
					Code:    401,
					Message: fmt.Sprintf("Matrix login failed after registration: %s", string(respBody)),
				})
				return
			}
			respBody = respBody // use new response
		}

		var result MatrixLoginResponse
		if err := json.Unmarshal(respBody, &result); err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to parse Matrix response",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"access_token":   result.AccessToken,
				"user_id":        result.UserID,
				"device_id":      result.DeviceID,
				"home_server":    result.HomeServer,
				"homeserver_url": matrixClient.config.Matrix.HomeserverURL,
			},
		})
	}
}

// registerMatrixUserInternal registers a user on Dendrite using shared secret
func registerMatrixUserInternal(matrixClient *MatrixClient, username, password string) error {
	// Step 1: Get nonce
	nonceURL := fmt.Sprintf("%s/_synapse/admin/v1/register", matrixClient.config.Matrix.HomeserverURL)
	nonceResp, err := http.Get(nonceURL)
	if err != nil {
		return fmt.Errorf("failed to get nonce: %w", err)
	}
	defer nonceResp.Body.Close()

	var nonceResult struct {
		Nonce string `json:"nonce"`
	}
	if err := json.NewDecoder(nonceResp.Body).Decode(&nonceResult); err != nil {
		return fmt.Errorf("failed to parse nonce: %w", err)
	}

	// Step 2: Calculate HMAC-SHA1
	message := nonceResult.Nonce + "\x00" + username + "\x00" + password + "\x00" + "notadmin"
	h := hmac.New(sha1.New, []byte(matrixClient.config.Matrix.SharedSecret))
	h.Write([]byte(message))
	mac := hex.EncodeToString(h.Sum(nil))

	// Step 3: Register user
	registerBody := map[string]interface{}{
		"username": username,
		"password": password,
		"nonce":    nonceResult.Nonce,
		"admin":    false,
		"mac":      mac,
	}

	bodyBytes, _ := json.Marshal(registerBody)
	httpReq, err := http.NewRequest("POST", nonceURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return fmt.Errorf("failed to create register request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to register: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("registration failed: %s", string(respBody))
	}

	return nil
}

// CreateMatrixRoom creates a new Matrix room
// POST /api/matrix/rooms (requires auth)
func CreateMatrixRoom(matrixClient *MatrixClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CreateRoomRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "Invalid request: " + err.Error(),
			})
			return
		}

		// Get access token from header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Missing Authorization header",
			})
			return
		}

		// Extract token from "Bearer <token>"
		token := strings.TrimPrefix(authHeader, "Bearer ")

		// Create room via Matrix client-server API
		createURL := fmt.Sprintf("%s/_matrix/client/v3/createRoom", matrixClient.config.Matrix.HomeserverURL)

		preset := "private_chat"
		if req.Visibility == "public" {
			preset = "public_chat"
		}

		roomBody := map[string]interface{}{
			"name":          req.Name,
			"topic":         req.Topic,
			"preset":        preset,
			"visibility":    req.Visibility,
			"invite":        req.Invite,
			"initial_state": []interface{}{},
		}

		bodyBytes, _ := json.Marshal(roomBody)
		httpReq, err := http.NewRequest("POST", createURL, bytes.NewBuffer(bodyBytes))
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to create request: " + err.Error(),
			})
			return
		}

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

		client := &http.Client{}
		resp, err := client.Do(httpReq)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to connect to Matrix server: " + err.Error(),
			})
			return
		}
		defer resp.Body.Close()

		respBody, _ := io.ReadAll(resp.Body)

		if resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: fmt.Sprintf("Failed to create room: %s", string(respBody)),
			})
			return
		}

		var result struct {
			RoomID string `json:"room_id"`
		}
		json.Unmarshal(respBody, &result)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"room_id": result.RoomID,
				"name":    req.Name,
			},
		})
	}
}

// JoinMatrixRoom joins a Matrix room
// POST /api/matrix/rooms/:room_id/join (requires auth)
func JoinMatrixRoom(matrixClient *MatrixClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Param("room_id")
		if roomID == "" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "Room ID is required",
			})
			return
		}

		// Get access token from header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Missing Authorization header",
			})
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")

		// Join room via Matrix client-server API
		joinURL := fmt.Sprintf("%s/_matrix/client/v3/rooms/%s/join", matrixClient.config.Matrix.HomeserverURL, roomID)

		httpReq, err := http.NewRequest("POST", joinURL, bytes.NewBuffer([]byte("{}")))
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to create request: " + err.Error(),
			})
			return
		}

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

		client := &http.Client{}
		resp, err := client.Do(httpReq)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to connect to Matrix server: " + err.Error(),
			})
			return
		}
		defer resp.Body.Close()

		respBody, _ := io.ReadAll(resp.Body)

		if resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: fmt.Sprintf("Failed to join room: %s", string(respBody)),
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"room_id": roomID,
			},
		})
	}
}

// ListMatrixRooms lists all rooms the user has joined
// GET /api/matrix/rooms (requires auth)
func ListMatrixRooms(matrixClient *MatrixClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get access token from header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Missing Authorization header",
			})
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")

		// Get public rooms first
		publicRooms := getPublicRooms(matrixClient)

		// Get joined rooms via Matrix client-server API
		roomsURL := fmt.Sprintf("%s/_matrix/client/v3/joined_rooms", matrixClient.config.Matrix.HomeserverURL)

		httpReq, err := http.NewRequest("GET", roomsURL, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to create request: " + err.Error(),
			})
			return
		}

		httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

		client := &http.Client{}
		resp, err := client.Do(httpReq)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to connect to Matrix server: " + err.Error(),
			})
			return
		}
		defer resp.Body.Close()

		respBody, _ := io.ReadAll(resp.Body)

		if resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: fmt.Sprintf("Failed to list rooms: %s", string(respBody)),
			})
			return
		}

		var result struct {
			JoinedRooms []string `json:"joined_rooms"`
		}
		json.Unmarshal(respBody, &result)

		// Build a map of joined room IDs for quick lookup
		joinedMap := make(map[string]bool)
		for _, roomID := range result.JoinedRooms {
			joinedMap[roomID] = true
		}

		// Merge public rooms with joined rooms info
		allRooms := make([]gin.H, 0)
		seenRooms := make(map[string]bool)

		// Add public rooms first
		for _, room := range publicRooms {
			roomID := room["room_id"].(string)
			seenRooms[roomID] = true
			room["joined"] = joinedMap[roomID]
			allRooms = append(allRooms, room)
		}

		// Add joined rooms that are not public (private rooms)
		for _, roomID := range result.JoinedRooms {
			if !seenRooms[roomID] {
				roomInfo := getRoomInfo(matrixClient, token, roomID)
				roomInfo["joined"] = true
				allRooms = append(allRooms, roomInfo)
			}
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"rooms": allRooms,
			},
		})
	}
}

// getPublicRooms fetches all public rooms from Matrix server
func getPublicRooms(matrixClient *MatrixClient) []gin.H {
	publicURL := fmt.Sprintf("%s/_matrix/client/v3/publicRooms", matrixClient.config.Matrix.HomeserverURL)

	resp, err := http.Get(publicURL)
	if err != nil {
		return []gin.H{}
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return []gin.H{}
	}

	var result struct {
		Chunk []struct {
			RoomID    string `json:"room_id"`
			Name      string `json:"name"`
			Topic     string `json:"topic"`
			AvatarURL string `json:"avatar_url"`
			Members   int    `json:"num_joined_members"`
		} `json:"chunk"`
	}

	json.Unmarshal(respBody, &result)

	rooms := make([]gin.H, 0, len(result.Chunk))
	for _, r := range result.Chunk {
		rooms = append(rooms, gin.H{
			"room_id":              r.RoomID,
			"name":                 r.Name,
			"topic":                r.Topic,
			"avatar_url":           r.AvatarURL,
			"num_joined_members":   r.Members,
		})
	}

	return rooms
}

// getRoomInfo fetches room state and returns room info
func getRoomInfo(matrixClient *MatrixClient, token, roomID string) gin.H {
	stateURL := fmt.Sprintf("%s/_matrix/client/v3/rooms/%s/state", matrixClient.config.Matrix.HomeserverURL, roomID)

	httpReq, err := http.NewRequest("GET", stateURL, nil)
	if err != nil {
		return gin.H{"room_id": roomID, "name": roomID}
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return gin.H{"room_id": roomID, "name": roomID}
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return gin.H{"room_id": roomID, "name": roomID}
	}

	var state []struct {
		Type     string                 `json:"type"`
		Content  map[string]interface{} `json:"content"`
	}
	json.Unmarshal(respBody, &state)

	roomInfo := gin.H{
		"room_id": roomID,
		"name":    roomID,
		"topic":   "",
	}

	for _, event := range state {
		if event.Type == "m.room.name" {
			if name, ok := event.Content["name"].(string); ok {
				roomInfo["name"] = name
			}
		}
		if event.Type == "m.room.topic" {
			if topic, ok := event.Content["topic"].(string); ok {
				roomInfo["topic"] = topic
			}
		}
	}

	return roomInfo
}

// LeaveMatrixRoom leaves a Matrix room
// POST /api/matrix/rooms/:room_id/leave (requires auth)
func LeaveMatrixRoom(matrixClient *MatrixClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Param("room_id")
		if roomID == "" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "Room ID is required",
			})
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Missing Authorization header",
			})
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")

		leaveURL := fmt.Sprintf("%s/_matrix/client/v3/rooms/%s/leave", matrixClient.config.Matrix.HomeserverURL, roomID)

		httpReq, err := http.NewRequest("POST", leaveURL, bytes.NewBuffer([]byte("{}")))
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to create request: " + err.Error(),
			})
			return
		}

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

		client := &http.Client{}
		resp, err := client.Do(httpReq)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to connect to Matrix server: " + err.Error(),
			})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			respBody, _ := io.ReadAll(resp.Body)
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: fmt.Sprintf("Failed to leave room: %s", string(respBody)),
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
		})
	}
}

// InviteToMatrixRoom invites a user to a Matrix room
// POST /api/matrix/rooms/:room_id/invite (requires auth)
func InviteToMatrixRoom(matrixClient *MatrixClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Param("room_id")
		if roomID == "" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "Room ID is required",
			})
			return
		}

		var req struct {
			UserID string `json:"user_id" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "Invalid request: " + err.Error(),
			})
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Missing Authorization header",
			})
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")

		inviteURL := fmt.Sprintf("%s/_matrix/client/v3/rooms/%s/invite", matrixClient.config.Matrix.HomeserverURL, roomID)

		inviteBody := map[string]interface{}{
			"user_id": req.UserID,
		}

		bodyBytes, _ := json.Marshal(inviteBody)
		httpReq, err := http.NewRequest("POST", inviteURL, bytes.NewBuffer(bodyBytes))
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to create request: " + err.Error(),
			})
			return
		}

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

		client := &http.Client{}
		resp, err := client.Do(httpReq)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to connect to Matrix server: " + err.Error(),
			})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			respBody, _ := io.ReadAll(resp.Body)
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: fmt.Sprintf("Failed to invite user: %s", string(respBody)),
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
		})
	}
}
// WorkerInfo represents a worker's status and rooms
type WorkerInfo struct {
	WorkerID  string   `json:"worker_id"`
	UserID    string   `json:"user_id"`
	Name      string   `json:"name"`
	IsOnline  bool     `json:"is_online"`
	Rooms     []string `json:"rooms"`
}

// ListMatrixWorkers lists all configured workers and their joined rooms
// GET /api/matrix/workers (requires auth)
func ListMatrixWorkers(matrixClient *MatrixClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		workers := make([]WorkerInfo, 0, len(matrixClient.config.Matrix.Workers))

		for _, workerName := range matrixClient.config.Matrix.Workers {
			workerInfo := WorkerInfo{
				WorkerID: workerName,
				UserID:   fmt.Sprintf("@%s:%s", workerName, matrixClient.config.Matrix.ServerName),
				Name:     workerName,
				IsOnline: false,
				Rooms:    getWorkerRooms(matrixClient, workerName),
			}
			workers = append(workers, workerInfo)
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"workers": workers,
			},
		})
	}
}

// getWorkerRooms returns the list of room IDs a worker has joined
func getWorkerRooms(matrixClient *MatrixClient, workerName string) []string {
	// Login as the worker to get their joined rooms
	loginURL := fmt.Sprintf("%s/_matrix/client/v3/login", matrixClient.config.Matrix.HomeserverURL)

	loginBody := map[string]interface{}{
		"type": "m.login.password",
		"identifier": map[string]interface{}{
			"type": "m.id.user",
			"user": workerName,
		},
		"password":                    "password",
		"device_id":                   "WORKER_STATUS_CHECK",
		"initial_device_display_name": "Worker Status Check",
	}

	bodyBytes, _ := json.Marshal(loginBody)
	httpReq, err := http.NewRequest("POST", loginURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return []string{}
	}

	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return []string{}
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return []string{}
	}

	var loginResult struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(respBody, &loginResult); err != nil {
		return []string{}
	}

	// Get joined rooms
	roomsURL := fmt.Sprintf("%s/_matrix/client/v3/joined_rooms", matrixClient.config.Matrix.HomeserverURL)
	roomsReq, err := http.NewRequest("GET", roomsURL, nil)
	if err != nil {
		return []string{}
	}
	roomsReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", loginResult.AccessToken))

	roomsResp, err := client.Do(roomsReq)
	if err != nil {
		return []string{}
	}
	defer roomsResp.Body.Close()

	roomsRespBody, _ := io.ReadAll(roomsResp.Body)
	if roomsResp.StatusCode != http.StatusOK {
		return []string{}
	}

	var roomsResult struct {
		JoinedRooms []string `json:"joined_rooms"`
	}
	json.Unmarshal(roomsRespBody, &roomsResult)

	return roomsResult.JoinedRooms
}

// JoinWorkerToRoom makes a worker join a specific room
// POST /api/matrix/workers/:worker_id/join (requires auth)
func JoinWorkerToRoom(matrixClient *MatrixClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		workerID := c.Param("worker_id")
		if workerID == "" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "Worker ID is required",
			})
			return
		}

		var req struct {
			RoomID string `json:"room_id" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "Invalid request: " + err.Error(),
			})
			return
		}

		// Validate worker is in configured list
		found := false
		for _, w := range matrixClient.config.Matrix.Workers {
			if w == workerID {
				found = true
				break
			}
		}
		if !found {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: fmt.Sprintf("Worker %s is not configured", workerID),
			})
			return
		}

		// Login as the worker
		loginURL := fmt.Sprintf("%s/_matrix/client/v3/login", matrixClient.config.Matrix.HomeserverURL)
		loginBody := map[string]interface{}{
			"type": "m.login.password",
			"identifier": map[string]interface{}{
				"type": "m.id.user",
				"user": workerID,
			},
			"password":                    "password",
			"device_id":                   "WORKER_JOIN",
			"initial_device_display_name": "Worker Join",
		}

		bodyBytes, _ := json.Marshal(loginBody)
		httpReq, err := http.NewRequest("POST", loginURL, bytes.NewBuffer(bodyBytes))
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to create login request: " + err.Error(),
			})
			return
		}

		httpReq.Header.Set("Content-Type", "application/json")

		client := &http.Client{}
		resp, err := client.Do(httpReq)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to login as worker: " + err.Error(),
			})
			return
		}
		defer resp.Body.Close()

		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: fmt.Sprintf("Worker login failed: %s", string(respBody)),
			})
			return
		}

		var loginResult struct {
			AccessToken string `json:"access_token"`
		}
		if err := json.Unmarshal(respBody, &loginResult); err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to parse worker login response",
			})
			return
		}

		// Join the room as the worker
		joinURL := fmt.Sprintf("%s/_matrix/client/v3/rooms/%s/join", matrixClient.config.Matrix.HomeserverURL, req.RoomID)
		joinReq, err := http.NewRequest("POST", joinURL, bytes.NewBuffer([]byte("{}")))
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to create join request: " + err.Error(),
			})
			return
		}

		joinReq.Header.Set("Content-Type", "application/json")
		joinReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", loginResult.AccessToken))

		joinResp, err := client.Do(joinReq)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to join room: " + err.Error(),
			})
			return
		}
		defer joinResp.Body.Close()

		joinRespBody, _ := io.ReadAll(joinResp.Body)
        if joinResp.StatusCode != http.StatusOK {
            // Check if it's a forbidden error (need invite)
            var joinError struct {
                ErrorCode string `json:"errcode"`
                Error     string `json:"error"`
            }
            json.Unmarshal(joinRespBody, &joinError)
            
            if joinError.ErrorCode == "M_FORBIDDEN" {
                // Need to invite the worker first using caller's access token
                callerToken := c.GetHeader("Authorization")
                if callerToken == "" {
                    c.JSON(http.StatusInternalServerError, UnifiedResponse{
                        Code:    500,
                        Message: "Worker cannot join private room without invitation. Please provide Authorization header.",
                    })
                    return
                }
                
                // Extract worker's Matrix user ID
                workerUserID := fmt.Sprintf("@%s:%s", workerID, matrixClient.config.Matrix.ServerName)
                
                // Invite worker to room
                inviteURL := fmt.Sprintf("%s/_matrix/client/v3/rooms/%s/invite", matrixClient.config.Matrix.HomeserverURL, req.RoomID)
                inviteBody := map[string]interface{}{"user_id": workerUserID}
                inviteBytes, _ := json.Marshal(inviteBody)
                inviteReq, err := http.NewRequest("POST", inviteURL, bytes.NewBuffer(inviteBytes))
                if err != nil {
                    c.JSON(http.StatusInternalServerError, UnifiedResponse{
                        Code:    500,
                        Message: "Failed to create invite request: " + err.Error(),
                    })
                    return
                }
                inviteReq.Header.Set("Content-Type", "application/json")
                inviteReq.Header.Set("Authorization", callerToken)
                
                inviteResp, err := client.Do(inviteReq)
                if err != nil {
                    c.JSON(http.StatusInternalServerError, UnifiedResponse{
                        Code:    500,
                        Message: "Failed to invite worker: " + err.Error(),
                    })
                    return
                }
                defer inviteResp.Body.Close()
                
                if inviteResp.StatusCode != http.StatusOK {
                    inviteRespBody, _ := io.ReadAll(inviteResp.Body)
                    c.JSON(http.StatusInternalServerError, UnifiedResponse{
                        Code:    500,
                        Message: fmt.Sprintf("Failed to invite worker to room: %s", string(inviteRespBody)),
                    })
                    return
                }
                
                // Now try to join again
                joinReq2, _ := http.NewRequest("POST", joinURL, bytes.NewBuffer([]byte("{}")))
                joinReq2.Header.Set("Content-Type", "application/json")
                joinReq2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", loginResult.AccessToken))
                
                joinResp2, err := client.Do(joinReq2)
                if err != nil {
                    c.JSON(http.StatusInternalServerError, UnifiedResponse{
                        Code:    500,
                        Message: "Failed to join room after invite: " + err.Error(),
                    })
                    return
                }
                defer joinResp2.Body.Close()
                
                if joinResp2.StatusCode != http.StatusOK {
                    joinRespBody2, _ := io.ReadAll(joinResp2.Body)
                    c.JSON(http.StatusInternalServerError, UnifiedResponse{
                        Code:    500,
                        Message: fmt.Sprintf("Worker failed to join room after invite: %s", string(joinRespBody2)),
                    })
                    return
                }
                
                // Success!
                c.JSON(http.StatusOK, UnifiedResponse{
                    Code:    0,
                    Message: "success",
                    Data: gin.H{
                        "worker_id": workerID,
                        "room_id":   req.RoomID,
                    },
                })
                return
            }
            
            c.JSON(http.StatusInternalServerError, UnifiedResponse{
                Code:    500,
                Message: fmt.Sprintf("Worker failed to join room: %s", string(joinRespBody)),
            })
            return
        }

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"worker_id": workerID,
				"room_id":   req.RoomID,
			},
		})
	}
}
