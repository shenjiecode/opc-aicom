package repository

import (
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// ProjectRoomRepository handles project room database operations.
type ProjectRoomRepository struct {
	db *gorm.DB
}

// NewProjectRoomRepository creates a new ProjectRoomRepository.
func NewProjectRoomRepository(db *gorm.DB) *ProjectRoomRepository {
	return &ProjectRoomRepository{db: db}
}

// CreateRoom creates a new project room.
func (r *ProjectRoomRepository) CreateRoom(room *model.ProjectRoom) error {
	return r.db.Create(room).Error
}

// GetByID retrieves a project room by ID.
func (r *ProjectRoomRepository) GetByID(id uint) (*model.ProjectRoom, error) {
	var room model.ProjectRoom
	err := r.db.First(&room, id).Error
	if err != nil {
		return nil, err
	}
	return &room, nil
}

// GetByProject retrieves all rooms of a project.
func (r *ProjectRoomRepository) GetByProject(projectID uint) ([]*model.ProjectRoom, error) {
	var rooms []*model.ProjectRoom
	err := r.db.Where("project_id = ?", projectID).Find(&rooms).Error
	return rooms, err
}

// GetByMatrixRoom retrieves a project room by Matrix room ID.
func (r *ProjectRoomRepository) GetByMatrixRoom(matrixRoomID string) (*model.ProjectRoom, error) {
	var room model.ProjectRoom
	err := r.db.Where("matrix_room_id = ?", matrixRoomID).First(&room).Error
	if err != nil {
		return nil, err
	}
	return &room, nil
}

// UpdateMemberCount updates the member count of a room.
func (r *ProjectRoomRepository) UpdateMemberCount(roomID uint, count int) error {
	return r.db.Model(&model.ProjectRoom{}).
		Where("id = ?", roomID).
		Update("member_count", count).Error
}

// Delete soft deletes a project room.
func (r *ProjectRoomRepository) Delete(id uint) error {
	return r.db.Delete(&model.ProjectRoom{}, id).Error
}