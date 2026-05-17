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

// GetPostWithAuthor retrieves a single post with author information.
func (r *PostRepository) GetPostWithAuthor(id uint) (*PostWithAuthor, error) {
	var post PostWithAuthor
	err := r.db.Select("posts.*, users.username as author_name, users.avatar as author_avatar").
		Joins("LEFT JOIN users ON users.id = posts.user_id").
		Where("posts.id = ?", id).
		First(&post).Error
	if err != nil {
		return nil, err
	}
	return &post, nil
}

// CommentWithAuthor represents a comment with its author's information.
type CommentWithAuthor struct {
	model.Comment
	AuthorName   string  `json:"author_name"`
	AuthorAvatar *string `json:"author_avatar"`
}

// ListComments retrieves comments for a post with pagination and author info.
func (r *PostRepository) ListComments(postID uint, page, pageSize int) ([]*CommentWithAuthor, int64, error) {
	var comments []*CommentWithAuthor
	var total int64

	offset := (page - 1) * pageSize

	query := r.db.Model(&model.Comment{}).Where("post_id = ?", postID)

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Select("comments.*, users.username as author_name, users.avatar as author_avatar").
		Joins("LEFT JOIN users ON users.id = comments.user_id").
		Offset(offset).Limit(pageSize).Order("comments.created_at DESC").Find(&comments).Error
	if err != nil {
		return nil, 0, err
	}

	return comments, total, nil
}

// IncrementViews increments the view count for a post.
func (r *PostRepository) IncrementViews(id uint) error {
	return r.db.Model(&model.Post{}).Where("id = ?", id).
		Update("views", gorm.Expr("views + ?", 1)).Error
}

// HasUserLiked checks if a user has liked a specific post.
func (r *PostRepository) HasUserLiked(postID, userID uint) (bool, error) {
	var count int64
	err := r.db.Model(&model.Like{}).Where("post_id = ? AND user_id = ?", postID, userID).Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// ListByUserID retrieves posts by user ID with pagination and author info.
func (r *PostRepository) ListByUserID(userID uint, page, pageSize int) ([]*PostWithAuthor, int64, error) {
	var posts []*PostWithAuthor
	var total int64

	offset := (page - 1) * pageSize

	query := r.db.Model(&model.Post{}).Where("posts.user_id = ?", userID)

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
