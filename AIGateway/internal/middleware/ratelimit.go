package middleware

import (
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/aigateway/internal/pkg/response"
)

// RateLimiter implements a sliding window rate limiter
type RateLimiter struct {
	requests map[string]*slidingWindow
	mu       sync.RWMutex
}

// slidingWindow tracks requests in a sliding time window
type slidingWindow struct {
	timestamps []time.Time
	limit      int
	windowSize time.Duration
	mu         sync.Mutex
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		requests: make(map[string]*slidingWindow),
	}
}

// newSlidingWindow creates a new sliding window
func newSlidingWindow(limit int, windowSize time.Duration) *slidingWindow {
	return &slidingWindow{
		timestamps: make([]time.Time, 0, limit),
		limit:      limit,
		windowSize: windowSize,
	}
}

// Allow checks if a request is allowed and records it
func (sw *slidingWindow) Allow() bool {
	sw.mu.Lock()
	defer sw.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-sw.windowSize)

	// Remove old timestamps
	validIdx := 0
	for i, ts := range sw.timestamps {
		if ts.After(cutoff) {
			validIdx = i
			break
		}
	}
	if validIdx > 0 {
		sw.timestamps = sw.timestamps[validIdx:]
	}

	// Check if under limit
	if len(sw.timestamps) >= sw.limit {
		return false
	}

	// Record this request
	sw.timestamps = append(sw.timestamps, now)
	return true
}

// Allow checks if a request is allowed for a given key
func (rl *RateLimiter) Allow(key string, limit int) bool {
	rl.mu.RLock()
	window, exists := rl.requests[key]
	rl.mu.RUnlock()

	if !exists {
		rl.mu.Lock()
		// Double check after acquiring write lock
		if window, exists = rl.requests[key]; !exists {
			window = newSlidingWindow(limit, time.Minute)
			rl.requests[key] = window
		}
		rl.mu.Unlock()
	}

	return window.Allow()
}

// Cleanup removes old entries periodically
func (rl *RateLimiter) Cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	cutoff := time.Now().Add(-time.Minute)
	for key, window := range rl.requests {
		window.mu.Lock()
		if len(window.timestamps) == 0 || window.timestamps[len(window.timestamps)-1].Before(cutoff) {
			delete(rl.requests, key)
		}
		window.mu.Unlock()
	}
}

// globalRateLimiter is the default rate limiter instance
var globalRateLimiter = NewRateLimiter()

// RateLimitMiddleware creates a per-key rate limiting middleware (requests per minute)
func RateLimitMiddleware() gin.HandlerFunc {
	// Start cleanup goroutine
	go func() {
		ticker := time.NewTicker(time.Minute)
		for range ticker.C {
			globalRateLimiter.Cleanup()
		}
	}()

	return func(c *gin.Context) {
		virtualKey := GetVirtualKey(c)
		if virtualKey == nil {
			response.Unauthorized(c, "no virtual key found")
			c.Abort()
			return
		}

		// Use key ID as the rate limit key
		key := virtualKey.Key
		limit := virtualKey.RateLimit
		if limit <= 0 {
			limit = 60 // Default: 60 requests per minute
		}

		if !globalRateLimiter.Allow(key, limit) {
			response.TooManyRequests(c, "rate limit exceeded, please slow down")
			c.Abort()
			return
		}

		c.Next()
	}
}

// RateLimitMiddlewareWithLimit creates a rate limiting middleware with custom limit
func RateLimitMiddlewareWithLimit(limit int) gin.HandlerFunc {
	return func(c *gin.Context) {
		virtualKey := GetVirtualKey(c)
		if virtualKey == nil {
			response.Unauthorized(c, "no virtual key found")
			c.Abort()
			return
		}

		key := virtualKey.Key
		if !globalRateLimiter.Allow(key, limit) {
			response.TooManyRequests(c, "rate limit exceeded, please slow down")
			c.Abort()
			return
		}

		c.Next()
	}
}