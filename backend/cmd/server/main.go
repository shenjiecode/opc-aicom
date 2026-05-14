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

	// Auto migrate database models
	if err := database.AutoMigrate(db, &model.User{}, &model.UserAsset{}, &model.Post{}, &model.Comment{}, &model.Like{}, &model.Task{}, &model.Application{}, &model.Agent{}, &model.ActivityLog{}, &model.Event{}, &model.EventRegistration{}, &model.Resource{}, &model.Service{}); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// Initialize Gin router
	router := gin.Default()

	// API routes
	api := router.Group("/api")
	{
		// User routes (public)
		user := api.Group("/user")
		{
			user.POST("/register", handler.Register(db))
			user.POST("/login", handler.Login(db, cfg))
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
		}

		// Home routes (no auth required)
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

		// Task routes (no auth required)
		task := api.Group("/task")
		{
			task.POST("/list", handler.ListTasks(db))
		}

		// Task routes (auth required)
		taskAuth := api.Group("/task")
		taskAuth.Use(middleware.AuthMiddleware(cfg.JWT.Secret, cfg.JWT.Cookie.Name))
		taskAuth.Use(middleware.ActivityTracker(db))
		{
			taskAuth.POST("/create", handler.CreateTask(db))
			taskAuth.POST("/apply", handler.ApplyTask(db))
		}

		// PRD 文档管理路由
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
	}

	// Start server
	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	log.Printf("Server starting on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
