package database

import (
	"database/sql"
	"fmt"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/opc-aicom/backend/pkg/config"
)

// InitDB initializes the MySQL database connection with connection pool settings
func InitDB(cfg config.DatabaseConfig) (*gorm.DB, error) {
	// Build DSN for MySQL
	dsn := buildDSN(cfg)

	// Open MySQL connection with GORM
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	// SetMaxIdleConns sets the maximum number of idle connections
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	// SetMaxOpenConns sets the maximum number of open connections
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	// SetConnMaxLifetime sets the maximum connection lifetime
	sqlDB.SetConnMaxLifetime(cfg.GetConnMaxLifetime())

	return db, nil
}

// AutoMigrate automatically migrates the database schema for the given models
func AutoMigrate(db *gorm.DB, models ...interface{}) error {
	return db.AutoMigrate(models...)
}

// Ping checks the database connection health
func Ping(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Ping()
}

// GetDB returns the underlying *sql.DB from GORM
func GetDB(db *gorm.DB) (*sql.DB, error) {
	return db.DB()
}

// buildDSN builds the MySQL Data Source Name from config
func buildDSN(cfg config.DatabaseConfig) string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.User,
		cfg.Password,
		cfg.Host,
		cfg.Port,
		cfg.Name,
	)
}
