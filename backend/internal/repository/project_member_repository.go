package repository

import (
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// ProjectMemberRepository handles project member database operations.
type ProjectMemberRepository struct {
	db *gorm.DB
}

// NewProjectMemberRepository creates a new ProjectMemberRepository.
func NewProjectMemberRepository(db *gorm.DB) *ProjectMemberRepository {
	return &ProjectMemberRepository{db: db}
}

// AddMember adds a member to a project.
func (r *ProjectMemberRepository) AddMember(member *model.ProjectMember) error {
	return r.db.Create(member).Error
}

// RemoveMember removes a member from a project.
func (r *ProjectMemberRepository) RemoveMember(projectID, userID uint) error {
	return r.db.Where("project_id = ? AND user_id = ?", projectID, userID).Delete(&model.ProjectMember{}).Error
}

// GetMembers retrieves all members of a project.
func (r *ProjectMemberRepository) GetMembers(projectID uint) ([]*model.ProjectMember, error) {
	var members []*model.ProjectMember
	err := r.db.Where("project_id = ?", projectID).Find(&members).Error
	return members, err
}

// GetMember retrieves a specific member of a project.
func (r *ProjectMemberRepository) GetMember(projectID, userID uint) (*model.ProjectMember, error) {
	var member model.ProjectMember
	err := r.db.Where("project_id = ? AND user_id = ?", projectID, userID).First(&member).Error
	if err != nil {
		return nil, err
	}
	return &member, nil
}

// UpdateRole updates the role of a member.
func (r *ProjectMemberRepository) UpdateRole(projectID, userID uint, role string) error {
	return r.db.Model(&model.ProjectMember{}).
		Where("project_id = ? AND user_id = ?", projectID, userID).
		Update("role", role).Error
}

// IsMember checks if a user is a member of a project.
func (r *ProjectMemberRepository) IsMember(projectID, userID uint) bool {
	var count int64
	r.db.Model(&model.ProjectMember{}).
		Where("project_id = ? AND user_id = ?", projectID, userID).
		Count(&count)
	return count > 0
}

// GetByUser retrieves all project memberships for a user.
func (r *ProjectMemberRepository) GetByUser(userID uint) ([]*model.ProjectMember, error) {
	var members []*model.ProjectMember
	err := r.db.Where("user_id = ?", userID).Find(&members).Error
	return members, err
}