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
    "net/url"
    "strings"
    "sync"
    "time"
	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/pkg/config"
	"gorm.io/gorm"
)

var (
    matrixTokenCache = make(map[uint]string)
    tokenCacheMutex  sync.RWMutex

    // Admin token cache for Synapse Admin API
    adminTokenCache     string
    adminTokenExpiry    time.Time
    adminTokenMutex     sync.RWMutex
)

// sanitizeMatrixUsername sanitizes a username for Matrix compatibility
// Matrix usernames cannot contain @ (reserved for user ID format) or spaces
func sanitizeMatrixUsername(username string) string {
    // Replace @ with _at_
    result := strings.ReplaceAll(username, "@", "_at_")
    // Replace . with _dot_ for email-like usernames
    result = strings.ReplaceAll(result, ".", "_dot_")
    // Replace spaces with underscores
    result = strings.ReplaceAll(result, " ", "_")
    // Remove any other characters that aren't alphanumeric or underscore
    var sb strings.Builder
    for _, r := range result {
        if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
            sb.WriteRune(r)
        }
    }
    return sb.String()
}

func setMatrixToken(opcUserID uint, token string) {
    tokenCacheMutex.Lock()
    defer tokenCacheMutex.Unlock()
    matrixTokenCache[opcUserID] = token
}

func getMatrixToken(opcUserID uint) (string, bool) {
    tokenCacheMutex.RLock()
    defer tokenCacheMutex.RUnlock()
    token, ok := matrixTokenCache[opcUserID]
    return token, ok
}

// MatrixClient handles communication with Matrix homeserver
type MatrixClient struct {
	config *config.Config
	db     *gorm.DB           // main opc_aicom database
}

// NewMatrixClient creates a new Matrix client
func NewMatrixClient(cfg *config.Config, db *gorm.DB) *MatrixClient {
	return &MatrixClient{config: cfg, db: db}
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

// Uses OPC username as Matrix username for integration.

func LoginMatrixUser(matrixClient *MatrixClient) gin.HandlerFunc {

	return func(c *gin.Context) {

		var req MatrixLoginRequest

		// Allow empty body - ignore EOF error

		_ = c.ShouldBindJSON(&req)



		// Get OPC user ID from auth context

		opcUserIDRaw, exists := c.Get("userID")

		if !exists {

			c.JSON(http.StatusUnauthorized, UnifiedResponse{

				Code:    401,

				Message: "Unauthorized",

			})

			return

		}

		opcUserID := opcUserIDRaw.(uint)



		// Get OPC user from database to retrieve username

		var opcUser struct {

			Username       string

			MatrixUsername string

		}

		if err := matrixClient.db.Table("users").Select("username, matrix_username").Where("id = ?", opcUserID).First(&opcUser).Error; err != nil {

			c.JSON(http.StatusInternalServerError, UnifiedResponse{

				Code:    500,

				Message: "Failed to get user info",

			})

			return

		}



		// Determine Matrix username: use stored matrix_username first
		// If not set, sanitize the OPC username
		matrixUsername := opcUser.MatrixUsername
		if matrixUsername == "" {
			matrixUsername = sanitizeMatrixUsername(opcUser.Username)
		}

		// Use password from request or default

		password := req.Password
		if password == "" {
			password = "password" // Default password for Matrix
		}

		deviceID := req.DeviceID
		if deviceID == "" {
			deviceID = "WEB_CLIENT"
		}

		// Login or register Matrix user
		// Try multiple passwords: request password, then "password123", then "password"
		passwordsToTry := []string{password, "password123", "password"}
		var accessToken, matrixUserID string
		var err error
		
		for _, pw := range passwordsToTry {
			accessToken, matrixUserID, err = LoginOrRegisterMatrixUser(matrixClient, matrixUsername, pw)
			if err == nil {
				break
			}
		}
		
		if err != nil {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: err.Error(),
			})
			return
		}
		if err != nil {

			c.JSON(http.StatusUnauthorized, UnifiedResponse{

				Code:    401,

				Message: err.Error(),

			})

			return

		}



		// Update MatrixUsername in database if not set

		if opcUser.MatrixUsername == "" {

			matrixClient.db.Table("users").Where("id = ?", opcUserID).Update("matrix_username", matrixUsername)

		}



		// Cache the token

		setMatrixToken(opcUserID, accessToken)



		c.JSON(http.StatusOK, UnifiedResponse{

			Code:    0,

			Message: "success",

			Data: gin.H{

				"access_token":   accessToken,

				"user_id":        matrixUserID,

				"device_id":      deviceID,

				"home_server":    matrixClient.config.Matrix.ServerName,

				"homeserver_url": matrixClient.config.Matrix.HomeserverURL,

				"opc_username":   opcUser.Username,

				"matrix_username": matrixUsername,

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

// LoginOrRegisterMatrixUser logs in or registers a Matrix user with given credentials

// Returns access_token, user_id, and error

func LoginOrRegisterMatrixUser(matrixClient *MatrixClient, username, password string) (accessToken, userID string, err error) {

	deviceID := "WEB_CLIENT"



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

		return "", "", fmt.Errorf("failed to create request: %w", err)

	}

	httpReq.Header.Set("Content-Type", "application/json")



	client := &http.Client{}

	resp, err := client.Do(httpReq)

	if err != nil {

		return "", "", fmt.Errorf("failed to connect to Matrix: %w", err)

	}

	defer resp.Body.Close()



	respBody, _ := io.ReadAll(resp.Body)



	// If login failed, try to register first

	if resp.StatusCode != http.StatusOK {

		// Try to register the user using shared secret

		regErr := registerMatrixUserInternal(matrixClient, username, password)

		if regErr != nil {

			return "", "", fmt.Errorf("login failed and registration failed. Login: %s, Register: %v", string(respBody), regErr)

		}



		// Retry login after registration

		bodyBytes2, _ := json.Marshal(loginBody)

		httpReq2, err := http.NewRequest("POST", loginURL, bytes.NewBuffer(bodyBytes2))

		if err != nil {

			return "", "", fmt.Errorf("failed to create login request after registration: %w", err)

		}

		httpReq2.Header.Set("Content-Type", "application/json")



		resp2, err := client.Do(httpReq2)

		if err != nil {

			return "", "", fmt.Errorf("failed to login after registration: %w", err)

		}

		defer resp2.Body.Close()



		respBody, _ = io.ReadAll(resp2.Body)

		if resp2.StatusCode != http.StatusOK {

			return "", "", fmt.Errorf("login failed after registration: %s", string(respBody))

		}

	}



	var result MatrixLoginResponse

	if err := json.Unmarshal(respBody, &result); err != nil {

		return "", "", fmt.Errorf("failed to parse login response: %w", err)

	}



	return result.AccessToken, result.UserID, nil

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

		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Unauthorized",
			})
			return
		}

		matrixToken, ok := getMatrixToken(userID.(uint))
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Matrix session not found",
			})
			return
		}
		// Create room via Matrix client-server API
		createURL := fmt.Sprintf("%s/_matrix/client/v3/createRoom", matrixClient.config.Matrix.HomeserverURL)

		preset := "private_chat"
		if req.Visibility == "public" {
			preset = "public_chat"
		}

		roomBody := map[string]interface{}{
			"name":   req.Name,
			"preset":  preset,
		}
		if req.Topic != "" {
			roomBody["topic"] = req.Topic
		}
		if req.Visibility != "" {
			roomBody["visibility"] = req.Visibility
		}
		if len(req.Invite) > 0 {
			roomBody["invite"] = req.Invite
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
		httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", matrixToken))

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

		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Unauthorized",
			})
			return
		}

		matrixToken, ok := getMatrixToken(userID.(uint))
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Matrix session not found",
			})
			return
		}
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
		httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", matrixToken))

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
			// Check if it's a forbidden error (need invite for private room)
			var joinError struct {
				ErrorCode string `json:"errcode"`
				Error     string `json:"error"`
			}
			json.Unmarshal(respBody, &joinError)

			if joinError.ErrorCode == "M_FORBIDDEN" {
				// Use Synapse Admin API to forcibly join the user to the room
				adminToken, err := matrixClient.getAdminToken()
				if err != nil {
					c.JSON(http.StatusInternalServerError, UnifiedResponse{
						Code:    500,
						Message: "Failed to get admin token: " + err.Error(),
					})
					return
				}

				// Get the user's Matrix user ID from OPC user ID
				// Default format is user_{id} which maps to @user_{id}:{server}
				matrixUserID := fmt.Sprintf("@user_%d:%s", userID.(uint), matrixClient.config.Matrix.ServerName)

				// Call Synapse Admin API to join user to room
				adminJoinURL := fmt.Sprintf("%s/_synapse/admin/v1/join/%s", matrixClient.config.Matrix.HomeserverURL, roomID)
				adminJoinBody := map[string]string{"user_id": matrixUserID}
				adminJoinBytes, _ := json.Marshal(adminJoinBody)

				adminReq, err := http.NewRequest("POST", adminJoinURL, bytes.NewBuffer(adminJoinBytes))
				if err != nil {
					c.JSON(http.StatusInternalServerError, UnifiedResponse{
						Code:    500,
						Message: "Failed to create admin join request: " + err.Error(),
					})
					return
				}
				adminReq.Header.Set("Content-Type", "application/json")
				adminReq.Header.Set("Authorization", "Bearer "+adminToken)

				adminResp, err := client.Do(adminReq)
				if err != nil {
					c.JSON(http.StatusInternalServerError, UnifiedResponse{
						Code:    500,
						Message: "Failed to join room via admin API: " + err.Error(),
					})
					return
				}
				defer adminResp.Body.Close()

				adminRespBody, _ := io.ReadAll(adminResp.Body)
				if adminResp.StatusCode != http.StatusOK {
					c.JSON(http.StatusInternalServerError, UnifiedResponse{
						Code:    500,
						Message: fmt.Sprintf("Failed to join room via admin: %s", string(adminRespBody)),
				})
					return
				}

				// Successfully joined via admin API
				c.JSON(http.StatusOK, UnifiedResponse{
					Code:    0,
					Message: "success",
					Data: gin.H{
						"room_id": roomID,
					},
				})
				return
			}

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

// ListMatrixRooms lists all rooms on the Matrix server via Synapse Admin API
// GET /api/matrix/rooms (requires auth)
func ListMatrixRooms(matrixClient *MatrixClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get admin access token
		adminToken, err := matrixClient.getAdminToken()
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to get admin token: " + err.Error(),
			})
			return
		}

		// Call Synapse Admin API: GET /_synapse/admin/v1/rooms
		roomsURL := fmt.Sprintf("%s/_synapse/admin/v1/rooms?limit=100", matrixClient.config.Matrix.HomeserverURL)
		req, _ := http.NewRequest("GET", roomsURL, nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)

		client := &http.Client{Timeout: 15 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to query rooms: " + err.Error(),
			})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: fmt.Sprintf("Synapse Admin API error (%d): %s", resp.StatusCode, string(body)),
			})
			return
		}

		var synapseRooms struct {
			Rooms []struct {
				RoomID            string `json:"room_id"`
				Name              string `json:"name"`
				CanonicalAlias    string `json:"canonical_alias"`
				JoinedMembers     int    `json:"joined_members"`
				JoinedLocalMembers int   `json:"joined_local_members"`
				Version           string `json:"version"`
				Creator           string `json:"creator"`
				Federatable       bool   `json:"federatable"`
				Public            bool   `json:"public"`
			} `json:"rooms"`
			Total  int `json:"total"`
			Offset int `json:"offset"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&synapseRooms); err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to parse rooms response: " + err.Error(),
			})
			return
		}

		// Also get user's joined rooms for marking joined status
		joinedMap := make(map[string]bool)
		userID, exists := c.Get("userID")
		if exists {
			if matrixToken, ok := getMatrixToken(userID.(uint)); ok {
				joinedRoomsURL := fmt.Sprintf("%s/_matrix/client/v3/joined_rooms", matrixClient.config.Matrix.HomeserverURL)
				jReq, _ := http.NewRequest("GET", joinedRoomsURL, nil)
				jReq.Header.Set("Authorization", "Bearer "+matrixToken)
				jResp, jErr := client.Do(jReq)
				if jErr == nil && jResp.StatusCode == http.StatusOK {
					var joinedResult struct {
						JoinedRooms []string `json:"joined_rooms"`
					}
					json.NewDecoder(jResp.Body).Decode(&joinedResult)
					jResp.Body.Close()
					for _, rID := range joinedResult.JoinedRooms {
						joinedMap[rID] = true
					}
				}
			}
		}

		// Build response
		allRooms := make([]gin.H, 0, len(synapseRooms.Rooms))
		for _, r := range synapseRooms.Rooms {
			roomName := r.Name
			if roomName == "" && r.CanonicalAlias != "" {
				roomName = r.CanonicalAlias
			}
			if roomName == "" {
				roomName = r.RoomID
			}
			allRooms = append(allRooms, gin.H{
				"room_id":             r.RoomID,
				"name":                roomName,
				"canonical_alias":     r.CanonicalAlias,
				"joined_members":      r.JoinedMembers,
				"joined_local_members": r.JoinedLocalMembers,
				"creator":             r.Creator,
				"public":              r.Public,
				"joined":              joinedMap[r.RoomID],
			})
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"rooms": allRooms,
				"total": synapseRooms.Total,
			},
		})
	}
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

		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Unauthorized",
			})
			return
		}

		matrixToken, ok := getMatrixToken(userID.(uint))
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Matrix session not found",
			})
			return
		}
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
		httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", matrixToken))

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

		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Unauthorized",
			})
			return
		}

		matrixToken, ok := getMatrixToken(userID.(uint))
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Matrix session not found",
			})
			return
		}
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
		httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", matrixToken))

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
			rooms := getWorkerRooms(matrixClient, workerName)
			isOnline := getWorkerOnlineStatus(matrixClient, workerName, rooms)
			workerInfo := WorkerInfo{
				WorkerID: workerName,
				UserID:   fmt.Sprintf("@%s:%s", workerName, matrixClient.config.Matrix.ServerName),
				Name:     workerName,
				IsOnline: isOnline,
				Rooms:    rooms,
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

// getWorkerOnlineStatus checks if a worker is online by looking at recent STATUS messages
// It finds the LATEST STATUS message from the worker and returns true if it's ONLINE
func getWorkerOnlineStatus(matrixClient *MatrixClient, workerName string, rooms []string) bool {
	if len(rooms) == 0 {
		return false
	}

	// Login as the worker to get access token
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
	httpReq, _ := http.NewRequest("POST", loginURL, bytes.NewBuffer(bodyBytes))
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return false
	}

	var loginResult struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(respBody, &loginResult); err != nil {
		return false
	}

	workerUserID := fmt.Sprintf("@%s:%s", workerName, matrixClient.config.Matrix.ServerName)

	// Track the latest status message from this worker
	type statusInfo struct {
		status    string
		timestamp int64
	}
	var latestStatus *statusInfo

	// Check messages in all rooms for STATUS messages
	for _, roomID := range rooms {
		messagesURL := fmt.Sprintf("%s/_matrix/client/v3/rooms/%s/messages?limit=50&dir=b", 
			matrixClient.config.Matrix.HomeserverURL, roomID)

		msgReq, _ := http.NewRequest("GET", messagesURL, nil)
		msgReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", loginResult.AccessToken))

		msgResp, err := client.Do(msgReq)
		if err != nil {
			continue
		}
		msgRespBody, _ := io.ReadAll(msgResp.Body)
		msgResp.Body.Close()
		
		if msgResp.StatusCode != http.StatusOK {
			continue
		}

		var messagesResult struct {
			Chunk []struct {
				Type           string `json:"type"`
				OriginServerTs int64  `json:"origin_server_ts"`
				Content        struct {
					Body    string `json:"body"`
					MsgType string `json:"msgtype"`
				} `json:"content"`
				Sender string `json:"sender"`
			} `json:"chunk"`
		}
		json.Unmarshal(msgRespBody, &messagesResult)

		// Find STATUS messages from this worker
		for _, msg := range messagesResult.Chunk {
			if msg.Type == "m.room.message" && msg.Sender == workerUserID {
				body := msg.Content.Body
				if strings.HasPrefix(body, "STATUS:") && strings.Contains(body, "|") {
					parts := strings.Split(body, "|")
					if len(parts) >= 2 {
						// Extract worker ID from message and validate
						workerIDInMsg := strings.TrimSpace(parts[1])
						if workerIDInMsg != workerName {
							continue // Skip STATUS messages from other workers
						}
						status := strings.TrimPrefix(parts[0], "STATUS:")
						
						// Update latest status if this message is newer
						if latestStatus == nil || msg.OriginServerTs > latestStatus.timestamp {
							latestStatus = &statusInfo{
								status:    status,
								timestamp: msg.OriginServerTs,
							}
						}
					}
				}
			}
		}
	}

	// Return true only if the latest status is ONLINE
	return latestStatus != nil && latestStatus.status == "ONLINE"
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
                // Need to invite the worker first using caller's Matrix token from cache
                userID, exists := c.Get("userID")
                if !exists {
                    c.JSON(http.StatusInternalServerError, UnifiedResponse{
                        Code:    500,
                        Message: "Unauthorized - cannot invite worker",
                    })
                    return
                }
                
                opcUserID, ok := userID.(uint)
                if !ok {
                    c.JSON(http.StatusInternalServerError, UnifiedResponse{
                        Code:    500,
                        Message: "Invalid user ID type",
                    })
                    return
                }
                
                callerToken, ok := getMatrixToken(opcUserID)
                if !ok || callerToken == "" {
                    c.JSON(http.StatusInternalServerError, UnifiedResponse{
                        Code:    500,
                        Message: "No Matrix token found for user. Please login to Matrix first.",
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
                inviteReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", callerToken))
                
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


// MatrixSyncSSE streams Matrix sync events via SSE
// GET /api/matrix/sync (requires auth)
// DEPRECATED: matrix-js-sdk handles sync internally via startClient()
// This endpoint is kept for backwards compatibility but returns a simple response
func MatrixSyncSSE(matrixClient *MatrixClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{Code: 401, Message: "Unauthorized"})
			return
		}

		// matrix-js-sdk handles sync internally via startClient()
		// This SSE endpoint is deprecated and not needed
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "OK",
			Data:    "SSE not needed - matrix-js-sdk handles sync via startClient()",
		})
	}
}


// MatrixUserInfo represents a user on the Matrix server
type MatrixUserInfo struct {
	UserID      string `json:"user_id"`
	Name        string `json:"name"`
	DisplayName string `json:"display_name,omitempty"`
}

// getAdminToken logs in as admin and returns access token for Synapse Admin API
// Uses cache to avoid rate limiting
func (mc *MatrixClient) getAdminToken() (string, error) {
	// Check cache first
	adminTokenMutex.RLock()
	if adminTokenCache != "" && time.Now().Before(adminTokenExpiry) {
		token := adminTokenCache
		adminTokenMutex.RUnlock()
		return token, nil
	}
	adminTokenMutex.RUnlock()

	// Need to login
	loginURL := fmt.Sprintf("%s/_matrix/client/v3/login", mc.config.Matrix.HomeserverURL)
	loginBody := map[string]string{
		"type":     "m.login.password",
		"user":     mc.config.Matrix.AdminUser,
		"password": mc.config.Matrix.AdminPassword,
	}
	bodyBytes, _ := json.Marshal(loginBody)

	resp, err := http.Post(loginURL, "application/json", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("admin login failed: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("parse admin login response failed: %w", err)
	}
	if result.AccessToken == "" {
		return "", fmt.Errorf("admin login returned empty token")
	}

	// Cache the token for 1 hour
	adminTokenMutex.Lock()
	adminTokenCache = result.AccessToken
	adminTokenExpiry = time.Now().Add(1 * time.Hour)
	adminTokenMutex.Unlock()

	return result.AccessToken, nil
}

// ListMatrixUsers lists all users on the Matrix server via Synapse Admin API
// GET /api/matrix/users (requires auth)
func ListMatrixUsers(matrixClient *MatrixClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get admin access token
		adminToken, err := matrixClient.getAdminToken()
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to get admin token: " + err.Error(),
			})
			return
		}

		// Call Synapse Admin API: GET /_synapse/admin/v2/users
		usersURL := fmt.Sprintf("%s/_synapse/admin/v2/users?limit=100", matrixClient.config.Matrix.HomeserverURL)
		req, _ := http.NewRequest("GET", usersURL, nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)

		client := &http.Client{Timeout: 15 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to query users: " + err.Error(),
			})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: fmt.Sprintf("Synapse Admin API error (%d): %s", resp.StatusCode, string(body)),
			})
			return
		}

		var synapseUsers struct {
			Users []struct {
				Name        string `json:"name"`
				DisplayName string `json:"displayname"`
			} `json:"users"`
			Total int `json:"total"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&synapseUsers); err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to parse users response: " + err.Error(),
			})
			return
		}

		// Convert to MatrixUserInfo
		matrixUsers := make([]MatrixUserInfo, 0, len(synapseUsers.Users))
		for _, u := range synapseUsers.Users {
			localpart := u.Name
			if strings.HasPrefix(localpart, "@") {
				if idx := strings.Index(localpart, ":"); idx > 0 {
					localpart = localpart[1:idx]
				}
			}
			displayName := u.DisplayName
			if displayName == "" {
				displayName = localpart
			}
			matrixUsers = append(matrixUsers, MatrixUserInfo{
				UserID:      u.Name,
				Name:        localpart,
				DisplayName: displayName,
			})
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"users": matrixUsers,
				"total": synapseUsers.Total,
			},
		})
	}
}

// CreateTaskChatRoom creates a chat room for a task and invites the publisher
// POST /api/task/:id/chat-room (requires auth)
func CreateTaskChatRoom(matrixClient *MatrixClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		taskID := c.Param("id")
		if taskID == "" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "Task ID is required",
			})
			return
		}

		// Get current user ID
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Unauthorized",
			})
			return
		}

		// Get matrix token
		matrixToken, ok := getMatrixToken(userID.(uint))
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Matrix session not found",
			})
			return
		}

		// Parse request body
		var req struct {
			Name  string `json:"name"`
			Topic string `json:"topic"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "Invalid request: " + err.Error(),
			})
			return
		}

		// Get task info
		var task struct {
			ID     uint
			Title  string
			UserID uint
		}
		if err := matrixClient.db.Table("tasks").Select("id, title, user_id").Where("id = ?", taskID).First(&task).Error; err != nil {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "Task not found",
			})
			return
		}

		// Get publisher's matrix username
		var publisher struct {
			MatrixUsername string
		}
		if err := matrixClient.db.Table("users").Select("matrix_username").Where("id = ?", task.UserID).First(&publisher).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to get publisher info",
			})
			return
		}

		// Build room name
		roomName := req.Name
		if roomName == "" {
			title := task.Title
			if len(title) > 10 {
				title = title[:10]
			}
			roomName = fmt.Sprintf("任务#%d-%s", task.ID, title)
		}

		// Build publisher's Matrix user ID
		publisherMatrixID := fmt.Sprintf("@%s:localhost", publisher.MatrixUsername)

		// Get current user's Matrix username to check if they're the publisher
		var currentUser struct {
			MatrixUsername string
		}
		if err := matrixClient.db.Table("users").Select("matrix_username").Where("id = ?", userID.(uint)).First(&currentUser).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to get current user info",
			})
			return
		}

		// Check if current user is the publisher (don't invite self)
		isPublisher := task.UserID == userID.(uint)

		// Create room
		createURL := fmt.Sprintf("%s/_matrix/client/v3/createRoom", matrixClient.config.Matrix.HomeserverURL)
		roomBody := map[string]interface{}{
			"name":   roomName,
			"preset": "private_chat",
			"topic":  req.Topic,
		}

		// Only invite publisher if current user is NOT the publisher
		if !isPublisher {
			roomBody["invite"] = []string{publisherMatrixID}
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
		httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", matrixToken))

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

		// Handle Matrix errors gracefully
		if resp.StatusCode != http.StatusOK {
			// Parse error to check if it's "already in room" issue
			var matrixErr struct {
				ErrorCode string `json:"errcode"`
				Error     string `json:"error"`
			}
			json.Unmarshal(respBody, &matrixErr)

			// If user already in room, this might be a duplicate request
			// Try to find existing room by name
			if strings.Contains(matrixErr.Error, "already") || matrixErr.ErrorCode == "M_FORBIDDEN" {
				// Try to find the room by name
				adminToken, err := matrixClient.getAdminToken()
				if err == nil {
					roomsURL := fmt.Sprintf("%s/_synapse/admin/v1/rooms?search=%s", matrixClient.config.Matrix.HomeserverURL, url.QueryEscape(roomName))
					adminReq, _ := http.NewRequest("GET", roomsURL, nil)
					adminReq.Header.Set("Authorization", "Bearer "+adminToken)
					adminResp, adminErr := client.Do(adminReq)
					if adminErr == nil && adminResp.StatusCode == http.StatusOK {
						var roomsResult struct {
							Rooms []struct {
								RoomID string `json:"room_id"`
								Name   string `json:"name"`
							} `json:"rooms"`
						}
						adminRespBody, _ := io.ReadAll(adminResp.Body)
						adminResp.Body.Close()
						json.Unmarshal(adminRespBody, &roomsResult)
						for _, r := range roomsResult.Rooms {
							if r.Name == roomName {
								c.JSON(http.StatusOK, UnifiedResponse{
									Code:    0,
									Message: "success",
									Data: gin.H{
										"room_id":   r.RoomID,
										"room_name": roomName,
										"is_new":    false,
									},
								})
								return
							}
						}
					}
				}
			}

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
				"room_id":   result.RoomID,
				"room_name": roomName,
				"is_new":    true,
			},
		})
	}
}
