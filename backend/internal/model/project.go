package model

import (
	"time"
)

// Project represents a combined view of Task + Contract + ChatRoom
// This is a view model, not a database table
type Project struct {
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
	Projects []Project `json:"projects"`
	Total    int       `json:"total"`
}