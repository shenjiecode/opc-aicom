package model

import (
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ProjectView represents a combined view of Task + Contract + ChatRoom
// This is a view model, not a database table
type ProjectView struct {
	ID            uint           `json:"id"`
	TaskID        uint           `json:"task_id"`
	ContractID    uint           `json:"contract_id"`
	Title         string         `json:"title"`
	Description   string         `json:"description"`
	Status        string         `json:"status"` // contract status: signing, executing, completed
	Progress      int            `json:"progress"`
	Budget        float64        `json:"budget"`
	OwnerID       uint           `json:"owner_id"`
	OwnerName     string         `json:"owner_name"`
	AgentID       uint           `json:"agent_id"`
	AgentName     string         `json:"agent_name"`
	ChatRoomID    string         `json:"chat_room_id"`
	ChatRoomName  string         `json:"chat_room_name"`
	PRDDocument   string         `json:"prd_document"` // path to PRD file
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

// ProjectListResponse represents the response for listing projects
type ProjectListResponse struct {
	Projects []ProjectView `json:"projects"`
	Total    int       `json:"total"`
}

// Project represents a project in the system.
type Project struct {
	ID                    uint            `gorm:"primaryKey" json:"id"`
	Name                  string          `gorm:"type:varchar(255);not null" json:"name"`
	Slug                  string          `gorm:"type:varchar(255);uniqueIndex" json:"slug"`
	Description           string          `gorm:"type:text" json:"description"`
	CoverImage            *string         `json:"cover_image"`
	Category              string          `gorm:"type:varchar(50)" json:"category"`
	Tags                  string          `gorm:"type:varchar(500)" json:"tags"`
	ClientID              uint            `gorm:"index" json:"client_id"`
	ProviderID            uint            `gorm:"index" json:"provider_id"`
	ClientEnterpriseID    *uint           `gorm:"index" json:"client_enterprise_id"`
	ProviderEnterpriseID  *uint           `gorm:"index" json:"provider_enterprise_id"`
	Status                string          `gorm:"type:varchar(20);default:active" json:"status"`
	LifecycleStage        string          `gorm:"type:varchar(50)" json:"lifecycle_stage"`
	StartedAt             *time.Time      `json:"started_at"`
	ExpectedEndAt         *time.Time      `json:"expected_end_at"`
	ActualEndAt           *time.Time      `json:"actual_end_at"`
	TotalAmount           decimal.Decimal `gorm:"type:decimal(12,2)" json:"total_amount"`
	PaidAmount            decimal.Decimal `gorm:"type:decimal(12,2)" json:"paid_amount"`
	FollowersCount        int             `gorm:"default:0" json:"followers_count"`
	DeliverablesCount     int             `gorm:"default:0" json:"deliverables_count"`
	MembersCount          int             `gorm:"default:0" json:"members_count"`
	WorkspaceRoot         string          `gorm:"type:varchar(500)" json:"workspace_root"`
	StorageQuota          int64           `gorm:"default:10737418240" json:"storage_quota"`
	StorageUsed           int64           `gorm:"default:0" json:"storage_used"`
	Visibility            string          `gorm:"type:varchar(20);default:private" json:"visibility"`
	CreatedAt             time.Time       `json:"created_at"`
	UpdatedAt             time.Time       `json:"updated_at"`
	DeletedAt             gorm.DeletedAt  `gorm:"index" json:"-"`
}

func (Project) TableName() string {
	return "projects"
}

// ProjectMember represents a member of a project.
type ProjectMember struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	ProjectID       uint           `gorm:"not null;index" json:"project_id"`
	UserID          uint           `gorm:"not null;index" json:"user_id"`
	Role            string         `gorm:"type:varchar(50);not null" json:"role"`
	PermissionLevel string         `gorm:"type:varchar(20);default:member" json:"permission_level"`
	JoinType        string         `gorm:"type:varchar(20)" json:"join_type"`
	JoinedAt        *time.Time     `json:"joined_at"`
	Status          string         `gorm:"type:varchar(20);default:active" json:"status"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

func (ProjectMember) TableName() string {
	return "project_members"
}

// ProjectRoom represents a room associated with a project.
type ProjectRoom struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	ProjectID    uint           `gorm:"not null;index" json:"project_id"`
	RoomType     string         `gorm:"type:varchar(50)" json:"room_type"`
	MilestoneID   *uint          `gorm:"index" json:"milestone_id"`
	MatrixRoomID string         `gorm:"type:varchar(255);uniqueIndex" json:"matrix_room_id"`
	Name         string         `gorm:"type:varchar(255)" json:"name"`
	Topic        string         `gorm:"type:text" json:"topic"`
	IsOfficial   bool           `gorm:"default:false" json:"is_official"`
	MemberCount  int            `gorm:"default:0" json:"member_count"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt  `gorm:"index" json:"-"`
}

func (ProjectRoom) TableName() string {
	return "project_rooms"
}

// ProjectDeliverable represents a deliverable of a project.
type ProjectDeliverable struct {
	ID              uint            `gorm:"primaryKey" json:"id"`
	ProjectID       uint            `gorm:"not null;index" json:"project_id"`
	MilestoneID     *uint           `gorm:"index" json:"milestone_id"`
	Name            string          `gorm:"type:varchar(255);not null" json:"name"`
	Description     string          `gorm:"type:text" json:"description"`
	DeliverableType string          `gorm:"type:varchar(50)" json:"deliverable_type"`
	Version         string          `gorm:"type:varchar(50)" json:"version"`
	FilePath        string          `gorm:"type:varchar(500)" json:"file_path"`
	FileSize        int64           `json:"file_size"`
	FileType        string          `gorm:"type:varchar(100)" json:"file_type"`
	Status          string          `gorm:"type:varchar(20);default:pending" json:"status"`
	SubmittedAt     *time.Time      `json:"submitted_at"`
	ReviewedBy      *uint           `gorm:"index" json:"reviewed_by"`
	ReviewedAt      *time.Time      `json:"reviewed_at"`
	ReviewComment   string          `gorm:"type:text" json:"review_comment"`
	AcceptedAt      *time.Time      `json:"accepted_at"`
	AcceptedBy      *uint           `json:"accepted_by"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
	DeletedAt       gorm.DeletedAt  `gorm:"index" json:"-"`
}

func (ProjectDeliverable) TableName() string {
	return "project_deliverables"
}

// ProjectPayment represents a payment for a project.
type ProjectPayment struct {
	ID                     uint            `gorm:"primaryKey" json:"id"`
	ProjectID              uint            `gorm:"not null;index" json:"project_id"`
	MilestoneID            *uint           `gorm:"index" json:"milestone_id"`
	PaymentNo              string          `gorm:"type:varchar(50);uniqueIndex" json:"payment_no"`
	Amount                 decimal.Decimal `gorm:"type:decimal(12,2);not null" json:"amount"`
	Currency               string          `gorm:"type:varchar(10);default:CNY" json:"currency"`
	Stage                  string          `gorm:"type:varchar(50)" json:"stage"`
	TriggerCondition      string          `gorm:"type:varchar(255)" json:"trigger_condition"`
	Status                 string          `gorm:"type:varchar(20);default:pending" json:"status"`
	EscrowedAt             *time.Time      `json:"escrowed_at"`
	EscrowTransactionID   *string         `json:"escrow_transaction_id"`
	ReleasedAt             *time.Time      `json:"released_at"`
	ReleaseTransactionID   *string         `json:"release_transaction_id"`
	Remark                 string          `gorm:"type:text" json:"remark"`
	CreatedAt              time.Time       `json:"created_at"`
	UpdatedAt              time.Time       `json:"updated_at"`
}

func (ProjectPayment) TableName() string {
	return "project_payments"
}

// ProjectWorkspace represents a workspace for a project.
type ProjectWorkspace struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	ProjectID       uint           `gorm:"not null;uniqueIndex" json:"project_id"`
	RootPath        string         `gorm:"type:varchar(500)" json:"root_path"`
	StorageType     string         `gorm:"type:varchar(50)" json:"storage_type"`
	OSSEndpoint     string         `gorm:"type:varchar(500)" json:"oss_endpoint"`
	OSSBucket       string         `gorm:"type:varchar(255)" json:"oss_bucket"`
	OSSPrefix       string         `gorm:"type:varchar(255)" json:"oss_prefix"`
	QuotaBytes      int64          `gorm:"default:10737418240" json:"quota_bytes"`
	UsedBytes       int64          `gorm:"default:0" json:"used_bytes"`
	GitEnabled      bool           `gorm:"default:false" json:"git_enabled"`
	GitRepoURL      string         `gorm:"type:varchar(500)" json:"git_repo_url"`
	GitDefaultBranch string         `gorm:"type:varchar(100);default:main" json:"git_default_branch"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

func (ProjectWorkspace) TableName() string {
	return "project_workspaces"
}

// ProjectWorkspaceFile represents a file in a project workspace.
type ProjectWorkspaceFile struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	WorkspaceID     uint           `gorm:"not null;index" json:"workspace_id"`
	Path            string         `gorm:"type:varchar(500);not null" json:"path"`
	Name            string         `gorm:"type:varchar(255);not null" json:"name"`
	FileType        string         `gorm:"type:varchar(100)" json:"file_type"`
	SizeBytes       int64          `json:"size_bytes"`
	CommitHash      string         `gorm:"type:varchar(40)" json:"commit_hash"`
	LastCommitBy    *uint          `json:"last_commit_by"`
	LastCommitAt    *time.Time     `json:"last_commit_at"`
	VersionCount    int            `gorm:"default:0" json:"version_count"`
	Permission      string         `gorm:"type:varchar(20);default:read" json:"permission"`
	IsDeleted       bool           `gorm:"default:false" json:"is_deleted"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

func (ProjectWorkspaceFile) TableName() string {
	return "project_workspace_files"
}

// ProjectActivity represents an activity log for a project.
type ProjectActivity struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	ProjectID   uint           `gorm:"not null;index" json:"project_id"`
	Action      string         `gorm:"type:varchar(100);not null" json:"action"`
	Content     string         `gorm:"type:text" json:"content"`
	Metadata    string         `gorm:"type:text" json:"metadata"`
	ActorID     *uint          `gorm:"index" json:"actor_id"`
	RelatedType string         `gorm:"type:varchar(50)" json:"related_type"`
	RelatedID   *uint          `gorm:"index" json:"related_id"`
	CreatedAt   time.Time      `json:"created_at"`
}

func (ProjectActivity) TableName() string {
	return "project_activities"
}