package repository

import (
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// ProjectRepository handles project database operations.
type ProjectRepository struct {
	db *gorm.DB
}

// NewProjectRepository creates a new ProjectRepository.
func NewProjectRepository(db *gorm.DB) *ProjectRepository {
	return &ProjectRepository{db: db}
}

// Create creates a new project.
func (r *ProjectRepository) Create(project *model.Project) error {
	return r.db.Create(project).Error
}

// GetByID retrieves a project by ID.
func (r *ProjectRepository) GetByID(id uint) (*model.Project, error) {
	var project model.Project
	err := r.db.First(&project, id).Error
	if err != nil {
		return nil, err
	}
	return &project, nil
}

// GetBySlug retrieves a project by slug.
func (r *ProjectRepository) GetBySlug(slug string) (*model.Project, error) {
	var project model.Project
	err := r.db.Where("slug = ?", slug).First(&project).Error
	if err != nil {
		return nil, err
	}
	return &project, nil
}

// GetByClient retrieves projects by client ID.
func (r *ProjectRepository) GetByClient(clientID uint) ([]*model.Project, error) {
	var projects []*model.Project
	err := r.db.Where("client_id = ?", clientID).Find(&projects).Error
	return projects, err
}

// GetByProvider retrieves projects by provider ID.
func (r *ProjectRepository) GetByProvider(providerID uint) ([]*model.Project, error) {
	var projects []*model.Project
	err := r.db.Where("provider_id = ?", providerID).Find(&projects).Error
	return projects, err
}

// Update updates a project.
func (r *ProjectRepository) Update(project *model.Project) error {
	return r.db.Save(project).Error
}

// Delete soft deletes a project.
func (r *ProjectRepository) Delete(id uint) error {
	return r.db.Delete(&model.Project{}, id).Error
}

// List retrieves projects with pagination.
func (r *ProjectRepository) List(page, pageSize int) ([]*model.Project, int64, error) {
	var projects []*model.Project
	var total int64

	r.db.Model(&model.Project{}).Count(&total)

	offset := (page - 1) * pageSize
	err := r.db.Offset(offset).Limit(pageSize).Find(&projects).Error
	return projects, total, err
}