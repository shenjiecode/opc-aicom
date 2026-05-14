package handler

import (
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
)

const prdDir = "uploads/prds"

func init() {
	os.MkdirAll(prdDir, os.ModePerm)
}

func ListPRDs(c *gin.Context) {
	files, err := ioutil.ReadDir(prdDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read directory"})
		return
	}

	var fileList []gin.H
	for _, f := range files {
		if !f.IsDir() && filepath.Ext(f.Name()) == ".md" {
			fileList = append(fileList, gin.H{
				"name":    f.Name(),
				"size":    f.Size(),
				"modTime": f.ModTime(),
			})
		}
	}

	// Sort by modTime desc
	sort.Slice(fileList, func(i, j int) bool {
		return fileList[i]["modTime"].(time.Time).After(fileList[j]["modTime"].(time.Time))
	})

	c.JSON(http.StatusOK, fileList)
}

func SavePRD(c *gin.Context) {
	var req struct {
		Filename string `json:"filename"`
		Content  string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Filename == "" {
		req.Filename = "PRD-" + time.Now().Format("20060102-150405") + ".md"
	}

	filePath := filepath.Join(prdDir, req.Filename)
	err := ioutil.WriteFile(filePath, []byte(req.Content), 0644)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "filename": req.Filename})
}

func GetPRD(c *gin.Context) {
	filename := c.Param("filename")
	filePath := filepath.Join(prdDir, filename)
	
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	c.String(http.StatusOK, string(content))
}
