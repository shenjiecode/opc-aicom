package repository

import (
	"github.com/opc-aicom/backend/agents/internal/model"
	"gorm.io/gorm"
)

type SkillRepository struct {
	db *gorm.DB
}

func NewSkillRepository(db *gorm.DB) *SkillRepository {
	return &SkillRepository{db: db}
}

func (r *SkillRepository) Create(skill *model.Skill) error {
	return r.db.Create(skill).Error
}

func (r *SkillRepository) GetByID(id uint) (*model.Skill, error) {
	var skill model.Skill
	err := r.db.First(&skill, id).Error
	if err != nil {
		return nil, err
	}
	return &skill, nil
}

func (r *SkillRepository) GetByName(name string) (*model.Skill, error) {
	var skill model.Skill
	err := r.db.Where("name = ?", name).First(&skill).Error
	if err != nil {
		return nil, err
	}
	return &skill, nil
}

func (r *SkillRepository) List(category string, offset, limit int) ([]model.Skill, int64, error) {
	var skills []model.Skill
	var total int64

	query := r.db.Model(&model.Skill{}).Where("status = ?", model.SkillStatusActive)
	if category != "" {
		query = query.Where("category = ?", category)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Order("install_count DESC, rating DESC").Offset(offset).Limit(limit).Find(&skills).Error
	return skills, total, err
}

func (r *SkillRepository) Search(query string, limit int) ([]model.Skill, error) {
	var skills []model.Skill
	searchPattern := "%" + query + "%"
	err := r.db.Where("status = ? AND (name LIKE ? OR display_name LIKE ? OR description LIKE ?)",
		model.SkillStatusActive, searchPattern, searchPattern, searchPattern).
		Order("install_count DESC, rating DESC").
		Limit(limit).
		Find(&skills).Error
	return skills, err
}

func (r *SkillRepository) Update(skill *model.Skill) error {
	return r.db.Save(skill).Error
}

func (r *SkillRepository) UpdateInstallCount(id uint, increment int) error {
	return r.db.Model(&model.Skill{}).Where("id = ?", id).
		UpdateColumn("install_count", gorm.Expr("install_count + ?", increment)).Error
}

func (r *SkillRepository) Delete(id uint) error {
	return r.db.Delete(&model.Skill{}, id).Error
}

func (r *SkillRepository) GetBySource(source, sourceID string) (*model.Skill, error) {
	var skill model.Skill
	err := r.db.Where("source = ? AND source_id = ?", source, sourceID).First(&skill).Error
	if err != nil {
		return nil, err
	}
	return &skill, nil
}

func (r *SkillRepository) Upsert(skill *model.Skill) error {
	return r.db.Save(skill).Error
}
