package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"maunium.net/go/mautrix"
	"maunium.net/go/mautrix/event"
	"maunium.net/go/mautrix/id"
)

type Worker struct {
	ID       string    `json:"id"`
	LastSeen time.Time `json:"last_seen"`
}

type Message struct {
	ID        string    `json:"id"`
	Sender    string    `json:"sender"`
	Body      string    `json:"body"`
	Timestamp time.Time `json:"timestamp"`
}

type WorkerConfig struct {
	ApiKey   string `json:"apiKey"`
	BaseUrl  string `json:"baseUrl"`
	Model    string `json:"model"`
	SmtpHost string `json:"smtpHost"`
	SmtpPort string `json:"smtpPort"`
	SmtpUser string `json:"smtpUser"`
	SmtpPass string `json:"smtpPass"`
}

var (
	workers      = make(map[string]*Worker)
	workersMutex sync.RWMutex

	workerConfigs      = make(map[string]WorkerConfig)
	workerConfigsMutex sync.RWMutex

	messages      = make([]Message, 0)
	messagesMutex sync.RWMutex

	client *mautrix.Client
	roomID id.RoomID
)

func main() {
	homeserverURL := os.Getenv("HOMESERVER_URL")
	if homeserverURL == "" {
		homeserverURL = "http://localhost:8008"
	}

	commanderID := os.Getenv("COMMANDER_ID")
	if commanderID == "" {
		commanderID = "commander"
	}

	password := os.Getenv("COMMANDER_PASSWORD")
	if password == "" {
		password = "password"
	}

	roomAlias := os.Getenv("COMMAND_ROOM_ALIAS")
	if roomAlias == "" {
		roomAlias = "#command_center:localhost"
	}

	userID := id.UserID(fmt.Sprintf("@%s:localhost", commanderID))

	var err error
	client, err = mautrix.NewClient(homeserverURL, userID, "")
	if err != nil {
		panic(err)
	}

	fmt.Printf("Commander logging in as %s...\n", userID)
	loginResp, err := client.Login(context.Background(), &mautrix.ReqLogin{
		Type: mautrix.AuthTypePassword,
		Identifier: mautrix.UserIdentifier{
			Type: mautrix.IdentifierTypeUser,
			User: string(userID),
		},
		Password: password,
	})
	if err != nil {
		panic(err)
	}
	client.AccessToken = loginResp.AccessToken
	fmt.Println("Login successful.")

	resp, err := client.ResolveAlias(context.Background(), id.RoomAlias(roomAlias))
	if err != nil {
		panic(fmt.Errorf("failed to resolve room alias %s: %w", roomAlias, err))
	}
	roomID = resp.RoomID

	_, err = client.JoinRoomByID(context.Background(), roomID)
	if err != nil {
		fmt.Printf("Failed to join room: %v\n", err)
	} else {
		fmt.Printf("Joined room %s\n", roomID)
	}

	syncer := client.Syncer.(*mautrix.DefaultSyncer)
	syncer.OnEventType(event.EventMessage, handleMessage)

	go func() {
		fmt.Println("Starting Matrix sync...")
		err = client.Sync()
		if err != nil {
			fmt.Printf("Sync failed: %v\n", err)
		}
	}()

	r := gin.Default()
	r.Use(cors.Default())

	api := r.Group("/api")
	{
		api.GET("/workers", getWorkers)
		api.POST("/send", sendMessage)
		api.GET("/messages", getMessages)
		api.GET("/workers/:id/config", getWorkerConfig)
		api.POST("/workers/:id/config", setWorkerConfig)
	}

	fmt.Println("Starting Commander API on :8081")
	r.Run(":8081")
}

func handleMessage(ctx context.Context, evt *event.Event) {
	msg := evt.Content.AsMessage()
	if msg == nil {
		return
	}

	senderStr := string(evt.Sender)

	// Check if it's a status message
	if msg.MsgType == event.MsgNotice && strings.HasPrefix(msg.Body, "STATUS:") {
		parts := strings.Split(msg.Body, "|")
		if len(parts) == 2 {
			status := parts[0]
			workerID := parts[1]

			workersMutex.Lock()
			if status == "STATUS:ONLINE" {
				workers[workerID] = &Worker{
					ID:       workerID,
					LastSeen: time.Now(),
				}
				fmt.Printf("Worker %s came online.\n", workerID)

				// Resend config if exists
				workerConfigsMutex.RLock()
				cfg, exists := workerConfigs[workerID]
				workerConfigsMutex.RUnlock()
				if exists {
					configJSON, _ := json.Marshal(cfg)
					msgBody := fmt.Sprintf("@%s CONFIG_JSON:%s", workerID, string(configJSON))
					go client.SendMessageEvent(context.Background(), roomID, event.EventMessage, &event.MessageEventContent{
						MsgType: event.MsgText,
						Body:    msgBody,
					})
				}
			} else if status == "STATUS:OFFLINE" {
				delete(workers, workerID)
				fmt.Printf("Worker %s went offline.\n", workerID)
			}
			workersMutex.Unlock()
		}
	}

	// Intercept CONFIG_JSON to keep Commander memory in sync
	if strings.Contains(msg.Body, "CONFIG_JSON:") {
		parts := strings.Split(msg.Body, " ")
		for _, part := range parts {
			if strings.HasPrefix(part, "@") {
				workerID := strings.TrimPrefix(part, "@")
				idx := strings.Index(msg.Body, "CONFIG_JSON:")
				if idx != -1 {
					jsonStr := strings.TrimSpace(msg.Body[idx+len("CONFIG_JSON:"):])
					var config WorkerConfig
					if err := json.Unmarshal([]byte(jsonStr), &config); err == nil {
						workerConfigsMutex.Lock()
						workerConfigs[workerID] = config
						workerConfigsMutex.Unlock()
						fmt.Printf("Intercepted and updated config for %s\n", workerID)
					}
				}
				break
			}
		}
	}

	// Store message
	messagesMutex.Lock()
	messages = append(messages, Message{
		ID:        string(evt.ID),
		Sender:    senderStr,
		Body:      msg.Body,
		Timestamp: time.UnixMilli(evt.Timestamp),
	})
	// Keep last 100 messages
	if len(messages) > 100 {
		messages = messages[len(messages)-100:]
	}
	messagesMutex.Unlock()
}

func getWorkers(c *gin.Context) {
	workersMutex.RLock()
	defer workersMutex.RUnlock()

	list := make([]*Worker, 0, len(workers))
	for _, w := range workers {
		list = append(list, w)
	}
	c.JSON(http.StatusOK, list)
}

func getMessages(c *gin.Context) {
	messagesMutex.RLock()
	defer messagesMutex.RUnlock()
	c.JSON(http.StatusOK, messages)
}

type SendRequest struct {
	Text   string `json:"text" binding:"required"`
	Sender string `json:"sender"`
}

func sendMessage(c *gin.Context) {
	var req SendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Default to commander if no sender specified
	senderID := req.Sender
	if senderID == "" {
		senderID = "commander"
	}

	// Try to find the client for this sender
	// For commander, we already have the global client
	// For workers, we'd theoretically need their client/token
	// Since this is a "simulation" of remote control for testing,
	// we will use the commander client but prefix the message to indicate simulation,
	// OR we can create a temporary client for the worker to send the message.
	//
	// For true remote control simulation in this demo, we'll prefix the body
	// if it's not the commander sending it, so it appears as if the worker sent it.
	// A better way would be using the worker's token, but that requires storing tokens.

	// Temporary implementation: Use commander client to send, but format it
	// In a real system, you'd want the actual worker client to send this.
	// Since we are simulating, we'll just send it. If we want it to *actually* come from the worker,
	// we need to login as the worker here. Let's do that for the simulation.

	var sendClient *mautrix.Client
	if senderID == "commander" {
		sendClient = client
	} else {
		// Create a temporary client for the worker to send the message
		userID := id.UserID(fmt.Sprintf("@%s:localhost", senderID))
		homeserverURL := os.Getenv("HOMESERVER_URL")
		if homeserverURL == "" {
			homeserverURL = "http://localhost:8008"
		}

		tempClient, err := mautrix.NewClient(homeserverURL, userID, "")
		if err == nil {
			loginResp, err := tempClient.Login(context.Background(), &mautrix.ReqLogin{
				Type: mautrix.AuthTypePassword,
				Identifier: mautrix.UserIdentifier{
					Type: mautrix.IdentifierTypeUser,
					User: string(userID),
				},
				// We assume password is 'password' for all workers in this demo
				Password: "password",
			})
			if err == nil {
				tempClient.AccessToken = loginResp.AccessToken
				sendClient = tempClient
			}
		}
	}

	if sendClient == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create client for sender"})
		return
	}

	_, err := sendClient.SendMessageEvent(context.Background(), roomID, event.EventMessage, &event.MessageEventContent{
		MsgType: event.MsgText,
		Body:    req.Text,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send message to Matrix"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func getWorkerConfig(c *gin.Context) {
	id := c.Param("id")
	workerConfigsMutex.RLock()
	config, exists := workerConfigs[id]
	workerConfigsMutex.RUnlock()

	// Read MCP config for default SMTP values
	mcpConfigPath := "../../light-agent-server/mcp_servers.json"
	mcpBytes, err := ioutil.ReadFile(mcpConfigPath)
	if err == nil {
		var mcpData map[string]interface{}
		if json.Unmarshal(mcpBytes, &mcpData) == nil {
			if mcpServers, ok := mcpData["mcpServers"].(map[string]interface{}); ok {
				if emailSender, ok := mcpServers["email-sender"].(map[string]interface{}); ok {
					if env, ok := emailSender["env"].(map[string]interface{}); ok {
						if config.SmtpHost == "" {
							config.SmtpHost, _ = env["SMTP_HOST"].(string)
						}
						if config.SmtpPort == "" {
							config.SmtpPort, _ = env["SMTP_PORT"].(string)
						}
						if config.SmtpUser == "" {
							config.SmtpUser, _ = env["SMTP_USER"].(string)
						}
						if config.SmtpPass == "" {
							config.SmtpPass, _ = env["SMTP_PASS"].(string)
						}
					}
				}
			}
		}
	}

	if !exists && config.SmtpHost == "" && config.SmtpPort == "" && config.SmtpUser == "" && config.SmtpPass == "" {
		c.JSON(http.StatusOK, WorkerConfig{})
		return
	}
	c.JSON(http.StatusOK, config)
}

func setWorkerConfig(c *gin.Context) {
	id := c.Param("id")
	var req WorkerConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	workerConfigsMutex.Lock()
	workerConfigs[id] = req
	workerConfigsMutex.Unlock()

	// Save to MCP config file
	mcpConfigPath := "../../light-agent-server/mcp_servers.json"
	mcpBytes, err := ioutil.ReadFile(mcpConfigPath)
	if err == nil {
		var mcpData map[string]interface{}
		if json.Unmarshal(mcpBytes, &mcpData) == nil {
			if mcpServers, ok := mcpData["mcpServers"].(map[string]interface{}); ok {
				if emailSender, ok := mcpServers["email-sender"].(map[string]interface{}); ok {
					if env, ok := emailSender["env"].(map[string]interface{}); ok {
						if req.SmtpHost != "" {
							env["SMTP_HOST"] = req.SmtpHost
						}
						if req.SmtpPort != "" {
							env["SMTP_PORT"] = req.SmtpPort
						}
						if req.SmtpUser != "" {
							env["SMTP_USER"] = req.SmtpUser
						}
						if req.SmtpPass != "" {
							env["SMTP_PASS"] = req.SmtpPass
						}

						newMcpBytes, _ := json.MarshalIndent(mcpData, "", "  ")
						ioutil.WriteFile(mcpConfigPath, newMcpBytes, 0644)
					}
				}
			}
		}
	}

	configJSON, _ := json.Marshal(req)
	msgBody := fmt.Sprintf("@%s CONFIG_JSON:%s", id, string(configJSON))

	_, err = client.SendMessageEvent(context.Background(), roomID, event.EventMessage, &event.MessageEventContent{
		MsgType: event.MsgText,
		Body:    msgBody,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send config to worker"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
