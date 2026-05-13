package logger

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

var (
	log   *zap.SugaredLogger
	level zapcore.Level
)

// Config holds the logger configuration
type Config struct {
	Level      string `json:"level"`      // debug, info, warn, error
	FilePath   string `json:"filePath"`   // log file path
	MaxSize    int    `json:"maxSize"`  // max size in MB before rotation
	MaxBackups int    `json:"maxBackups"` // max number of old files to keep
	MaxAge     int    `json:"maxAge"`    // max days to retain old files
	Compress   bool   `json:"compress"` // compress rotated files
}

// DefaultConfig returns a default configuration
func DefaultConfig() Config {
	return Config{
		Level:      "info",
		FilePath:   "logs/app.log",
		MaxSize:    100,
		MaxBackups: 30,
		MaxAge:     7,
		Compress:   true,
	}
}

// Init initializes the logger with the given config
func Init(cfg Config) error {
	// Parse log level
	var zapLevel zapcore.Level
	switch cfg.Level {
	case "debug":
		zapLevel = zapcore.DebugLevel
	case "info":
		zapLevel = zapcore.InfoLevel
	case "warn":
		zapLevel = zapcore.WarnLevel
	case "error":
		zapLevel = zapcore.ErrorLevel
	default:
		zapLevel = zapcore.InfoLevel
	}
	level = zapLevel

	// Create encoder config for production JSON output
	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	encoderConfig.EncodeLevel = zapcore.CapitalLevelEncoder
	encoderConfig.EncodeCaller = zapcore.ShortCallerEncoder

	// Create JSON encoder
	encoder := zapcore.NewJSONEncoder(encoderConfig)

	// Create file writer with rotation using lumberjack
	fileWriter := zapcore.AddSync(&lumberjack.Logger{
		Filename:   cfg.FilePath,
		MaxSize:    cfg.MaxSize,
		MaxBackups: cfg.MaxBackups,
		MaxAge:     cfg.MaxAge,
		Compress:   cfg.Compress,
	})

	// Create core with both file output and console output for critical errors
	core := zapcore.NewCore(
		encoder,
		fileWriter,
		zapLevel,
	)

	// Create logger with caller info enabled
	logger := zap.New(core, zap.AddCaller(), zap.AddCallerSkip(1))
	log = logger.Sugar()

	return nil
}

// InitDefault initializes the logger with default configuration
func InitDefault() error {
	return Init(DefaultConfig())
}

// SetLevel dynamically changes the log level
func SetLevel(lvl string) error {
	var zapLevel zapcore.Level
	switch lvl {
	case "debug":
		zapLevel = zapcore.DebugLevel
	case "info":
		zapLevel = zapcore.InfoLevel
	case "warn":
		zapLevel = zapcore.WarnLevel
	case "error":
		zapLevel = zapcore.ErrorLevel
	default:
		zapLevel = zapcore.InfoLevel
	}
	level = zapLevel
	return nil
}

// Debug logs a message at debug level
func Debug(args ...interface{}) {
	log.Debug(args...)
}

// Debugf logs a formatted message at debug level
func Debugf(template string, args ...interface{}) {
	log.Debugf(template, args...)
}

// Info logs a message at info level
func Info(args ...interface{}) {
	log.Info(args...)
}

// Infof logs a formatted message at info level
func Infof(template string, args ...interface{}) {
	log.Infof(template, args...)
}

// Warn logs a message at warn level
func Warn(args ...interface{}) {
	log.Warn(args...)
}

// Warnf logs a formatted message at warn level
func Warnf(template string, args ...interface{}) {
	log.Warnf(template, args...)
}

// Error logs a message at error level
func Error(args ...interface{}) {
	log.Error(args...)
}

// Errorf logs a formatted message at error level
func Errorf(template string, args ...interface{}) {
	log.Errorf(template, args...)
}

// Fatal logs a message at fatal level and exits
func Fatal(args ...interface{}) {
	log.Fatal(args...)
}

// Fatalf logs a formatted message at fatal level and exits
func Fatalf(template string, args ...interface{}) {
	log.Fatalf(template, args...)
}

// Sync flushes any buffered log entries
func Sync() {
	if log != nil {
		log.Sync()
	}
}

// With creates a child logger with additional fields
func With(args ...interface{}) *zap.SugaredLogger {
	return log.With(args...)
}

// GetLogger returns the underlying zap logger (for advanced usage)
func GetLogger() *zap.Logger {
	return log.Desugar()
}

// ensure directory exists for log files
func ensureDir(path string) error {
	dir := path
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '/' || path[i] == '\\' {
			dir = path[:i]
			break
		}
	}
	if dir == path {
		return nil
	}
	return os.MkdirAll(dir, 0755)
}