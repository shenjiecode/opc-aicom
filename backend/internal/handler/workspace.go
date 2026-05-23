package handler

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/pkg/config"
)

// WorkspaceConfig holds workspace storage configuration
type WorkspaceConfig struct {
	Type     string // "local" or "oss"
	LocalDir string
	OSS      OSSConfig
}

type OSSConfig struct {
	Endpoint        string
	AccessKeyID     string
	AccessKeySecret string
	BucketName      string
	Region          string
	Prefix          string // Key prefix in bucket
}

var workspaceDir = "uploads/workspace"

func init() {
	os.MkdirAll(workspaceDir, os.ModePerm)
}

// ListWorkspaceFiles lists files in workspace directory
// GET /api/workspace
func ListWorkspaceFiles(c *gin.Context) {
	cfg := config.GetConfig()
	wsType := "local"
	if cfg.Workspace.Type != "" {
		wsType = cfg.Workspace.Type
	}

	var files []gin.H
	var err error

	switch wsType {
	case "oss":
		files, err = listOSSFiles(cfg.Workspace.OSS)
	default:
		files, err = listLocalFiles(cfg.Workspace.LocalDir)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, files)
}

// GetWorkspaceFile returns content of a specific file
// GET /api/workspace/:filename
func GetWorkspaceFile(c *gin.Context) {
	filename := c.Param("filename")
	
	// Security: prevent path traversal
	if strings.Contains(filename, "..") || strings.HasPrefix(filename, "/") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid filename"})
		return
	}

	cfg := config.GetConfig()
	wsType := "local"
	if cfg.Workspace.Type != "" {
		wsType = cfg.Workspace.Type
	}

	var content []byte
	var err error

	switch wsType {
	case "oss":
		content, err = getOSSFile(cfg.Workspace.OSS, filename)
	default:
		content, err = getLocalFile(cfg.Workspace.LocalDir, filename)
	}

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Determine content type
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".md", ".txt":
		c.String(http.StatusOK, string(content))
	case ".pdf":
		c.Data(http.StatusOK, "application/pdf", content)
	case ".docx":
		c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content)
	case ".doc":
		c.Data(http.StatusOK, "application/msword", content)
	case ".jpg", ".jpeg":
		c.Data(http.StatusOK, "image/jpeg", content)
	case ".png":
		c.Data(http.StatusOK, "image/png", content)
	default:
		c.Data(http.StatusOK, "application/octet-stream", content)
	}
}

// UploadWorkspaceFile uploads a file to workspace
// POST /api/workspace
func UploadWorkspaceFile(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}
	defer file.Close()

	content, err := ioutil.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	cfg := config.GetConfig()
	wsType := "local"
	if cfg.Workspace.Type != "" {
		wsType = cfg.Workspace.Type
	}

	filename := header.Filename
	// Add timestamp prefix to avoid conflicts
	timestamp := time.Now().Format("20060102-150405")
	ext := filepath.Ext(filename)
	base := strings.TrimSuffix(filename, ext)
	newFilename := fmt.Sprintf("%s_%s%s", base, timestamp, ext)

	var err2 error
	switch wsType {
	case "oss":
		err2 = uploadOSSFile(cfg.Workspace.OSS, newFilename, content)
	default:
		err2 = uploadLocalFile(cfg.Workspace.LocalDir, newFilename, content)
	}

	if err2 != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err2.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "success",
		"filename": newFilename,
	})
}

// Helper functions for local storage
func listLocalFiles(dir string) ([]gin.H, error) {
	if dir == "" {
		dir = workspaceDir
	}
	
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory: %w", err)
	}

	var fileList []gin.H
	for _, f := range files {
		if !f.IsDir() {
			fileList = append(fileList, gin.H{
				"name":    f.Name(),
				"size":    f.Size(),
				"modTime": f.ModTime(),
				"type":    "local",
			})
		}
	}

	// Sort by modTime desc
	sort.Slice(fileList, func(i, j int) bool {
		return fileList[i]["modTime"].(time.Time).After(fileList[j]["modTime"].(time.Time))
	})

	return fileList, nil
}

func getLocalFile(dir, filename string) ([]byte, error) {
	if dir == "" {
		dir = workspaceDir
	}
	filePath := filepath.Join(dir, filename)
	return ioutil.ReadFile(filePath)
}

func uploadLocalFile(dir, filename string, content []byte) error {
	if dir == "" {
		dir = workspaceDir
	}
	os.MkdirAll(dir, os.ModePerm)
	filePath := filepath.Join(dir, filename)
	return ioutil.WriteFile(filePath, content, 0644)
}

// OSS placeholder implementations (to be implemented with actual SDK)
func listOSSFiles(cfg config.OSSConfig) ([]gin.H, error) {
	// TODO: Implement with Aliyun OSS SDK
	// For now, return empty list with a note
	return []gin.H{
		{
			"name":    "OSS_NOT_CONFIGURED.md",
			"size":    0,
			"modTime": time.Now(),
			"type":    "oss",
			"note":    "OSS storage not yet implemented, please configure local storage",
		},
	}, nil
}

func getOSSFile(cfg config.OSSConfig, filename string) ([]byte, error) {
	// TODO: Implement with Aliyun OSS SDK
	return nil, fmt.Errorf("OSS storage not yet implemented")
}

func uploadOSSFile(cfg config.OSSConfig, filename string, content []byte) error {
	// TODO: Implement with Aliyun OSS SDK
	return fmt.Errorf("OSS storage not yet implemented")
}
