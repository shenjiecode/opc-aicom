package handler

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	maxFileSize        = 10 << 20 // 10MB
	uploadsDir         = "uploads/requirements"
	imageUploadsDir   = "uploads/activity"
	imageMaxFileSize  = 5 << 20 // 5MB
	allowedImageExts  = ".jpg,.jpeg,.png,.gif,.webp"
)

// UploadPDF handles PDF file upload
// POST /api/upload/pdf
func UploadPDF(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}
	defer file.Close()

	// Validate file extension
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".pdf" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only .pdf files are allowed"})
		return
	}

	// Validate file size
	if header.Size > maxFileSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File size exceeds 10MB limit"})
		return
	}

	// Read file content
	content, err := ioutil.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	// Create upload directory if not exists
	if err := os.MkdirAll(uploadsDir, os.ModePerm); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// Generate unique fileID and save filename
	fileID := uuid.New().String()
	timestamp := time.Now().Format("20060102-150405")
	originalName := strings.TrimSuffix(header.Filename, ext)
	saveFilename := fmt.Sprintf("%s_%s_%s%s", originalName, timestamp, fileID[:8], ext)

	// Save file
	filePath := filepath.Join(uploadsDir, saveFilename)
	if err := ioutil.WriteFile(filePath, content, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "success",
		"fileID":   fileID,
		"filepath": filePath,
		"filename": saveFilename,
		"size":     header.Size,
	})
}

// UploadImage handles image file upload
// POST /api/upload/image
func UploadImage(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "No file uploaded"})
		return
	}
	defer file.Close()

	// Validate file extension
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedExts := strings.Split(allowedImageExts, ",")
	hasValidExt := false
	for _, allowed := range allowedExts {
		if allowed == ext {
			hasValidExt = true
			break
		}
	}
	if !hasValidExt {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "Only jpg, jpeg, png, gif, webp files are allowed"})
		return
	}

	// Validate file size
	if header.Size > imageMaxFileSize {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "File size exceeds 5MB limit"})
		return
	}

	// Read file content
	content, err := ioutil.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "Failed to read file"})
		return
	}

	// Create uploads directory if not exists
	if err := os.MkdirAll(imageUploadsDir, os.ModePerm); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "Failed to create upload directory"})
		return
	}

	// Generate unique filename with UUID
	fileUUID := uuid.New().String()
	saveFilename := fileUUID + ext

	// Save file
	filePath := filepath.Join(imageUploadsDir, saveFilename)
	if err := ioutil.WriteFile(filePath, content, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "Failed to save file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"url":      "/api/upload/image/" + saveFilename,
			"filename": saveFilename,
		},
	})
}

// ServeImage serves uploaded image files
// GET /api/upload/image/:filename
func ServeImage(c *gin.Context) {
	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "Filename required"})
		return
	}

	// Security: prevent path traversal
	if strings.Contains(filename, "..") || strings.HasPrefix(filename, "/") {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "Invalid filename"})
		return
	}

	filePath := filepath.Join(imageUploadsDir, filename)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "File not found"})
		return
	}

	c.File(filePath)
}