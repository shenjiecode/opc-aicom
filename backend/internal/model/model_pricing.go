package model

// ModelPricing - 模型定价（每1000 tokens的积分消耗）
var ModelPricing = map[string]float64{
	"gpt-4-turbo":       30, // 30 credits per 1k tokens
	"gpt-4":             30,
	"gpt-3.5-turbo":     2,
	"gpt-4o":            5,
	"gpt-4o-mini":       1,
	"claude-3-opus":     30,
	"claude-3-sonnet":   15,
	"claude-3-haiku":    1,
	"claude-3-5-sonnet": 15,
	"deepseek-v4-flash": 1,
	"deepseek-chat":     2,
}

// GetModelPricing returns credits per 1000 tokens for a model
func GetModelPricing(model string) float64 {
	if price, ok := ModelPricing[model]; ok {
		return price
	}
	return 10 // default pricing
}

// CalculateCredits calculates credits to deduct based on tokens and model
func CalculateCredits(model string, totalTokens int) int {
	pricePer1k := GetModelPricing(model)
	credits := float64(totalTokens) * pricePer1k / 1000
	if credits < 1 {
		credits = 1 // minimum 1 credit
	}
	return int(credits)
}