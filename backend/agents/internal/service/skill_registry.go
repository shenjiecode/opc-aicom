package service

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/opc-aicom/backend/agents/internal/model"
	"github.com/opc-aicom/backend/agents/internal/repository"
)

type SkillRegistry struct {
	repo *repository.SkillRepository
}

func NewSkillRegistry(repo *repository.SkillRepository) *SkillRegistry {
	return &SkillRegistry{repo: repo}
}

func (s *SkillRegistry) Register(ctx context.Context, skill *model.Skill) error {
	return s.repo.Create(skill)
}

func (s *SkillRegistry) GetByID(ctx context.Context, id uint) (*model.Skill, error) {
	return s.repo.GetByID(id)
}

func (s *SkillRegistry) GetByName(ctx context.Context, name string) (*model.Skill, error) {
	return s.repo.GetByName(name)
}

func (s *SkillRegistry) List(ctx context.Context, category string, offset, limit int) ([]model.Skill, int64, error) {
	return s.repo.List(category, offset, limit)
}

func (s *SkillRegistry) Search(ctx context.Context, query string, limit int) ([]model.MatchedSkill, error) {
	skills, err := s.repo.Search(query, limit)
	if err != nil {
		return nil, err
	}

	var matched []model.MatchedSkill
	for _, skill := range skills {
		score := s.calculateRelevance(query, skill)
		matched = append(matched, model.MatchedSkill{
			SkillID:        skill.ID,
			SkillName:      skill.Name,
			DisplayName:    skill.DisplayName,
			RelevanceScore: score,
			Reason:         s.generateReason(query, skill),
		})
	}

	s.sortByRelevance(matched)
	return matched, nil
}

func (s *SkillRegistry) calculateRelevance(query string, skill model.Skill) float64 {
	query = strings.ToLower(query)
	name := strings.ToLower(skill.Name)
	displayName := strings.ToLower(skill.DisplayName)
	description := strings.ToLower(skill.Description)

	var score float64

	if name == query || displayName == query {
		score = 1.0
	} else if strings.Contains(name, query) || strings.Contains(displayName, query) {
		score = 0.8
	} else if strings.Contains(description, query) {
		score = 0.6
	} else {
		tags := s.parseTags(skill.Tags)
		for _, tag := range tags {
			if strings.Contains(strings.ToLower(tag), query) {
				score = 0.5
				break
			}
		}
	}

	if skill.Rating > 0 {
		score = score * (0.8 + skill.Rating/25)
	}

	return score
}

func (s *SkillRegistry) parseTags(tagsJSON string) []string {
	if tagsJSON == "" {
		return nil
	}
	var tags []string
	_ = json.Unmarshal([]byte(tagsJSON), &tags)
	return tags
}

func (s *SkillRegistry) generateReason(query string, skill model.Skill) string {
	return "匹配关键词: " + query + ", 类型: " + skill.Category
}

func (s *SkillRegistry) sortByRelevance(skills []model.MatchedSkill) {
	for i := 0; i < len(skills)-1; i++ {
		for j := i + 1; j < len(skills); j++ {
			if skills[i].RelevanceScore < skills[j].RelevanceScore {
				skills[i], skills[j] = skills[j], skills[i]
			}
		}
	}
}

func (s *SkillRegistry) UpdateInstallCount(ctx context.Context, id uint, increment int) error {
	return s.repo.UpdateInstallCount(id, increment)
}

func (s *SkillRegistry) SyncFromMCPMarketplace(ctx context.Context, skills []model.Skill) (int, int, int) {
	added, updated, removed := 0, 0, 0

	for _, skill := range skills {
		existing, err := s.repo.GetBySource(skill.Source, skill.SourceID)
		if err != nil {
			s.repo.Create(&skill)
			added++
		} else {
			existing.DisplayName = skill.DisplayName
			existing.Description = skill.Description
			existing.Version = skill.Version
			existing.MCPTools = skill.MCPTools
			s.repo.Update(existing)
			updated++
		}
	}

	return added, updated, removed
}
