package repository

import (
	"gorm.io/gorm"

	"github.com/opc-aicom/backend/internal/model"
)

// PostRepository handles database operations for Post.
type PostRepository struct {
	db *gorm.DB
}

// NewPostRepository creates a new PostRepository.
func NewPostRepository(db *gorm.DB) *PostRepository {
	return &PostRepository{db: db}
}

// Create creates a new post.
func (r *PostRepository) Create(post *model.Post) (*model.Post, error) {
	err := r.db.Create(post).Error
	if err != nil {
		return nil, err
	}
	return post, nil
}

// GetByID retrieves a post by ID.
func (r *PostRepository) GetByID(id uint) (*model.Post, error) {
	var post model.Post
	err := r.db.Where("id = ?", id).First(&post).Error
	if err != nil {
		return nil, err
	}
	return &post, nil
}

// PostWithAuthor represents a post with its author's information.
type PostWithAuthor struct {
	model.Post
	AuthorName   string  `json:"author_name"`
	AuthorAvatar *string `json:"author_avatar"`
}

// List retrieves posts with pagination and optional category filter.
func (r *PostRepository) List(page, pageSize int, category string) ([]*PostWithAuthor, int64, error) {
	var posts []*PostWithAuthor
	var total int64

	offset := (page - 1) * pageSize

	query := r.db.Model(&model.Post{})
	if category != "" && category != "全部" {
		query = query.Where("category = ?", category)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Select("posts.*, users.username as author_name, users.avatar as author_avatar").
		Joins("LEFT JOIN users ON users.id = posts.user_id").
		Offset(offset).Limit(pageSize).Order("posts.created_at DESC").Find(&posts).Error
	if err != nil {
		return nil, 0, err
	}

	return posts, total, nil
}

// Update updates a post.
func (r *PostRepository) Update(post *model.Post) error {
	return r.db.Save(post).Error
}

// Delete deletes a post by ID.
func (r *PostRepository) Delete(id uint) error {
	return r.db.Where("id = ?", id).Delete(&model.Post{}).Error
}
