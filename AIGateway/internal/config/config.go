package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Gateway  GatewayConfig
}

type ServerConfig struct {
	Port int
	Mode string // debug, release
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
}

type GatewayConfig struct {
	DefaultQuota int64
	DefaultRPM   int
	DefaultTPM   int
}

func Load() (*Config, error) {
	v := viper.New()

	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./config")
	v.AddConfigPath("../../config") // for tests in internal packages

	// Environment variable overrides (e.g., AIGW_SERVER_PORT)
	v.SetEnvPrefix("AIGW")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Defaults
	v.SetDefault("server.port", 8081)
	v.SetDefault("server.mode", "debug")
	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", 3306)
	v.SetDefault("database.user", "opc_user")
	v.SetDefault("database.password", "opcpassword")
	v.SetDefault("database.dbname", "opc_aicom")
	v.SetDefault("gateway.default_quota", int64(1000000))
	v.SetDefault("gateway.default_rpm", 60)
	v.SetDefault("gateway.default_tpm", 100000)

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("read config: %w", err)
		}
		// Config file not found; use defaults + env vars
	}

	cfg := &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	return cfg, nil
}

// DSN returns the MySQL data source name from the database config.
func (d *DatabaseConfig) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		d.User, d.Password, d.Host, d.Port, d.DBName,
	)
}
