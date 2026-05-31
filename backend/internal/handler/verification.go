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
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

const (
	maxCertifyFileSize = 10 << 20 // 10MB
	certifyUploadDir   = "uploads/certify"
)

// PersonalVerificationRequest 个人实名认证请求
type PersonalVerificationRequest struct {
	RealName     string `form:"realName" binding:"required"`
	IDCardNumber string `form:"idCardNumber" binding:"required"`
}

// EnterpriseVerificationRequest 企业认证请求
type EnterpriseVerificationRequest struct {
	EnterpriseName    string `form:"enterpriseName" binding:"required"`
	LicenseNumber     string `form:"licenseNumber" binding:"required"`
	LegalPersonName   string `form:"legalPersonName" binding:"required"`
	UnifiedSocialCode string `form:"unifiedSocialCode" binding:"required"`
}

// saveCertifyFile 保存认证文件到指定目录
// 文件名格式: {prefix}_{suffix}.{ext}
func saveCertifyFile(fileData []byte, prefix, suffix, originalExt string) (string, error) {
	// 清理文件名中的非法字符
	cleanPrefix := cleanFileName(prefix)
	cleanSuffix := cleanFileName(suffix)

	// 生成文件名
	ext := strings.ToLower(originalExt)
	if ext == "" {
		ext = ".jpg"
	}
	saveFilename := fmt.Sprintf("%s_%s%s", cleanPrefix, cleanSuffix, ext)

	// 确保目录存在
	if err := os.MkdirAll(certifyUploadDir, os.ModePerm); err != nil {
		return "", fmt.Errorf("failed to create upload directory: %w", err)
	}

	// 保存文件
	filePath := filepath.Join(certifyUploadDir, saveFilename)
	if err := ioutil.WriteFile(filePath, fileData, 0644); err != nil {
		return "", fmt.Errorf("failed to save file: %w", err)
	}

	return filePath, nil
}

// cleanFileName 清理文件名，移除非法字符
func cleanFileName(name string) string {
	// 移除可能导致安全问题的字符
	name = strings.ReplaceAll(name, "/", "_")
	name = strings.ReplaceAll(name, "\\", "_")
	name = strings.ReplaceAll(name, "..", "_")
	name = strings.ReplaceAll(name, " ", "_")
	// 限制长度
	if len(name) > 50 {
		name = name[:50]
	}
	return name
}

// SubmitPersonalVerification 提交个人实名认证
// POST /api/verification/personal
func SubmitPersonalVerification(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := middleware.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{Code: 401, Message: "unauthorized"})
			return
		}

		// 手动从表单中获取数据（支持 multipart/form-data）
		req := PersonalVerificationRequest{
			RealName:     c.PostForm("realName"),
			IDCardNumber: c.PostForm("idCardNumber"),
		}
		
		// 验证必填字段
		if req.RealName == "" || req.IDCardNumber == "" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{Code: 400, Message: "请填写完整的认证信息"})
			return
		}

		// 检查是否已有待审核或已通过的认证
		var existing model.Verification
		if err := db.Where("user_id = ? AND type = ? AND status IN ?",
			userID, model.VerificationTypePersonal, []model.VerificationStatus{
				model.VerificationStatusPending,
				model.VerificationStatusApproved,
			}).First(&existing).Error; err == nil {
			if existing.Status == model.VerificationStatusPending {
				c.JSON(http.StatusConflict, UnifiedResponse{Code: 409, Message: "您已有待审核的个人认证申请"})
				return
			}
			if existing.Status == model.VerificationStatusApproved {
				c.JSON(http.StatusConflict, UnifiedResponse{Code: 409, Message: "您已完成个人实名认证"})
				return
			}
		}

		// 处理身份证正面照片上传
		idCardFrontFile, err := c.FormFile("idCardFront")
		var idCardFrontPath string
		if err == nil && idCardFrontFile != nil {
			if idCardFrontFile.Size > maxCertifyFileSize {
				c.JSON(http.StatusBadRequest, UnifiedResponse{Code: 400, Message: "身份证正面照片大小超过10MB限制"})
				return
			}
			
			file, err := idCardFrontFile.Open()
			if err != nil {
				c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "无法读取身份证正面照片"})
				return
			}
			defer file.Close()
			
			content, err := ioutil.ReadAll(file)
			if err != nil {
				c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "无法读取身份证正面照片"})
				return
			}
			
			ext := filepath.Ext(idCardFrontFile.Filename)
			idCardFrontPath, err = saveCertifyFile(content, req.RealName, "身份证正面", ext)
			if err != nil {
				c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "保存身份证正面照片失败"})
				return
			}
		}

		// 处理身份证背面照片上传
		idCardBackFile, err := c.FormFile("idCardBack")
		var idCardBackPath string
		if err == nil && idCardBackFile != nil {
			if idCardBackFile.Size > maxCertifyFileSize {
				c.JSON(http.StatusBadRequest, UnifiedResponse{Code: 400, Message: "身份证背面照片大小超过10MB限制"})
				return
			}
			
			file, err := idCardBackFile.Open()
			if err != nil {
				c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "无法读取身份证背面照片"})
				return
			}
			defer file.Close()
			
			content, err := ioutil.ReadAll(file)
			if err != nil {
				c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "无法读取身份证背面照片"})
				return
			}
			
			ext := filepath.Ext(idCardBackFile.Filename)
			idCardBackPath, err = saveCertifyFile(content, req.RealName, "身份证背面", ext)
			if err != nil {
				c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "保存身份证背面照片失败"})
				return
			}
		}

		// 创建认证记录
		verification := model.Verification{
			UserID:       userID,
			Type:         model.VerificationTypePersonal,
			Status:       model.VerificationStatusPending,
			RealName:     req.RealName,
			IDCardNumber: req.IDCardNumber,
			IDCardFront:  idCardFrontPath,
			IDCardBack:   idCardBackPath,
		}

		if err := db.Create(&verification).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "提交认证申请失败"})
			return
		}

		// 自动更新用户认证状态为 pending
		db.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
			"verification_status": "pending",
			"real_name":           req.RealName,
		})

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "个人实名认证提交成功，等待审核",
			Data: gin.H{
				"verificationId": verification.ID,
				"status":         "pending",
			},
		})
	}
}


// SubmitEnterpriseVerification 提交企业认证
// POST /api/verification/enterprise
func SubmitEnterpriseVerification(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := middleware.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{Code: 401, Message: "unauthorized"})
			return
		}

		// 手动从表单中获取数据（支持 multipart/form-data）
		req := EnterpriseVerificationRequest{
			EnterpriseName:    c.PostForm("enterpriseName"),
			LicenseNumber:     c.PostForm("licenseNumber"),
			LegalPersonName:   c.PostForm("legalPersonName"),
			UnifiedSocialCode: c.PostForm("unifiedSocialCode"),
		}
		
		// 验证必填字段
		if req.EnterpriseName == "" || req.LicenseNumber == "" || req.LegalPersonName == "" || req.UnifiedSocialCode == "" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{Code: 400, Message: "请填写完整的企业认证信息"})
			return
		}

		// 检查是否已有待审核或已通过的企业认证
		var existing model.Verification
		if err := db.Where("user_id = ? AND type = ? AND status IN ?",
			userID, model.VerificationTypeEnterprise, []model.VerificationStatus{
				model.VerificationStatusPending,
				model.VerificationStatusApproved,
			}).First(&existing).Error; err == nil {
			if existing.Status == model.VerificationStatusPending {
				c.JSON(http.StatusConflict, UnifiedResponse{Code: 409, Message: "您已有待审核的企业认证申请"})
				return
			}
			if existing.Status == model.VerificationStatusApproved {
				c.JSON(http.StatusConflict, UnifiedResponse{Code: 409, Message: "您已完成企业认证"})
				return
			}
		}

		// 处理营业执照上传
		businessLicenseFile, err := c.FormFile("businessLicense")
		var businessLicensePath string
		if err == nil && businessLicenseFile != nil {
			if businessLicenseFile.Size > maxCertifyFileSize {
				c.JSON(http.StatusBadRequest, UnifiedResponse{Code: 400, Message: "营业执照文件大小超过10MB限制"})
				return
			}
			
			file, err := businessLicenseFile.Open()
			if err != nil {
				c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "无法读取营业执照"})
				return
			}
			defer file.Close()
			
			content, err := ioutil.ReadAll(file)
			if err != nil {
				c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "无法读取营业执照"})
				return
			}
			
			ext := filepath.Ext(businessLicenseFile.Filename)
			businessLicensePath, err = saveCertifyFile(content, req.EnterpriseName, "营业执照", ext)
			if err != nil {
				c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "保存营业执照失败"})
				return
			}
		}

		// 创建认证记录
		verification := model.Verification{
			UserID:            userID,
			Type:              model.VerificationTypeEnterprise,
			Status:            model.VerificationStatusPending,
			EnterpriseName:    req.EnterpriseName,
			LicenseNumber:     req.LicenseNumber,
			LegalPersonName:   req.LegalPersonName,
			UnifiedSocialCode: req.UnifiedSocialCode,
			BusinessLicense:   businessLicensePath,
		}

		if err := db.Create(&verification).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "提交认证申请失败"})
			return
		}

		// 更新用户认证状态为 pending
		db.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
			"verification_status": "pending",
			"enterprise_name":     req.EnterpriseName,
		})

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "企业认证提交成功，等待审核",
			Data: gin.H{
				"verificationId": verification.ID,
				"status":         "pending",
			},
		})
	}
}

// GetVerificationStatus 获取认证状态
// GetVerificationStatus 获取认证状态
// GET /api/verification/status
func GetVerificationStatus(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := middleware.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{Code: 401, Message: "unauthorized"})
			return
		}

		var verifications []model.Verification
		if err := db.Where("user_id = ?", userID).Order("created_at DESC").Find(&verifications).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "获取认证状态失败"})
			return
		}

		// 获取用户当前状态
		var user model.User
		if err := db.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "获取用户信息失败"})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"memberType":         user.MemberType,
				"verificationStatus": user.VerificationStatus,
				"realName":           user.RealName,
				"enterpriseName":     user.EnterpriseName,
				"verifications":      verifications,
			},
		})
	}
}

// approveVerification 审核通过认证并更新用户会员类型
func approveVerification(db *gorm.DB, verificationID uint, reviewerID uint, remark string) {
	now := time.Now()

	// 更新认证记录状态
	db.Model(&model.Verification{}).Where("id = ?", verificationID).Updates(map[string]interface{}{
		"status":        model.VerificationStatusApproved,
		"reviewed_at":   now,
		"reviewed_by":   reviewerID,
		"review_remark": remark,
	})

	// 获取认证记录以确定类型
	var verification model.Verification
	if err := db.First(&verification, verificationID).Error; err != nil {
		return
	}

	// 根据认证类型更新用户会员类型
	memberType := "personal"
	if verification.Type == model.VerificationTypeEnterprise {
		memberType = "enterprise"
	}

	db.Model(&model.User{}).Where("id = ?", verification.UserID).Updates(map[string]interface{}{
		"member_type":         memberType,
		"verification_status": "verified",
	})

	// 如果是企业认证，赠送10000积分
	if verification.Type == model.VerificationTypeEnterprise {
		creditHandler := NewCreditHandler(db)
		giftReason := "企业认证通过，系统赠送积分"
		if err := creditHandler.GiftPoints(verification.UserID, 10000, giftReason); err != nil {
			// Log error but don't fail the verification
			// In production, you'd want proper logging here
			_ = err
		}
	}
}
