package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Response represents the standard API response structure
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// Success sends a successful response with data
func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

// SuccessWithStatus sends a successful response with custom status code
func SuccessWithStatus(c *gin.Context, statusCode int, data interface{}) {
	c.JSON(statusCode, Response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

// Error sends an error response
func Error(c *gin.Context, code int, message string) {
	c.JSON(http.StatusOK, Response{
		Code:    code,
		Message: message,
	})
}

// ErrorWithStatus sends an error response with custom HTTP status code
func ErrorWithStatus(c *gin.Context, httpStatus int, code int, message string) {
	c.JSON(httpStatus, Response{
		Code:    code,
		Message: message,
	})
}

// BadRequest sends a 400 error response
func BadRequest(c *gin.Context, message string) {
	ErrorWithStatus(c, http.StatusBadRequest, 400, message)
}

// Unauthorized sends a 401 error response
func Unauthorized(c *gin.Context, message string) {
	ErrorWithStatus(c, http.StatusUnauthorized, 401, message)
}

// Forbidden sends a 403 error response
func Forbidden(c *gin.Context, message string) {
	ErrorWithStatus(c, http.StatusForbidden, 403, message)
}

// NotFound sends a 404 error response
func NotFound(c *gin.Context, message string) {
	ErrorWithStatus(c, http.StatusNotFound, 404, message)
}

// InternalError sends a 500 error response
func InternalError(c *gin.Context, message string) {
	ErrorWithStatus(c, http.StatusInternalServerError, 500, message)
}

// TooManyRequests sends a 429 error response
func TooManyRequests(c *gin.Context, message string) {
	ErrorWithStatus(c, http.StatusTooManyRequests, 429, message)
}
