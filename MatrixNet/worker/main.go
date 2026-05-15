package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"maunium.net/go/mautrix"
	"maunium.net/go/mautrix/event"
	"maunium.net/go/mautrix/id"
)

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
			replyBody := fmt.Sprintf("%s，已收到你的信息 %s", evt.Sender, xxx)

			// Optional: if the commander was mentioned in the command, mention them back,
			// or just reply in the room
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
