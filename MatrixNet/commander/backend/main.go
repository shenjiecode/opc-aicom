package main

import (
	"context"
	"fmt"
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

var (
	workers      = make(map[string]*Worker)
	workersMutex sync.RWMutex

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
			} else if status == "STATUS:OFFLINE" {
				delete(workers, workerID)
				fmt.Printf("Worker %s went offline.\n", workerID)
			}
			workersMutex.Unlock()
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
