package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"maunium.net/go/mautrix"
	"maunium.net/go/mautrix/event"
	"maunium.net/go/mautrix/id"
)

// Global state
var (
	llmConfigured bool = false
	llmApiKey     string = ""
	llmBaseUrl    string = ""
	llmModel      string = ""
	smtpHost      string = ""
	smtpPort      string = ""
	smtpUser      string = ""
	smtpPass      string = ""

	// Health check state
	startTime   time.Time
	isConnected bool
	healthMutex sync.RWMutex
)

// Config from flags/env
type Config struct {
	WorkerID      string
	HomeserverURL string
	ServerName    string // Matrix server name (e.g., 8.217.143.228)
	Password      string
	RoomAlias     string
	PIDDir        string
	HealthPort    int
	ConfigFile    string // Path to config file for persistence
}

// WorkerConfig represents the persistent configuration
type WorkerConfig struct {
	LLMApiKey     string `json:"llmApiKey"`
	LLMBaseUrl    string `json:"llmBaseUrl"`
	LLMModel      string `json:"llmModel"`
	LLMConfigured bool   `json:"llmConfigured"`
	SMTPHost      string `json:"smtpHost"`
	SMTPPort      string `json:"smtpPort"`
	SMTPUser      string `json:"smtpUser"`
	SMTPPass      string `json:"smtpPass"`
}

func parseFlags() *Config {
	cfg := &Config{}

	flag.StringVar(&cfg.WorkerID, "worker-id", "", "Worker identifier (required)")
	flag.StringVar(&cfg.HomeserverURL, "homeserver", "http://localhost:8008", "Matrix homeserver URL")
	flag.StringVar(&cfg.ServerName, "server-name", "localhost", "Matrix server name for user ID")
	flag.StringVar(&cfg.Password, "password", "password", "Worker password")
	flag.StringVar(&cfg.RoomAlias, "room", "#command_center:localhost", "Command room alias")
	flag.StringVar(&cfg.PIDDir, "pid-dir", "/tmp", "Directory for PID files")
	flag.IntVar(&cfg.HealthPort, "health-port", 8080, "Health check HTTP port")
	flag.StringVar(&cfg.ConfigFile, "config", "/app/config/worker.json", "Path to config file for persistence")

	flag.Parse()

	// Override with env vars if set
	if v := os.Getenv("WORKER_ID"); v != "" {
		cfg.WorkerID = v
	}
	if v := os.Getenv("HOMESERVER_URL"); v != "" {
		cfg.HomeserverURL = v
	}
	if v := os.Getenv("SERVER_NAME"); v != "" {
		cfg.ServerName = v
	}
	if v := os.Getenv("WORKER_PASSWORD"); v != "" {
		cfg.Password = v
	}
	if v := os.Getenv("COMMAND_ROOM_ALIAS"); v != "" {
		cfg.RoomAlias = v
	}
	if v := os.Getenv("PID_DIR"); v != "" {
		cfg.PIDDir = v
	}
	if v := os.Getenv("HEALTH_PORT"); v != "" {
		if port, err := strconv.Atoi(v); err == nil {
			cfg.HealthPort = port
		}
	}
	if v := os.Getenv("CONFIG_FILE"); v != "" {
		cfg.ConfigFile = v
	}

	return cfg
}

// saveConfig saves current config to file
func saveConfig(cfg *Config) error {
	if cfg.ConfigFile == "" {
		return nil // No config file specified
	}

	workerCfg := WorkerConfig{
		LLMApiKey:     llmApiKey,
		LLMBaseUrl:    llmBaseUrl,
		LLMModel:      llmModel,
		LLMConfigured: llmConfigured,
		SMTPHost:      smtpHost,
		SMTPPort:      smtpPort,
		SMTPUser:      smtpUser,
		SMTPPass:      smtpPass,
	}

	data, err := json.MarshalIndent(workerCfg, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Ensure directory exists
	dir := filepath.Dir(cfg.ConfigFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	if err := os.WriteFile(cfg.ConfigFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	fmt.Printf("[INFO] Config saved to: %s\n", cfg.ConfigFile)
	return nil
}

// loadConfig loads config from file
func loadConfig(cfg *Config) error {
	if cfg.ConfigFile == "" {
		return nil // No config file specified
	}

	data, err := os.ReadFile(cfg.ConfigFile)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Printf("[INFO] No config file found at %s, starting fresh\n", cfg.ConfigFile)
			return nil
		}
		return fmt.Errorf("failed to read config file: %w", err)
	}

	var workerCfg WorkerConfig
	if err := json.Unmarshal(data, &workerCfg); err != nil {
		return fmt.Errorf("failed to parse config file: %w", err)
	}

	// Apply loaded config to global variables
	llmApiKey = workerCfg.LLMApiKey
	llmBaseUrl = workerCfg.LLMBaseUrl
	llmModel = workerCfg.LLMModel
	llmConfigured = workerCfg.LLMConfigured
	smtpHost = workerCfg.SMTPHost
	smtpPort = workerCfg.SMTPPort
	smtpUser = workerCfg.SMTPUser
	smtpPass = workerCfg.SMTPPass

	fmt.Printf("[INFO] Config loaded from: %s\n", cfg.ConfigFile)
	if llmConfigured {
		fmt.Printf("[INFO] LLM configured with model: %s\n", llmModel)
	}
	return nil
}

// PID file lock - prevent multiple instances
func acquirePIDLock(cfg *Config) error {
	pidPath := filepath.Join(cfg.PIDDir, fmt.Sprintf("%s.pid", cfg.WorkerID))

	currentPID := os.Getpid()

	// Check if process already running
	if data, err := os.ReadFile(pidPath); err == nil {
		pidStr := strings.TrimSpace(string(data))
		pid, err := strconv.Atoi(pidStr)
		if err == nil && pid > 0 {
			// If PID matches our own, it's a stale file from container restart
			if pid == currentPID {
				fmt.Printf("[INFO] Stale PID file found with own PID %d (container restart), removing...\n", pid)
				os.Remove(pidPath)
			} else {
				// Check if another process exists
				process, err := os.FindProcess(pid)
				if err == nil {
					// Signal(0) checks if process is alive without killing it
					if process.Signal(syscall.Signal(0)) == nil {
						return fmt.Errorf("worker %s already running (PID: %d)", cfg.WorkerID, pid)
					}
				}
				fmt.Printf("[INFO] Stale PID file found (PID %d no longer running), removing...\n", pid)
				os.Remove(pidPath)
			}
		} else {
			os.Remove(pidPath)
		}
	}

	// Create PID file
	f, err := os.Create(pidPath)
	if err != nil {
		return fmt.Errorf("failed to create PID file: %w", err)
	}
	defer f.Close()

	fmt.Fprintf(f, "%d\n", os.Getpid())
	fmt.Printf("[INFO] PID file created: %s (PID: %d)\n", pidPath, os.Getpid())

	return nil
}

func releasePIDLock(cfg *Config) {
	pidPath := filepath.Join(cfg.PIDDir, fmt.Sprintf("%s.pid", cfg.WorkerID))
	os.Remove(pidPath)
	fmt.Printf("[INFO] PID file removed: %s\n", pidPath)
}

// Health check HTTP server
func startHealthServer(cfg *Config, client *mautrix.Client, workerID string) {
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		healthMutex.RLock()
		connected := isConnected
		healthMutex.RUnlock()

		status := map[string]interface{}{
			"worker_id":  workerID,
			"pid":        os.Getpid(),
			"uptime_sec": time.Since(startTime).Seconds(),
			"connected":  connected,
			"timestamp":  time.Now().Unix(),
			"llm_ready":  llmConfigured,
		}

		statusCode := 200
		status["status"] = "healthy"

		if !connected {
			statusCode = 503
			status["status"] = "unhealthy"
			status["reason"] = "Matrix not connected"
		} else if !llmConfigured {
			status["status"] = "degraded"
			status["reason"] = "LLM not configured"
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)
		json.NewEncoder(w).Encode(status)
	})

	http.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		healthMutex.RLock()
		connected := isConnected
		healthMutex.RUnlock()

		if connected {
			w.WriteHeader(200)
			fmt.Fprintf(w, "OK")
		} else {
			w.WriteHeader(503)
			fmt.Fprintf(w, "Not ready")
		}
	})

	addr := fmt.Sprintf(":%d", cfg.HealthPort)
	fmt.Printf("[INFO] Health server starting on %s\n", addr)

	go func() {
		if err := http.ListenAndServe(addr, nil); err != nil {
			fmt.Printf("[WARN] Health server error: %v\n", err)
		}
	}()
}

// LightAgent API call
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
		"smtpConfig": map[string]string{
			"host": smtpHost,
			"port": smtpPort,
			"user": smtpUser,
			"pass": smtpPass,
		},
	})

	resp, err := http.Post(lightAgentURL, "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		return fmt.Sprintf("调用 light-agent 失败: %v", err)
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		bodyStr := string(body)
		if len(bodyStr) > 200 {
			bodyStr = bodyStr[:200] + "..."
		}
		return fmt.Sprintf("LightAgent 请求失败，状态码: %d，内容: %s", resp.StatusCode, bodyStr)
	}

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

// Send status message
func sendStatus(client *mautrix.Client, roomID id.RoomID, workerID string, online bool) {
	status := "OFFLINE"
	if online {
		status = "ONLINE"
	}
	msg := fmt.Sprintf("STATUS:%s|%s", status, workerID)

	_, err := client.SendMessageEvent(context.Background(), roomID, event.EventMessage, &event.MessageEventContent{
		MsgType: event.MsgNotice,
		Body:    msg,
	})

	if err != nil {
		fmt.Printf("[WARN] Failed to send status message: %v\n", err)
	} else {
		fmt.Printf("[INFO] Status sent: %s\n", msg)
	}
}

func main() {
	startTime = time.Now()

	// Parse configuration
	cfg := parseFlags()

	if cfg.WorkerID == "" {
		fmt.Println("[ERROR] -worker-id is required")
		flag.Usage()
		os.Exit(1)
	}

	fmt.Printf("[INFO] Starting worker: %s\n", cfg.WorkerID)
	fmt.Printf("[INFO] Configuration:\n")
	fmt.Printf("  - Homeserver: %s\n", cfg.HomeserverURL)
	fmt.Printf("  - Room: %s\n", cfg.RoomAlias)
	fmt.Printf("  - Health Port: %d\n", cfg.HealthPort)
	fmt.Printf("  - PID Dir: %s\n", cfg.PIDDir)
	fmt.Printf("  - Config File: %s\n", cfg.ConfigFile)

	// Load config from file (if exists)
	if err := loadConfig(cfg); err != nil {
		fmt.Printf("[WARN] Failed to load config: %v\n", err)
	}

	// Acquire PID lock (prevent multiple instances)
	if err := acquirePIDLock(cfg); err != nil {
		fmt.Printf("[ERROR] %v\n", err)
		os.Exit(1)
	}
	defer releasePIDLock(cfg)

	// Create Matrix client
	userID := id.UserID(fmt.Sprintf("@%s:%s", cfg.WorkerID, cfg.ServerName))
	client, err := mautrix.NewClient(cfg.HomeserverURL, userID, "")
	if err != nil {
		fmt.Printf("[ERROR] Failed to create client: %v\n", err)
		os.Exit(1)
	}
	// Login
	fmt.Printf("[INFO] Logging in as %s...\n", userID)
	loginResp, err := client.Login(context.Background(), &mautrix.ReqLogin{
		Type: mautrix.AuthTypePassword,
		Identifier: mautrix.UserIdentifier{
			Type: mautrix.IdentifierTypeUser,
			User: string(userID),
		},
		Password: cfg.Password,
	})
	if err != nil {
		fmt.Printf("[ERROR] Login failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("[INFO] Login successful (token: %s...)\n", loginResp.AccessToken[:20])
	client.AccessToken = loginResp.AccessToken

	// Resolve room: support both room ID (!id:domain) and alias (#name:domain)
	var roomID id.RoomID
	if strings.HasPrefix(cfg.RoomAlias, "!") {
		// Direct room ID
		roomID = id.RoomID(cfg.RoomAlias)
		fmt.Printf("[INFO] Using room ID directly: %s\n", roomID)
	} else {
		// Room alias - resolve it
		resp, err := client.ResolveAlias(context.Background(), id.RoomAlias(cfg.RoomAlias))
		if err != nil {
			fmt.Printf("[ERROR] Failed to resolve room alias %s: %v\n", cfg.RoomAlias, err)
			os.Exit(1)
		}
		roomID = resp.RoomID
		fmt.Printf("[INFO] Resolved room alias to ID: %s\n", roomID)
	}

	// Join room
	_, err = client.JoinRoomByID(context.Background(), roomID)
	if err != nil {
		fmt.Printf("[WARN] Failed to join room (might already joined): %v\n", err)
	} else {
		fmt.Printf("[INFO] Joined room %s\n", roomID)
	}

	// Mark as connected
	healthMutex.Lock()
	isConnected = true
	healthMutex.Unlock()

	// Send ONLINE status
	sendStatus(client, roomID, cfg.WorkerID, true)

	// Start health server
	startHealthServer(cfg, client, cfg.WorkerID)

	// Setup message handler
	syncer := client.Syncer.(*mautrix.DefaultSyncer)

	// Track processed messages
	processedMsgs := make(map[string]bool)
	var processedMutex sync.Mutex
	var syncCount int = 0

	// Count syncs (skip first sync which is history)
	syncer.OnSync(func(ctx context.Context, resp *mautrix.RespSync, since string) bool {
		syncCount++
		return true
	})

	// Message event handler
	syncer.OnEventType(event.EventMessage, func(ctx context.Context, evt *event.Event) {
		// Ignore own messages
		if evt.Sender == client.UserID {
			return
		}

		// Skip first sync (history)
		if syncCount <= 1 {
			return
		}

		// Dedup by event ID
		processedMutex.Lock()
		msgID := string(evt.ID)
		if processedMsgs[msgID] {
			processedMutex.Unlock()
			return
		}
		processedMsgs[msgID] = true
		processedMutex.Unlock()

		msg := evt.Content.AsMessage()
		if msg == nil {
			return
		}

		// Check for @mention
		mention := fmt.Sprintf("@%s", cfg.WorkerID)
		if !strings.Contains(msg.Body, mention) {
			return
		}

		fmt.Printf("[MSG] Received from %s: %s\n", evt.Sender, msg.Body)

		// Extract content after mention
		content := strings.TrimSpace(strings.Replace(msg.Body, mention, "", 1))
		fmt.Printf("[MSG] Extracted: '%s'\n", content)

		var replyBody string
		configChanged := false

		if strings.HasPrefix(content, "CONFIG_JSON:") {
			// Parse JSON config
			jsonStr := strings.TrimSpace(strings.TrimPrefix(content, "CONFIG_JSON:"))
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
				if val, ok := config["smtpHost"]; ok {
					smtpHost = val
				}
				if val, ok := config["smtpPort"]; ok {
					smtpPort = val
				}
				if val, ok := config["smtpUser"]; ok {
					smtpUser = val
				}
				if val, ok := config["smtpPass"]; ok {
					smtpPass = val
				}
				replyBody = fmt.Sprintf("%s，配置更新成功！", evt.Sender)
				configChanged = true
			} else {
				replyBody = fmt.Sprintf("%s，配置失败，JSON格式错误。", evt.Sender)
			}
		} else if content == "GET_CONFIG" {
			// Return current config as JSON
			configResp := map[string]interface{}{
				"apiKey":     llmApiKey,
				"baseUrl":    llmBaseUrl,
				"model":      llmModel,
				"configured": llmConfigured,
				"smtpHost":   smtpHost,
				"smtpPort":   smtpPort,
				"smtpUser":   smtpUser,
				"smtpPass":   smtpPass,
			}
			jsonBytes, _ := json.Marshal(configResp)
			replyBody = fmt.Sprintf("CONFIG_RESPONSE:%s", string(jsonBytes))
		} else if strings.HasPrefix(content, "配置模型 ") {
			llmApiKey = strings.TrimSpace(strings.TrimPrefix(content, "配置模型 "))
			llmConfigured = true
			replyBody = fmt.Sprintf("%s，大模型配置成功！", evt.Sender)
			configChanged = true
		} else if !llmConfigured {
			replyBody = fmt.Sprintf("%s，还没有配置大模型，发送【配置模型 你的API_KEY】配置", evt.Sender)
		} else {
			// Call LightAgent
			agentResp := askLightAgent(content)
			replyBody = fmt.Sprintf("%s，已收到 %s\n[LightAgent]: %s", evt.Sender, content, agentResp)
		}

		// Save config if changed
		if configChanged {
			if err := saveConfig(cfg); err != nil {
				fmt.Printf("[WARN] Failed to save config: %v\n", err)
			}
		}

		// Send reply
		fmt.Printf("[REPLY] Sending to %s: %s\n", evt.RoomID, replyBody[:min(50, len(replyBody))])
		_, err := client.SendMessageEvent(context.Background(), evt.RoomID, event.EventMessage, &event.MessageEventContent{
			MsgType: event.MsgText,
			Body:    replyBody,
		})
		if err != nil {
			fmt.Printf("[ERROR] Failed to send reply: %v\n", err)
		}
	})

	// Start sync in background
	fmt.Println("[INFO] Starting Matrix sync...")
	go func() {
		err := client.Sync()
		if err != nil {
			fmt.Printf("[ERROR] Sync failed: %v\n", err)
			healthMutex.Lock()
			isConnected = false
			healthMutex.Unlock()
		}
	}()

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	fmt.Printf("[INFO] Worker %s running (PID: %d)\n", cfg.WorkerID, os.Getpid())
	fmt.Println("[INFO] Press Ctrl+C to stop")

	<-sigChan

	// Graceful shutdown
	fmt.Println("\n[INFO] Shutdown signal received")
	fmt.Println("[INFO] Stopping worker...")

	// Save config before shutdown
	if err := saveConfig(cfg); err != nil {
		fmt.Printf("[WARN] Failed to save config on shutdown: %v\n", err)
	}

	// Mark as disconnected
	healthMutex.Lock()
	isConnected = false
	healthMutex.Unlock()

	// Send OFFLINE status
	sendStatus(client, roomID, cfg.WorkerID, false)

	// Stop sync
	client.StopSync()

	// Cleanup PID
	releasePIDLock(cfg)

	fmt.Println("[INFO] Worker stopped gracefully")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
