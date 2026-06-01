package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/repository"
	"gorm.io/gorm"
)

type EventListResponse struct {
	List     interface{} `json:"list"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

type ListEventRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	Category string `json:"category"`
}

func ListEvents(db *gorm.DB) gin.HandlerFunc {
	eventRepo := repository.NewEventRepository(db)

	return func(c *gin.Context) {
		var req ListEventRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
			pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
			req.Page = page
			req.PageSize = pageSize
			req.Category = c.Query("category")
		}

		if req.Page < 1 {
			req.Page = 1
		}
		if req.PageSize < 1 {
			req.PageSize = 10
		}
		if req.PageSize > 100 {
			req.PageSize = 100
		}

		events, total, err := eventRepo.List(req.Page, req.PageSize, req.Category)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to fetch events",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: EventListResponse{
				List:     events,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}

// CreateEventRequest 创建活动请求
type CreateEventRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	CoverImage  string `json:"cover_image"`
	StartTime   string `json:"start_time" binding:"required"` // RFC3339 format
	EndTime     string `json:"end_time" binding:"required"`
	Location    string `json:"location"`
	Category    string `json:"category"`
	Tags        string `json:"tags"`
	Badge       string `json:"badge"`
	LimitCount  int    `json:"limit_count"`
	ThemeColor  string `json:"theme_color"`
}

// CreateEvent 创建活动
func CreateEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "未授权",
			})
			return
		}

		var req CreateEventRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "参数错误: " + err.Error(),
			})
			return
		}

		startTime, err := time.Parse(time.RFC3339, req.StartTime)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "开始时间格式错误",
			})
			return
		}

		endTime, err := time.Parse(time.RFC3339, req.EndTime)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "结束时间格式错误",
			})
			return
		}

		event := &model.Event{
			UserID:      userID.(uint),
			Title:       req.Title,
			Description: req.Description,
			CoverImage:  req.CoverImage,
			StartTime:   startTime,
			EndTime:     endTime,
			Location:    req.Location,
			Category:    req.Category,
			Tags:        req.Tags,
			Badge:       req.Badge,
			Status:      "报名中",
			LimitCount:  req.LimitCount,
			ThemeColor:  req.ThemeColor,
		}

		eventRepo := repository.NewEventRepository(db)
		if err := eventRepo.Create(event); err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "创建活动失败",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "创建成功",
			Data:    event,
		})
	}
}

// GetEvent 获取活动详情
func GetEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "无效的活动ID",
			})
			return
		}

		eventRepo := repository.NewEventRepository(db)
		event, err := eventRepo.GetByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "活动不存在",
			})
			return
		}

		// 检查当前用户是否已报名
		userID, _ := c.Get("userID")
		var isRegistered bool
		if userID != nil {
			_, err := eventRepo.GetRegistration(uint(id), userID.(uint))
			isRegistered = err == nil
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"event":        event,
				"is_registered": isRegistered,
			},
		})
	}
}

// GetEventByShareCode 通过分享码获取活动
func GetEventByShareCode(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		shareCode := c.Param("code")
		if shareCode == "" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "缺少分享码",
			})
			return
		}

		eventRepo := repository.NewEventRepository(db)
		event, err := eventRepo.GetByShareCode(shareCode)
		if err != nil {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "活动不存在",
			})
			return
		}

		// 检查当前用户是否已报名
		userID, _ := c.Get("userID")
		var isRegistered bool
		if userID != nil {
			_, err := eventRepo.GetRegistration(event.ID, userID.(uint))
			isRegistered = err == nil
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"event":        event,
				"is_registered": isRegistered,
			},
		})
	}
}

// JoinEvent 报名活动
func JoinEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "未授权，请先登录",
			})
			return
		}

		var req struct {
			EventID uint `json:"event_id" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "参数错误",
			})
			return
		}

		eventRepo := repository.NewEventRepository(db)

		// 获取活动信息
		event, err := eventRepo.GetByID(req.EventID)
		if err != nil {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "活动不存在",
			})
			return
		}

		// 检查活动状态
		if event.Status == "已结束" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "活动已结束",
			})
			return
		}

		// 检查人数限制
		if event.LimitCount > 0 && event.JoinedCount >= event.LimitCount {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "报名人数已满",
			})
			return
		}

		// 报名
		err = eventRepo.Register(req.EventID, userID.(uint))
		if err != nil {
			if err == gorm.ErrDuplicatedKey {
				c.JSON(http.StatusBadRequest, UnifiedResponse{
					Code:    400,
					Message: "您已报名过此活动",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "报名失败",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "报名成功",
		})
	}
}

// GuestJoinEventRequest 访客报名请求
type GuestJoinEventRequest struct {
	EventID uint   `json:"event_id" binding:"required"`
	Name    string `json:"name" binding:"required"`
	Phone   string `json:"phone" binding:"required"`
}

// isValidChinesePhone 验证中国手机号格式
func isValidChinesePhone(phone string) bool {
	if len(phone) != 11 {
		return false
	}
	if phone[0] != '1' {
		return false
	}
	// 检查都是数字
	for _, c := range phone {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// GuestJoinEvent 访客报名活动（无需认证）
func GuestJoinEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req GuestJoinEventRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "参数错误",
			})
			return
		}

		// 验证手机号格式
		if !isValidChinesePhone(req.Phone) {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "手机号格式不正确，需为11位中国大陆手机号",
			})
			return
		}

		eventRepo := repository.NewEventRepository(db)

		// 获取活动信息
		event, err := eventRepo.GetByID(req.EventID)
		if err != nil {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "活动不存在",
			})
			return
		}

		// 检查活动状态
		if event.Status == "已结束" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "活动已结束",
			})
			return
		}

		// 检查人数限制
		if event.LimitCount > 0 && event.JoinedCount >= event.LimitCount {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "报名人数已满",
			})
			return
		}

		// 访客报名
		err = eventRepo.GuestRegister(req.EventID, req.Name, req.Phone)
		if err != nil {
			if err == gorm.ErrDuplicatedKey {
				c.JSON(http.StatusBadRequest, UnifiedResponse{
					Code:    400,
					Message: "该手机号已报名过此活动",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "报名失败",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "报名成功",
		})
	}
}

// GetEventRegistrations 获取活动报名表（仅发起者）
func GetEventRegistrations(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "未授权",
			})
			return
		}

		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "无效的活动ID",
			})
			return
		}

		eventRepo := repository.NewEventRepository(db)

		// 获取活动信息
		event, err := eventRepo.GetByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "活动不存在",
			})
			return
		}

		// 检查是否是活动发起者
		if event.UserID != userID.(uint) {
			c.JSON(http.StatusForbidden, UnifiedResponse{
				Code:    403,
				Message: "无权限查看此活动的报名名单",
			})
			return
		}

		// 获取报名列表
		registrations, err := eventRepo.GetRegistrations(uint(id))
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "获取报名列表失败",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data:    registrations,
		})
	}
}
