package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"maunium.net/go/mautrix"
	"maunium.net/go/mautrix/event"
	"maunium.net/go/mautrix/id"
)

var llmConfigured bool = false
var llmApiKey string = ""
var llmBaseUrl string = ""
var llmModel string = ""

func askLightAgent(query string) string {
	lightAgentURL := os.Getenv("LIGHT_AGENT_URL")
	if lightAgentURL == "" {
		lightAgentURL = "http://localhost:3000/api/chat"
	}

	reqBody, _ := json.Marshal(map[string]interface{}{
		"query":   query,
		"apiKey":  llmApiKey,
		"baseUrl": llmBaseUrl,
		"model":   llmModel,
	})

	resp, err := http.Post(lightAgentURL, "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		return fmt.Sprintf("调用 light-agent 失败: %v", err)
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	var jsonResp map[string]interface{}
	if err := json.Unmarshal(body, &jsonResp); err == nil {
		if text, ok := jsonResp["response"].(string); ok {
			return text
		}
		if reply, ok := jsonResp["reply"].(string); ok {
			return reply
		}
	}

	return string(body)
}

func main() {
	workerID := os.Getenv("WORKER_ID")
	if workerID == "" {
		workerID = "worker-001"
	}

	homeserverURL := os.Getenv("HOMESERVER_URL")
	if homeserverURL == "" {
		homeserverURL = "http://localhost:8008" // Use http://dendrite:8008 in docker-compose
	}

	password := os.Getenv("WORKER_PASSWORD")
	if password == "" {
		password = "password"
	}

	roomAlias := os.Getenv("COMMAND_ROOM_ALIAS")
	if roomAlias == "" {
		roomAlias = "#command_center:localhost"
	}

	userID := id.UserID(fmt.Sprintf("@%s:localhost", workerID))

	client, err := mautrix.NewClient(homeserverURL, userID, "")
	if err != nil {
		panic(fmt.Errorf("failed to create client: %w", err))
	}

	// Login
	fmt.Printf("Logging in as %s...\n", userID)
	loginResp, err := client.Login(context.Background(), &mautrix.ReqLogin{
		Type: mautrix.AuthTypePassword,
		Identifier: mautrix.UserIdentifier{
			Type: mautrix.IdentifierTypeUser,
			User: string(userID),
		},
		Password: password,
	})
	if err != nil {
		panic(fmt.Errorf("failed to login: %w", err))
	}
	fmt.Printf("Login successful. AccessToken: %s\n", loginResp.AccessToken)
	client.AccessToken = loginResp.AccessToken

	// Resolve room alias to room ID
	resp, err := client.ResolveAlias(context.Background(), id.RoomAlias(roomAlias))
	if err != nil {
		panic(fmt.Errorf("failed to resolve room alias %s: %w", roomAlias, err))
	}
	roomID := resp.RoomID

	// Join the command center room
	_, err = client.JoinRoomByID(context.Background(), roomID)
	if err != nil {
		fmt.Printf("Failed to join room (might already be in it): %v\n", err)
	} else {
		fmt.Printf("Joined room %s\n", roomID)
	}

	// Announce presence
	statusMsg := fmt.Sprintf("STATUS:ONLINE|%s", workerID)
	_, err = client.SendMessageEvent(context.Background(), roomID, event.EventMessage, &event.MessageEventContent{
		MsgType: event.MsgNotice,
		Body:    statusMsg,
	})
	if err != nil {
		fmt.Printf("Failed to send status message: %v\n", err)
	}

	// Setup syncer
	syncer := client.Syncer.(*mautrix.DefaultSyncer)
	syncer.OnEventType(event.EventMessage, func(ctx context.Context, evt *event.Event) {
		// Ignore own messages
		if evt.Sender == client.UserID {
			return
		}

		msg := evt.Content.AsMessage()
		if msg == nil {
			return
		}

		// Check if the message mentions this worker
		mention := fmt.Sprintf("@%s", workerID)
		if strings.Contains(msg.Body, mention) {
			fmt.Printf("Received command from %s: %s\n", evt.Sender, msg.Body)

			// Extract the actual message content
			xxx := strings.TrimSpace(strings.Replace(msg.Body, mention, "", 1))
			
			var replyBody string
			if strings.HasPrefix(xxx, "CONFIG_JSON:") {
				jsonStr := strings.TrimSpace(strings.TrimPrefix(xxx, "CONFIG_JSON:"))
				var config map[string]string
				if err := json.Unmarshal([]byte(jsonStr), &config); err == nil {
					if key, ok := config["apiKey"]; ok && key != "" {
						llmApiKey = key
						llmConfigured = true
					}
					if baseUrl, ok := config["baseUrl"]; ok {
						llmBaseUrl = baseUrl
					}
					if model, ok := config["model"]; ok {
						llmModel = model
					}
					replyBody = fmt.Sprintf("%s，大模型参数配置成功！", evt.Sender)
				} else {
					replyBody = fmt.Sprintf("%s，大模型配置失败，JSON格式错误。", evt.Sender)
				}
			} else if strings.HasPrefix(xxx, "配置模型 ") {
				llmApiKey = strings.TrimSpace(strings.TrimPrefix(xxx, "配置模型 "))
				llmConfigured = true
				replyBody = fmt.Sprintf("%s，大模型配置成功！", evt.Sender)
			} else if !llmConfigured {
				replyBody = fmt.Sprintf("%s，还没有配置大模型，你可以发【配置模型 你的API_KEY】给我配置大模型", evt.Sender)
			} else {
				// Call light-agent
				agentResponse := askLightAgent(xxx)
				replyBody = fmt.Sprintf("%s，已收到你的信息 %s\n[LightAgent回复]: %s", evt.Sender, xxx, agentResponse)
			}

			_, err := client.SendMessageEvent(context.Background(), evt.RoomID, event.EventMessage, &event.MessageEventContent{
				MsgType: event.MsgText,
				Body:    replyBody,
			})
			if err != nil {
				fmt.Printf("Failed to send reply: %v\n", err)
			}
		}
	})

	fmt.Println("Starting sync...")
	go func() {
		err = client.Sync()
		if err != nil {
			fmt.Printf("Sync failed: %v\n", err)
		}
	}()

	// Wait for interrupt
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c

	// Send offline status before exiting
	fmt.Println("Shutting down...")
	offlineMsg := fmt.Sprintf("STATUS:OFFLINE|%s", workerID)
	client.SendMessageEvent(context.Background(), roomID, event.EventMessage, &event.MessageEventContent{
		MsgType: event.MsgNotice,
		Body:    offlineMsg,
	})

	client.StopSync()
}
