package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ================== Compute Package CRUD ==================

// ComputePackageListRequest represents the list request
type ComputePackageListRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	Type     string `json:"type"`
	Status   string `json:"status"`
}

// ComputePackageListItem represents a package in the list
type ComputePackageListItem struct {
	ID           uint   `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Type         string `json:"type"`
	Price        string `json:"price"`
	Credits      int    `json:"credits"`
	DurationDays int    `json:"durationDays"`
	Specs        string `json:"specs"`
	Status       string `json:"status"`
	SortOrder    int    `json:"sortOrder"`
	CreatedAt    string `json:"createdAt"`
}

// ComputePackageListResponse represents the list response
type ComputePackageListResponse struct {
	List     []ComputePackageListItem `json:"list"`
	Total    int64                   `json:"total"`
	Page     int                     `json:"page"`
	PageSize int                     `json:"pageSize"`
}

// GetComputePackageList returns paginated compute package list
// GET /api/admin/compute-packages
func GetComputePackageList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ComputePackageListRequest
		if err := c.ShouldBindQuery(&req); err != nil {
			req.Page = 1
			req.PageSize = 20
		}

		if req.Page < 1 {
			req.Page = 1
		}
		if req.PageSize < 1 || req.PageSize > 100 {
			req.PageSize = 20
		}

		query := db.Model(&model.ComputePackage{})

		// Apply filters
		if req.Type != "" {
			query = query.Where("type = ?", req.Type)
		}
		if req.Status != "" {
			query = query.Where("status = ?", req.Status)
		}

		// Get total
		var total int64
		query.Count(&total)

		// Get list
		offset := (req.Page - 1) * req.PageSize
		var packages []model.ComputePackage
		query.Order("sort_order ASC, created_at DESC").Offset(offset).Limit(req.PageSize).Find(&packages)

		list := make([]ComputePackageListItem, len(packages))
		for i, p := range packages {
			list[i] = ComputePackageListItem{
				ID:           p.ID,
				Name:         p.Name,
				Description:  p.Description,
				Type:         string(p.Type),
				Price:        p.Price.String(),
				Credits:      p.Credits,
				DurationDays: p.DurationDays,
				Specs:        p.Specs,
				Status:       string(p.Status),
				SortOrder:    p.SortOrder,
				CreatedAt:    p.CreatedAt.Format("2006-01-02 15:04:05"),
			}
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: ComputePackageListResponse{
				List:     list,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}

// ComputePackageDetailResponse represents package detail
type ComputePackageDetailResponse struct {
	ID           uint   `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Type         string `json:"type"`
	Price        string `json:"price"`
	Credits      int    `json:"credits"`
	DurationDays int    `json:"durationDays"`
	Specs        string `json:"specs"`
	Status       string `json:"status"`
	SortOrder    int    `json:"sortOrder"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
}

// GetComputePackageDetail returns package detail
// GET /api/admin/compute-packages/:id
func GetComputePackageDetail(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid package id",
			})
			return
		}

		var pkg model.ComputePackage
		if err := db.First(&pkg, id).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "package not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: ComputePackageDetailResponse{
				ID:           pkg.ID,
				Name:         pkg.Name,
				Description:  pkg.Description,
				Type:         string(pkg.Type),
				Price:        pkg.Price.String(),
				Credits:      pkg.Credits,
				DurationDays: pkg.DurationDays,
				Specs:        pkg.Specs,
				Status:       string(pkg.Status),
				SortOrder:    pkg.SortOrder,
				CreatedAt:    pkg.CreatedAt.Format("2006-01-02 15:04:05"),
				UpdatedAt:    pkg.UpdatedAt.Format("2006-01-02 15:04:05"),
			},
		})
	}
}

// CreateComputePackageRequest represents create request
type CreateComputePackageRequest struct {
	Name         string `json:"name" binding:"required"`
	Description  string `json:"description"`
	Type         string `json:"type" binding:"required"`
	Price        string `json:"price" binding:"required"`
	Credits      int    `json:"credits" binding:"required"`
	DurationDays int    `json:"durationDays" binding:"required"`
	Specs        string `json:"specs"`
	Status       string `json:"status"`
	SortOrder    int    `json:"sortOrder"`
}

// CreateComputePackage creates a new compute package
// POST /api/admin/compute-packages
func CreateComputePackage(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CreateComputePackageRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid request body: " + err.Error(),
			})
			return
		}

		// Validate type
		validTypes := map[string]bool{"qoder": true, "gpu": true, "other": true}
		if !validTypes[req.Type] {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid type, must be qoder, gpu, or other",
			})
			return
		}

		// Parse price
		price, err := strconv.ParseFloat(req.Price, 64)
		if err != nil || price < 0 {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid price",
			})
			return
		}

		status := model.ComputePackageStatusActive
		if req.Status != "" {
			status = model.ComputePackageStatus(req.Status)
		}

		pkg := model.ComputePackage{
			Name:         req.Name,
			Description:  req.Description,
			Type:         model.ComputePackageType(req.Type),
			Credits:      req.Credits,
			DurationDays: req.DurationDays,
			Specs:        req.Specs,
			Status:       status,
			SortOrder:    req.SortOrder,
			Price:        decimal.NewFromFloat(price),
		}

		if err := db.Create(&pkg).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to create package",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "package created successfully",
			Data: ComputePackageDetailResponse{
				ID:           pkg.ID,
				Name:         pkg.Name,
				Description:  pkg.Description,
				Type:         string(pkg.Type),
				Price:        pkg.Price.String(),
				Credits:      pkg.Credits,
				DurationDays: pkg.DurationDays,
				Specs:        pkg.Specs,
				Status:       string(pkg.Status),
				SortOrder:    pkg.SortOrder,
				CreatedAt:    pkg.CreatedAt.Format("2006-01-02 15:04:05"),
				UpdatedAt:    pkg.UpdatedAt.Format("2006-01-02 15:04:05"),
			},
		})
	}
}

// UpdateComputePackageRequest represents update request
type UpdateComputePackageRequest struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	Type         string `json:"type"`
	Price        string `json:"price"`
	Credits      int    `json:"credits"`
	DurationDays int    `json:"durationDays"`
	Specs        string `json:"specs"`
	Status       string `json:"status"`
	SortOrder    int    `json:"sortOrder"`
}

// UpdateComputePackage updates a compute package
// PUT /api/admin/compute-packages/:id
func UpdateComputePackage(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid package id",
			})
			return
		}

		var pkg model.ComputePackage
		if err := db.First(&pkg, id).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "package not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		var req UpdateComputePackageRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid request body",
			})
			return
		}

		updates := make(map[string]interface{})

		if req.Name != "" {
			updates["name"] = req.Name
		}
		if req.Description != "" {
			updates["description"] = req.Description
		}
		if req.Type != "" {
			validTypes := map[string]bool{"qoder": true, "gpu": true, "other": true}
			if !validTypes[req.Type] {
				c.JSON(http.StatusBadRequest, UnifiedResponse{
					Code:    400,
					Message: "invalid type, must be qoder, gpu, or other",
				})
				return
			}
			updates["type"] = req.Type
		}
		if req.Price != "" {
			price, err := strconv.ParseFloat(req.Price, 64)
			if err != nil || price < 0 {
				c.JSON(http.StatusBadRequest, UnifiedResponse{
					Code:    400,
					Message: "invalid price",
				})
				return
			}
			updates["price"] = decimal.NewFromFloat(price)
		}
		if req.Credits > 0 {
			updates["credits"] = req.Credits
		}
		if req.DurationDays > 0 {
			updates["duration_days"] = req.DurationDays
		}
		if req.Specs != "" {
			updates["specs"] = req.Specs
		}
		if req.Status != "" {
			updates["status"] = req.Status
		}
		if req.SortOrder > 0 {
			updates["sort_order"] = req.SortOrder
		}

		if len(updates) > 0 {
			if err := db.Model(&pkg).Updates(updates).Error; err != nil {
				c.JSON(http.StatusInternalServerError, UnifiedResponse{
					Code:    500,
					Message: "failed to update package",
				})
				return
			}
		}

		// Reload the package
		db.First(&pkg, id)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "package updated successfully",
			Data: ComputePackageDetailResponse{
				ID:           pkg.ID,
				Name:         pkg.Name,
				Description:  pkg.Description,
				Type:         string(pkg.Type),
				Price:        pkg.Price.String(),
				Credits:      pkg.Credits,
				DurationDays: pkg.DurationDays,
				Specs:        pkg.Specs,
				Status:       string(pkg.Status),
				SortOrder:    pkg.SortOrder,
				CreatedAt:    pkg.CreatedAt.Format("2006-01-02 15:04:05"),
				UpdatedAt:    pkg.UpdatedAt.Format("2006-01-02 15:04:05"),
			},
		})
	}
}

// DeleteComputePackage soft deletes a compute package
// DELETE /api/admin/compute-packages/:id
func DeleteComputePackage(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid package id",
			})
			return
		}

		var pkg model.ComputePackage
		if err := db.First(&pkg, id).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "package not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		// Soft delete
		if err := db.Delete(&pkg).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to delete package",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "package deleted successfully",
		})
	}
}
