package router

import (
	"errors"
	"sync"

	"github.com/opc-aicom/aigateway/internal/model"
)

var ErrNoAvailableChannels = errors.New("no available channels")
type LoadBalancer struct {
	channels []*model.AIChannel
	current  int
	mu       sync.RWMutex
}

func NewLoadBalancer(channels []*model.AIChannel) *LoadBalancer {
	return &LoadBalancer{
		channels: channels,
		current:  0,
	}
}

func (lb *LoadBalancer) Next() *model.AIChannel {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	if len(lb.channels) == 0 {
		return nil
	}

	start := lb.current
	for {
		channel := lb.channels[lb.current]
		lb.current = (lb.current + 1) % len(lb.channels)

		if channel.CanUse() {
			return channel
		}

		if lb.current == start {
			return nil
		}
	}
}

func (lb *LoadBalancer) MarkFailed(channelID uint) {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	for _, ch := range lb.channels {
		if ch.ID == channelID {
			ch.FailedCount++
			break
		}
	}
}

func (lb *LoadBalancer) MarkSuccess(channelID uint) {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	for _, ch := range lb.channels {
		if ch.ID == channelID {
			ch.FailedCount = 0
			break
		}
	}
}

func (lb *LoadBalancer) UpdateChannels(channels []*model.AIChannel) {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	lb.channels = channels
	lb.current = 0
}

func (lb *LoadBalancer) GetAvailableCount() int {
	lb.mu.RLock()
	defer lb.mu.RUnlock()

	count := 0
	for _, ch := range lb.channels {
		if ch.CanUse() {
			count++
		}
	}
	return count
}
