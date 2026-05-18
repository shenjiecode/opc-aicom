package router

import (
	"sort"
	"sync"

	"github.com/opc-aicom/aigateway/internal/model"
)

type priorityGroup struct {
	priority int
	channels []*model.AIChannel
	lb       *LoadBalancer
}

type ChannelSelector struct {
	groups []*priorityGroup
	mu     sync.RWMutex
}

func NewChannelSelector(channels []*model.AIChannel) *ChannelSelector {
	s := &ChannelSelector{}
	s.buildGroups(channels)
	return s
}

func (cs *ChannelSelector) Select() *model.AIChannel {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	for _, group := range cs.groups {
		if ch := group.lb.Next(); ch != nil {
			return ch
		}
	}
	return nil
}

func (cs *ChannelSelector) MarkFailed(channelID uint) {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	for _, group := range cs.groups {
		group.lb.MarkFailed(channelID)
	}
}

func (cs *ChannelSelector) MarkSuccess(channelID uint) {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	for _, group := range cs.groups {
		group.lb.MarkSuccess(channelID)
	}
}

func (cs *ChannelSelector) UpdateChannels(channels []*model.AIChannel) {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	cs.buildGroups(channels)
}

func (cs *ChannelSelector) GetAvailableCount() int {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	count := 0
	for _, group := range cs.groups {
		count += group.lb.GetAvailableCount()
	}
	return count
}

func (cs *ChannelSelector) buildGroups(channels []*model.AIChannel) {
	groupMap := make(map[int][]*model.AIChannel)
	for _, ch := range channels {
		groupMap[ch.Priority] = append(groupMap[ch.Priority], ch)
	}

	priorities := make([]int, 0, len(groupMap))
	for p := range groupMap {
		priorities = append(priorities, p)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(priorities)))

	groups := make([]*priorityGroup, 0, len(priorities))
	for _, p := range priorities {
		chs := groupMap[p]
		groups = append(groups, &priorityGroup{
			priority: p,
			channels: chs,
			lb:       NewLoadBalancer(chs),
		})
	}

	cs.groups = groups
}
