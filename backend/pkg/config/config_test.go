package config

import (
	"os"
	"testing"
)

func TestLoad(t *testing.T) {
	// Test basic load
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	// Verify default values
	if cfg.Server.Port != 8080 {
		t.Errorf("Expected server port 8080, got %d", cfg.Server.Port)
	}
	if cfg.Database.Host != "localhost" {
		t.Errorf("Expected database host localhost, got %s", cfg.Database.Host)
	}
	if cfg.JWT.Secret == "" {
		t.Error("Expected JWT secret to be set")
	}
}

func TestLoadWithEnvOverride(t *testing.T) {
	// Set environment variable
	os.Setenv("DATABASE_HOST", "custom-host")
	os.Setenv("SERVER_PORT", "9090")
	defer func() {
		os.Unsetenv("DATABASE_HOST")
		os.Unsetenv("SERVER_PORT")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	// Verify env overrides
	if cfg.Database.Host != "custom-host" {
		t.Errorf("Expected database host custom-host, got %s", cfg.Database.Host)
	}
	if cfg.Server.Port != 9090 {
		t.Errorf("Expected server port 9090, got %d", cfg.Server.Port)
	}
}

func TestGetDatabaseDSN(t *testing.T) {
	cfg := &DatabaseConfig{
		Host:     "localhost",
		Port:     5432,
		User:     "postgres",
		Password: "password",
		Name:     "testdb",
	}

	dsn := cfg.GetDatabaseDSN()
	expected := "host=localhost port=5432 user=postgres password=password dbname=testdb sslmode=disable"
	if dsn != expected {
		t.Errorf("Expected DSN %s, got %s", expected, dsn)
	}
}

func TestGetConnMaxLifetime(t *testing.T) {
	cfg := &DatabaseConfig{
		ConnMaxLifetime: 3600,
	}

	result := cfg.GetConnMaxLifetime()
	if result.Seconds() != 3600 {
		t.Errorf("Expected 3600s, got %v", result)
	}
}
