package agnost

import (
	"fmt"
	"log"
	"os"
	"strings"
)

// LogLevel represents logging levels
type LogLevel int

const (
	LogLevelDebug LogLevel = iota
	LogLevelInfo
	LogLevelWarning
	LogLevelError
)

// Logger provides structured logging for the SDK
type Logger struct {
	level  LogLevel
	logger *log.Logger
}

var defaultLogger = &Logger{
	level:  LogLevelInfo,
	logger: log.New(os.Stderr, "[agnost] ", log.LstdFlags),
}

// SetLogLevel sets the global log level
func SetLogLevel(level string) {
	defaultLogger.SetLevel(level)
}

// SetLevel sets the log level for this logger
func (l *Logger) SetLevel(level string) {
	switch strings.ToLower(level) {
	case "debug":
		l.level = LogLevelDebug
	case "info":
		l.level = LogLevelInfo
	case "warning", "warn":
		l.level = LogLevelWarning
	case "error":
		l.level = LogLevelError
	default:
		l.level = LogLevelInfo
	}
}

// Debug logs a debug message
func (l *Logger) Debug(format string, args ...any) {
	if l.level <= LogLevelDebug {
		l.logger.Printf("[DEBUG] "+format, args...)
	}
}

// Info logs an info message
func (l *Logger) Info(format string, args ...any) {
	if l.level <= LogLevelInfo {
		l.logger.Printf("[INFO] "+format, args...)
	}
}

// Warning logs a warning message
func (l *Logger) Warning(format string, args ...any) {
	if l.level <= LogLevelWarning {
		l.logger.Printf("[WARNING] "+format, args...)
	}
}

// Error logs an error message
func (l *Logger) Error(format string, args ...any) {
	if l.level <= LogLevelError {
		l.logger.Printf("[ERROR] "+format, args...)
	}
}

// Global logging functions
func Debug(format string, args ...any) {
	defaultLogger.Debug(format, args...)
}

func Info(format string, args ...any) {
	defaultLogger.Info(format, args...)
}

func Warning(format string, args ...any) {
	defaultLogger.Warning(format, args...)
}

func Error(format string, args ...any) {
	defaultLogger.Error(format, args...)
}

func Errorf(format string, args ...any) error {
	msg := fmt.Sprintf(format, args...)
	defaultLogger.Error(msg)
	return fmt.Errorf(msg)
}
