package main

import (
	"fmt"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/handler"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/pkg/database"
	"github.com/opc-aicom/backend/pkg/config"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize database
	db, err := database.InitDB(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	if err := database.AutoMigrate(db,
		&model.User{}, &model.UserAsset{}, &model.Post{}, &model.Comment{},
		&model.Like{}, &model.Task{}, &model.Application{}, &model.Agent{},
		&model.ActivityLog{}, &model.Event{}, &model.EventRegistration{},
		&model.Resource{}, &model.Service{}, &model.ReviewRecord{},
		&model.SystemAgentConfig{}, &model.OPC{}, &model.APIEndpoint{},
		&model.APIKey{},
		&model.AgentBabaSession{}, &model.Skill{}, &model.MCPServer{},
		&model.AgentInstance{},
		&model.CreditTransaction{}, &model.LLMGateway{},
	); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// Initialize Matrix client
	matrixClient := handler.NewMatrixClient(cfg, db)

	// Initialize Gin router
	router := gin.Default()

	// CORS middleware
	router.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			origin = "http://localhost:5173"
		}
		c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// API routes
	api := router.Group("/api")
		{

			// User routes (public)

			user := api.Group("/user")

			{

				user.POST("/register", handler.Register(db))

				user.POST("/login", handler.Login(db, cfg, matrixClient))

				user.POST("/logout", handler.Logout(cfg))

				user.POST("/online", handler.GetOnlineUsers(db))

			}


		// User routes (auth required)
		userAuth := api.Group("/user")
		userAuth.Use(middleware.AuthMiddleware(cfg.JWT.Secret, cfg.JWT.Cookie.Name))
		userAuth.Use(middleware.ActivityTracker(db))
		{
			userAuth.POST("/info", handler.GetUserInfo(db))
			userAuth.POST("/refresh", handler.RefreshToken(cfg))
			userAuth.GET("/posts", handler.GetUserPosts(db))
			userAuth.GET("/events", handler.GetUserEvents(db))
		}

		// Home routes
		home := api.Group("/home")
		{
			home.POST("/stats", handler.GetStats(db))
		}

		// Resource routes
		resources := api.Group("/resources")
		{
			resources.POST("/list", handler.ListResources(db))
		}

		// Service routes
		services := api.Group("/services")
		{
			services.POST("/list", handler.ListServices(db))
		}

		// Agent routes
		agents := api.Group("/agents")
		{
			agents.POST("/list", handler.ListAgents(db))
		}

		tasks := api.Group("/tasks")
		{
			tasks.POST("/list", handler.ListTasks(db))
		}

		community := api.Group("/community")
		{
			community.POST("/list", handler.ListPosts(db))
			community.POST("/events", handler.ListEvents(db))
			community.GET("/:id", handler.GetPost(db))
			community.GET("/:id/comments", handler.ListComments(db))
		}

		// Community routes (auth required)
		communityAuth := api.Group("/community")
		communityAuth.Use(middleware.AuthMiddleware(cfg.JWT.Secret, cfg.JWT.Cookie.Name))
		communityAuth.Use(middleware.ActivityTracker(db))
		{
			communityAuth.POST("/create", handler.CreatePost(db))
			communityAuth.POST("/like", handler.LikePost(db))
			communityAuth.POST("/comment", handler.CommentPost(db))
		}

		// Task routes
		task := api.Group("/task")
		{
			task.POST("/list", handler.ListTasks(db))
		}

		taskAuth := api.Group("/task")
		taskAuth.Use(middleware.AuthMiddleware(cfg.JWT.Secret, cfg.JWT.Cookie.Name))
		taskAuth.Use(middleware.ActivityTracker(db))
		{
			taskAuth.POST("/create", handler.CreateTask(db))
			taskAuth.POST("/apply", handler.ApplyTask(db))
			taskAuth.GET("/:id/publisher", handler.GetTaskPublisher(db))
			taskAuth.POST("/:id/chat-room", handler.CreateTaskChatRoom(matrixClient))
		}

		// PRD routes
		api.GET("/prds", handler.ListPRDs)
		api.POST("/prds", handler.SavePRD)
		api.GET("/prds/:filename", handler.GetPRD)

		// Event routes (public)
		api.GET("/event/:id", handler.GetEvent(db))
		api.GET("/event/share/:code", handler.GetEventByShareCode(db))

		// Event routes (auth required)
		eventAuth := api.Group("/event")
		eventAuth.Use(middleware.AuthMiddleware(cfg.JWT.Secret, cfg.JWT.Cookie.Name))
		eventAuth.Use(middleware.ActivityTracker(db))
		{
			eventAuth.POST("/create", handler.CreateEvent(db))
			eventAuth.POST("/join", handler.JoinEvent(db))
		}

		// Matrix routes
		matrix := api.Group("/matrix")
		matrix.Use(middleware.AuthMiddleware(cfg.JWT.Secret, cfg.JWT.Cookie.Name))
		{
		matrix.POST("/register", handler.RegisterMatrixUser(matrixClient))
		matrix.POST("/login", handler.LoginMatrixUser(matrixClient))
		matrix.GET("/sync", handler.MatrixSyncSSE(matrixClient))
		matrix.GET("/users", handler.ListMatrixUsers(matrixClient))
		}
		matrixRooms := api.Group("/matrix/rooms")
		matrixRooms.Use(middleware.AuthMiddleware(cfg.JWT.Secret, cfg.JWT.Cookie.Name))
		{
			matrixRooms.POST("", handler.CreateMatrixRoom(matrixClient))
			matrixRooms.GET("", handler.ListMatrixRooms(matrixClient))
			matrixRooms.POST("/:room_id/join", handler.JoinMatrixRoom(matrixClient))
			matrixRooms.POST("/:room_id/leave", handler.LeaveMatrixRoom(matrixClient))
			matrixRooms.POST("/:room_id/invite", handler.InviteToMatrixRoom(matrixClient))
		}

		matrixWorkers := api.Group("/matrix/workers")
		matrixWorkers.Use(middleware.AuthMiddleware(cfg.JWT.Secret, cfg.JWT.Cookie.Name))
		{
			matrixWorkers.GET("", handler.ListMatrixWorkers(matrixClient))
			matrixWorkers.POST("/:worker_id/join", handler.JoinWorkerToRoom(matrixClient))
		}

		// Credit & Gateway handlers
		creditHandler := handler.NewCreditHandler(db)
		gatewayHandler := handler.NewLLMGatewayHandler(db)

		// Admin routes

		// Admin routes
		api.POST("/admin/login", handler.AdminLogin(db, cfg))

		admin := api.Group("/admin")
		admin.Use(handler.AdminAuthMiddleware(db, cfg.JWT.Secret, cfg.JWT.Cookie.Name))
		{
			admin.POST("/dashboard", handler.GetAdminDashboard(db))
			admin.POST("/users/list", handler.GetAdminUserList(db))
			admin.POST("/users/:id/detail", handler.GetAdminUserDetail(db))
			admin.POST("/users/:id/ban", handler.BanUser(db))
			admin.POST("/users/:id/unban", handler.UnbanUser(db))
			admin.POST("/users/:id/role", handler.ChangeUserRole(db))
			admin.POST("/posts/review/list", handler.GetReviewPostList(db))
			admin.POST("/posts/review/approve", handler.ApprovePost(db))
			admin.POST("/posts/review/reject", handler.RejectPost(db))
			admin.POST("/events/review/list", handler.GetReviewEventList(db))
			admin.POST("/events/review/approve", handler.ApproveEvent(db))
			admin.POST("/tasks/list", handler.GetAdminTaskList(db))
			admin.POST("/tasks/:id", handler.GetAdminTaskDetail(db))
			admin.POST("/tasks/:id/close", handler.CloseAdminTask(db))
			admin.POST("/orders/list", handler.GetAdminOrderList(db))
			admin.POST("/orders/:id", handler.GetAdminOrderDetail(db))
			admin.POST("/orders/:id/refund", handler.RefundAdminOrder(db))
			admin.GET("/agents/bit/config", handler.GetBitAgentConfig(db))
			admin.POST("/agents/bit/config", handler.UpdateBitAgentConfig(db))
			admin.GET("/agents/little-o/config", handler.GetLittleOAgentConfig(db))
			admin.POST("/agents/little-o/config", handler.UpdateLittleOAgentConfig(db))
			admin.POST("/opc/stats", handler.GetOPCStats(db))
			admin.POST("/opc/list", handler.GetOPCList(db))
			admin.POST("/opc/:id/detail", handler.GetOPCDetail(db))
			admin.POST("/opc/:id/approve", handler.ApproveOPC(db))
			admin.POST("/opc/:id/reject", handler.RejectOPC(db))
			admin.POST("/opc/:id/suspend", handler.SuspendOPC(db))
			admin.POST("/opc/:id/quota", handler.UpdateOPCQuota(db))
			admin.POST("/api/stats", handler.GetAPIStats(db))
			admin.POST("/api/list", handler.GetAPIList(db))
			admin.POST("/api/create", handler.CreateAPIEndpoint(db))
			admin.POST("/api/:id/update", handler.UpdateAPIEndpoint(db))
			admin.POST("/api/:id/delete", handler.DeleteAPIEndpoint(db))
			admin.POST("/api/keys/list", handler.GetAPIKeyList(db))
			admin.POST("/api/keys/create", handler.CreateAPIKey(db))
			admin.POST("/api/keys/:id/revoke", handler.RevokeAPIKey(db))
			admin.POST("/credit/recharge", creditHandler.Recharge)
		}

		// AgentBaba routes (auth required)
		agentbabaAuth := api.Group("/agentbaba")
		agentbabaAuth.Use(middleware.AuthMiddleware(cfg.JWT.Secret, cfg.JWT.Cookie.Name))
		{
			agentbabaHandler := handler.NewAgentBabaHandler(db, cfg)
			agentbabaAuth.POST("/session/create", agentbabaHandler.CreateSession)
			agentbabaAuth.GET("/session/:id", agentbabaHandler.GetSession)
			agentbabaAuth.PUT("/session/:id", agentbabaHandler.UpdateSession)
			agentbabaAuth.POST("/session/:id/clarify", agentbabaHandler.StartClarification)
			agentbabaAuth.POST("/session/:id/answer", agentbabaHandler.AnswerQuestion)
			agentbabaAuth.POST("/session/:id/match-skills", agentbabaHandler.MatchSkills)
			agentbabaAuth.POST("/session/:id/select-skills", agentbabaHandler.SelectSkills)
			agentbabaAuth.POST("/session/:id/generate-config", agentbabaHandler.GenerateConfig)
			agentbabaAuth.POST("/session/:id/build", agentbabaHandler.BuildAgent)
			agentbabaAuth.POST("/session/:id/test", agentbabaHandler.TestAgent)
			agentbabaAuth.POST("/session/:id/deploy", agentbabaHandler.DeployAgent)
			agentbabaAuth.GET("/sessions", agentbabaHandler.ListSessions)
		}

		// Skill routes
		skillHandler := handler.NewSkillHandler(db)
		skills := api.Group("/skills")
		{
			skills.GET("", skillHandler.List)
			skills.GET("/:id", skillHandler.GetDetail)
			skills.POST("/sync", skillHandler.SyncMCP)
		}

		// MCP routes
		mcpHandler := handler.NewMCPHandler(db)
		mcp := api.Group("/mcp")
		{
			mcp.GET("/servers", mcpHandler.ListServers)
			mcp.POST("/servers", mcpHandler.InstallServer)
			mcp.DELETE("/servers/:name", mcpHandler.UninstallServer)
			mcp.POST("/servers/:name/start", mcpHandler.StartServer)
			mcp.POST("/servers/:name/stop", mcpHandler.StopServer)
			mcp.GET("/servers/:name/tools", mcpHandler.ListTools)
			mcp.POST("/servers/:name/tools/:tool/call", mcpHandler.CallTool)
		}

		// Credit & Gateway routes (auth required)
		creditAuth := api.Group("/credit")
		creditAuth.Use(middleware.AuthMiddleware(cfg.JWT.Secret, cfg.JWT.Cookie.Name))
		{
			creditAuth.POST("/balance", creditHandler.GetBalance)
			creditAuth.POST("/transactions", creditHandler.GetTransactions)
		}

		gatewayAuth := api.Group("/gateway")
		gatewayAuth.Use(middleware.AuthMiddleware(cfg.JWT.Secret, cfg.JWT.Cookie.Name))
		{
			gatewayAuth.GET("/my", gatewayHandler.GetMyGateway)
			gatewayAuth.POST("/create", gatewayHandler.CreateGateway)
			gatewayAuth.POST("/usage", gatewayHandler.GetUsage)
		}


		// Agent instance routes
		instanceHandler := handler.NewAgentInstanceHandler(db, cfg)
		chatHandler := handler.NewAgentChatHandler(db)
		agentInstances := api.Group("/agent-instances")
		agentInstances.Use(middleware.AuthMiddleware(cfg.JWT.Secret, cfg.JWT.Cookie.Name))
		{
			agentInstances.GET("", instanceHandler.List)
			agentInstances.GET("/:id", instanceHandler.GetDetail)
			agentInstances.POST("/:id/start", instanceHandler.Start)
			agentInstances.POST("/:id/stop", instanceHandler.Stop)
			agentInstances.DELETE("/:id", instanceHandler.Delete)
			agentInstances.POST("/:id/run", instanceHandler.Run)
			agentInstances.GET("/:id/logs", instanceHandler.GetLogs)
			agentInstances.GET("/:id/chat/config", chatHandler.GetConfig)
			agentInstances.POST("/:id/chat", chatHandler.Chat)
			agentInstances.PUT("/:id/config", chatHandler.UpdateConfig)
		}
	}

	// Start server
	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	log.Printf("Server starting on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}