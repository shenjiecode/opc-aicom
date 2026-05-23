package config

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/viper"
)

// Config holds all application configuration
type Config struct {
Server    ServerConfig    `mapstructure:"server"`
	Database  DatabaseConfig  `mapstructure:"database"`
	JWT       JWTConfig       `mapstructure:"jwt"`
	Matrix    MatrixConfig    `mapstructure:"matrix"`
	LLM       LLMConfig       `mapstructure:"llm"`
	Workspace WorkspaceConfig  `mapstructure:"workspace"`
}

// MatrixConfig holds Matrix server configuration

type MatrixConfig struct {
	HomeserverURL string   `mapstructure:"homeserver_url"`
	ServerName    string   `mapstructure:"server_name"`
	SharedSecret  string   `mapstructure:"shared_secret"`
	AdminUser     string   `mapstructure:"admin_user"`     // Admin username for Synapse Admin API
	AdminPassword string   `mapstructure:"admin_password"` // Admin password for Synapse Admin API
	Workers       []string `mapstructure:"workers"`        // List of worker usernames
}

// LLMConfig holds LLM provider configuration
type LLMConfig struct {
	DefaultProvider string             `mapstructure:"default_provider"`
	OpenAI          OpenAIConfig       `mapstructure:"openai"`
	Anthropic       AnthropicConfig    `mapstructure:"anthropic"`
}

// OpenAIConfig holds OpenAI configuration
type OpenAIConfig struct {
	APIKey  string `mapstructure:"api_key"`
	BaseURL string `mapstructure:"base_url"`
}

// AnthropicConfig holds Anthropic configuration
type AnthropicConfig struct {
	APIKey  string `mapstructure:"api_key"`
	BaseURL string `mapstructure:"base_url"`
}

// WorkspaceConfig holds workspace storage configuration
type WorkspaceConfig struct {
	Type     string    `mapstructure:"type"`     // "local" or "oss"
	LocalDir string    `mapstructure:"local_dir"`
	OSS      OSSConfig `mapstructure:"oss"`
}

// OSSConfig holds OSS storage configuration
type OSSConfig struct {
	Endpoint        string `mapstructure:"endpoint"`
	AccessKeyID     string `mapstructure:"access_key_id"`
	AccessKeySecret string `mapstructure:"access_key_secret"`
	BucketName      string `mapstructure:"bucket_name"`
	Region          string `mapstructure:"region"`
	Prefix          string `mapstructure:"prefix"`
}
// ServerConfig holds server configuration
type ServerConfig struct {
	Port int    `mapstructure:"port"`
	Mode string `mapstructure:"mode"`
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Host            string `mapstructure:"host"`
	Port            int    `mapstructure:"port"`
	User            string `mapstructure:"user"`
	Password        string `mapstructure:"password"`
	Name            string `mapstructure:"name"`
	MaxIdleConns    int    `mapstructure:"max_idle_conns"`
	MaxOpenConns    int    `mapstructure:"max_open_conns"`
	ConnMaxLifetime int    `mapstructure:"conn_max_lifetime"`
}

// JWTConfig holds JWT configuration
type JWTConfig struct {
	Secret      string       `mapstructure:"secret"`
	ExpireHours int          `mapstructure:"expire_hours"`
	Cookie      CookieConfig `mapstructure:"cookie"`
}

// CookieConfig holds cookie configuration
type CookieConfig struct {
	Name     string `mapstructure:"name"`
	Path     string `mapstructure:"path"`
	Domain   string `mapstructure:"domain"`
	Secure   bool   `mapstructure:"secure"`
	HttpOnly bool   `mapstructure:"http_only"`
	MaxAge   int    `mapstructure:"max_age"`
}

// Load loads configuration from config.yaml with environment variable overrides
func Load() (*Config, error) {
	// Get current working directory for config path resolution
	wd, err := os.Getwd()
	if err != nil {
		wd = "."
	}

	// Find project root by looking for go.mod
	projectRoot := wd
	for i := 0; i < 10; i++ {
		if _, err := os.Stat(filepath.Join(projectRoot, "go.mod")); err == nil {
			break
		}
		parent := filepath.Dir(projectRoot)
		if parent == projectRoot {
			break
		}
		projectRoot = parent
	}

	// Convert to absolute path
	absWd, err := filepath.Abs(projectRoot)
	if err != nil {
		absWd = projectRoot
	}

	// Configure Viper with absolute path to config file
	configPath := filepath.Join(absWd, "config", "config.yaml")

	// Check if config file exists in project root
	if _, err := os.Stat(configPath); err == nil {
		viper.SetConfigFile(configPath)
	} else {
		// Fallback: use search paths
		viper.SetConfigName("config")
		viper.SetConfigType("yaml")
		viper.AddConfigPath(filepath.Join(absWd, "config"))
		viper.AddConfigPath(absWd)
		viper.AddConfigPath(".")
		viper.AddConfigPath("$HOME/.opc-aicom")
	}

	// Set environment variable prefix
	viper.SetEnvPrefix("")

	// Bind environment variables for specific keys
	// Server config
	viper.BindEnv("server.port", "SERVER_PORT")
	viper.BindEnv("server.mode", "SERVER_MODE")

	// Database config
	viper.BindEnv("database.host", "DATABASE_HOST")
	viper.BindEnv("database.port", "DATABASE_PORT")
	viper.BindEnv("database.user", "DATABASE_USER")
	viper.BindEnv("database.password", "DATABASE_PASSWORD")
	viper.BindEnv("database.name", "DATABASE_NAME")
	viper.BindEnv("database.max_idle_conns", "DATABASE_MAX_IDLE_CONNS")
	viper.BindEnv("database.max_open_conns", "DATABASE_MAX_OPEN_CONNS")
	viper.BindEnv("database.conn_max_lifetime", "DATABASE_CONN_MAX_LIFETIME")

	// JWT config
	viper.BindEnv("jwt.secret", "JWT_SECRET")
viper.BindEnv("jwt.expire_hours", "JWT_EXPIRE_HOURS")

// Matrix config
viper.BindEnv("matrix.homeserver_url", "MATRIX_HOMESERVER_URL")
viper.BindEnv("matrix.server_name", "MATRIX_SERVER_NAME")
viper.BindEnv("matrix.shared_secret", "MATRIX_SHARED_SECRET")
	viper.BindEnv("matrix.admin_api_url", "MATRIX_ADMIN_API_URL")

	// LLM config
	viper.BindEnv("llm.default_provider", "LLM_DEFAULT_PROVIDER")
	viper.BindEnv("llm.openai.api_key", "OPENAI_API_KEY")
	viper.BindEnv("llm.openai.base_url", "OPENAI_BASE_URL")
	viper.BindEnv("llm.anthropic.api_key", "ANTHROPIC_API_KEY")
viper.BindEnv("llm.anthropic.base_url", "ANTHROPIC_BASE_URL")

	// Workspace config
	viper.BindEnv("workspace.type", "WORKSPACE_TYPE")
	viper.BindEnv("workspace.local_dir", "WORKSPACE_LOCAL_DIR")
	viper.BindEnv("workspace.oss.endpoint", "OSS_ENDPOINT")
	viper.BindEnv("workspace.oss.access_key_id", "OSS_ACCESS_KEY_ID")
	viper.BindEnv("workspace.oss.access_key_secret", "OSS_ACCESS_KEY_SECRET")
	viper.BindEnv("workspace.oss.bucket_name", "OSS_BUCKET_NAME")
	viper.BindEnv("workspace.oss.region", "OSS_REGION")
	viper.BindEnv("workspace.oss.prefix", "OSS_PREFIX")

	// Enable automatic environment variable detection
	// This allows any environment variable to override config file values
	// without explicit BindEnv calls
	viper.AutomaticEnv()
	// Read configuration from file
	if err := viper.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// Unmarshal into Config struct
	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Validate configuration
	if err := validate(&cfg); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return &cfg, nil
}

// Global config instance
var globalConfig *Config

// GetConfig returns the global config instance
func GetConfig() *Config {
	return globalConfig
}

// SetConfig sets the global config instance
func SetConfig(cfg *Config) {
	globalConfig = cfg
}

// validate validates the configuration values
func validate(cfg *Config) error {
	if cfg.Server.Port <= 0 || cfg.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", cfg.Server.Port)
	}
	if cfg.Server.Mode == "" {
		cfg.Server.Mode = "debug"
	}
	if cfg.Database.Port <= 0 || cfg.Database.Port > 65535 {
		return fmt.Errorf("invalid database port: %d", cfg.Database.Port)
	}
	if cfg.JWT.Secret == "" {
		return fmt.Errorf("jwt secret cannot be empty")
	}
	if cfg.JWT.ExpireHours <= 0 {
cfg.JWT.ExpireHours = 24
	}
	// Matrix config defaults
	if cfg.Matrix.HomeserverURL == "" {
		cfg.Matrix.HomeserverURL = "http://localhost:8008"
	}
if cfg.Matrix.ServerName == "" {
cfg.Matrix.ServerName = "localhost"
	}
	// LLM config defaults
	if cfg.LLM.DefaultProvider == "" {
		cfg.LLM.DefaultProvider = "openai"
	}
	// Workspace config defaults
	if cfg.Workspace.Type == "" {
		cfg.Workspace.Type = "local"
	}
	if cfg.Workspace.LocalDir == "" {
		cfg.Workspace.LocalDir = "uploads/workspace"
	}
	return nil
}

// GetConnMaxLifetime returns database connection max lifetime as duration
func (c *DatabaseConfig) GetConnMaxLifetime() time.Duration {
	return time.Duration(c.ConnMaxLifetime) * time.Second
}

// GetDatabaseDSN returns the database DSN (Data Source Name)
func (c *DatabaseConfig) GetDatabaseDSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		c.Host, c.Port, c.User, c.Password, c.Name)
}
