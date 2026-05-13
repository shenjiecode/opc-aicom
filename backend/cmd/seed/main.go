package main

import (
	"log"
	"time"

	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/pkg/database"
	"github.com/opc-aicom/backend/pkg/config"
)

func main() {
	cfg := config.DatabaseConfig{
		Host:         "localhost",
		Port:         3306,
		User:         "root",
		Password:     "rootpassword",
		Name:         "opc_aicom",
		MaxIdleConns: 10,
		MaxOpenConns: 100,
	}

	db, err := database.InitDB(cfg)
	if err != nil {
		log.Fatalf("Failed to init db: %v", err)
	}

	// Make sure tables exist
	database.AutoMigrate(db, &model.User{}, &model.Post{}, &model.Event{}, &model.Task{})

	// Create test users
	users := []model.User{
		{Username: "AI创业者李薇", PasswordHash: "xxx", Avatar: stringPtr("https://api.dicebear.com/7.x/avataaars/svg?seed=LiWei")},
		{Username: "数字游民阿杰", PasswordHash: "xxx", Avatar: stringPtr("https://api.dicebear.com/7.x/avataaars/svg?seed=AJie")},
		{Username: "SuperBuilder", PasswordHash: "xxx", Avatar: stringPtr("https://api.dicebear.com/7.x/avataaars/svg?seed=Super")},
	}

	for i := range users {
		var existingUser model.User
		if err := db.Where("username = ?", users[i].Username).First(&existingUser).Error; err != nil {
			db.Create(&users[i])
		} else {
			users[i].ID = existingUser.ID
		}
	}

	// Create 8 posts based on the screenshot + some extra varieties
	posts := []model.Post{
		{
			UserID:        users[0].ID,
			Title:         "从0到1搭建AI客服SaaS：MVP阶段踩坑实录",
			Excerpt:       "三个月前启动了一个面向电商的AI客服项目...",
			Content:       "这里是文章的正文内容，记录了搭建AI客服SaaS的详细过程和踩过的坑...",
			Tags:          `["SaaS", "AI客服", "创业经验", "MVP"]`,
			Badge:         "筹备中 / 热议",
			Category:      "创业分享",
			Views:         203,
			CommentsCount: 56,
			CreatedAt:     time.Now().Add(-8 * time.Hour),
		},
		{
			UserID:        users[1].ID,
			Title:         "远程团队协作工具链推荐 - 2026年效率版",
			Excerpt:       "作为常年远程工作的数字游民...",
			Content:       "整理了团队目前正在使用的几款神器，帮助大家提高跨地域协作效率...",
			Tags:          `["远程协作", "效率工具", "团队管理"]`,
			Badge:         "筹备中 / 热议",
			Category:      "效率提升",
			Views:         89,
			CommentsCount: 28,
			CreatedAt:     time.Now().Add(-5 * time.Hour),
		},
		{
			UserID:        users[2].ID,
			Title:         "我的AI创业心得与避坑指南",
			Excerpt:       "创业半年来的总结...",
			Content:       "分享一些关于寻找PMF、构建壁垒以及和投资人沟通的实战经验...",
			Tags:          `["创业", "避坑"]`,
			Badge:         "筹备中 / 热议",
			Category:      "创业分享",
			Views:         89,
			CommentsCount: 22,
			CreatedAt:     time.Now().Add(-24 * time.Hour),
		},
		{
			UserID:        users[0].ID,
			Title:         "利用Cursor和Trae提效的10个工作流技巧",
			Excerpt:       "最近重度使用了这两款AI编程助手，发现了一些隐藏玩法...",
			Content:       "本文详细介绍了如何利用这些工具的自定义指令和快捷键来加速日常开发...",
			Tags:          `["工作流", "AI工具", "效率"]`,
			Category:      "工作流",
			Views:         156,
			CommentsCount: 12,
			CreatedAt:     time.Now().Add(-48 * time.Hour),
		},
		{
			UserID:        users[1].ID,
			Title:         "寻找熟悉Go语言和React的全栈合伙人",
			Excerpt:       "目前项目已经有了初步的验证，急需技术合伙人加入...",
			Content:       "项目方向是企业级AI效率工具，已经拿到种子轮，期望你...",
			Tags:          `["招募", "合伙人", "全栈"]`,
			Badge:         "火热招募",
			Category:      "项目招募",
			Views:         500,
			CommentsCount: 89,
			CreatedAt:     time.Now().Add(-72 * time.Hour),
		},
		{
			UserID:        users[2].ID,
			Title:         "2026年独立开发者出海支付方案对比",
			Excerpt:       "Stripe、Paddle、LemonSqueezy 到底怎么选？",
			Content:       "对比了主流支付渠道的费率、提现周期、风控情况和对接难度...",
			Tags:          `["出海", "支付", "独立开发"]`,
			Category:      "资源推荐",
			Views:         1024,
			CommentsCount: 45,
			CreatedAt:     time.Now().Add(-120 * time.Hour),
		},
		{
			UserID:        users[0].ID,
			Title:         "【求助】如何解决Vite生产环境打包过大的问题",
			Excerpt:       "目前vendor chunk已经超过了2MB，求大佬指点切分策略...",
			Content:       "尝试过manualChunks，但效果不理想，有没有更优雅的配置方式？",
			Tags:          `["前端", "Vite", "性能优化"]`,
			Category:      "求助",
			Views:         78,
			CommentsCount: 15,
			CreatedAt:     time.Now().Add(-2 * time.Hour),
		},
		{
			UserID:        users[1].ID,
			Title:         "深度解析RAG架构中的检索策略优化",
			Excerpt:       "不只是一句prompt的事，聊聊混合检索与重排序...",
			Content:       "分享了我们在构建企业知识库时，从向量检索到加入BM25双路召回的演进历程...",
			Tags:          `["AI", "RAG", "架构设计"]`,
			Badge:         "精华干货",
			Category:      "技术干货",
			Views:         340,
			CommentsCount: 67,
			CreatedAt:     time.Now().Add(-240 * time.Hour),
		},
	}

	for i := range posts {
		db.Create(&posts[i])
	}

	log.Println("Successfully seeded 8 posts!")

	// Create events based on the screenshot
	events := []model.Event{
		{
			Title:       "2026 AI Native 创新者大会",
			Description: "行业峰会，资源对接，项目路演...",
			StartTime:   time.Now().Add(48 * time.Hour), // Set a future time
			EndTime:     time.Now().Add(72 * time.Hour),
			Location:    "上海 · 国际会议中心",
			Category:    "线下峰会",
			Tags:        `["行业峰会", "资源对接", "项目路演"]`,
			Badge:       "报名中",
			Status:      "报名中",
			JoinedCount: 1250,
			LimitCount:  2000,
			ThemeColor:  "from-indigo-400 to-purple-400",
		},
		{
			Title:       "第4期 AIGC 商业化落地实战营",
			Description: "实战教学，变现指南，案例解析...",
			StartTime:   time.Now().Add(2 * time.Hour),
			EndTime:     time.Now().Add(4 * time.Hour),
			Location:    "腾讯会议",
			Category:    "线上直播",
			Tags:        `["实战教学", "变现指南", "案例解析"]`,
			Badge:       "即将开始",
			Status:      "即将开始",
			JoinedCount: 342,
			LimitCount:  500,
			ThemeColor:  "from-teal-300 to-emerald-400",
		},
		{
			Title:       "OPC 平台创作者沙龙（北京站）",
			Description: "同城面基，闭门交流，下午茶...",
			StartTime:   time.Now().Add(168 * time.Hour),
			EndTime:     time.Now().Add(172 * time.Hour),
			Location:    "北京 · 中关村创业大街",
			Category:    "沙龙聚会",
			Tags:        `["同城面基", "闭门交流", "下午茶"]`,
			Badge:       "报名中",
			Status:      "报名中",
			JoinedCount: 89,
			LimitCount:  100,
			ThemeColor:  "from-rose-400 to-orange-300",
		},
	}

	for i := range events {
		db.Create(&events[i])
	}

	log.Println("Successfully seeded 3 events!")

	// Create tasks based on the screenshot
	tasks := []model.Task{
		{
			UserID:          users[0].ID,
			Title:           "RAG企业知识库搭建咨询",
			Description:     "企业内部有大量非结构化文档，需要技术咨询如何选型向量数据库、Embedding模型，并搭建MVP版本的问答机器人。",
			Budget:          10000.00,
			Type:            "软件开发",
			Level:           "高级",
			Status:          "open",
			Urgent:          false,
			DurationDays:    10,
			ApplicantsCount: 9,
		},
		{
			UserID:          users[1].ID,
			Title:           "Midjourney 商业插画生成（系列）",
			Description:     "使用Midjourney生成一系列具有统一画风的商业插画，用于SaaS产品官网配图。需通过垫图或提示词控制一致性。",
			Budget:          2000.00,
			Type:            "平面设计",
			Level:           "初级",
			Status:          "open",
			Urgent:          false,
			DurationDays:    4,
			ApplicantsCount: 45,
		},
		{
			UserID:          users[2].ID,
			Title:           "商业计划书(BP)内容梳理与PPT美化",
			Description:     "已有初步商业模式和数据，需要一位懂商业逻辑的专家帮忙梳理核心亮点，并进行PPT排版美化。",
			Budget:          8000.00,
			Type:            "平面设计",
			Level:           "高级",
			Status:          "open",
			Urgent:          true,
			DurationDays:    3,
			ApplicantsCount: 4,
		},
		{
			UserID:          users[0].ID,
			Title:           "Discord社区日常运营与短剧策划",
			Description:     "负责Web3项目的Discord社区日常活跃，回答用户问题，并策划每周一次的线上短剧活动。",
			Budget:          6000.00,
			Type:            "短剧",
			Level:           "中级",
			Status:          "open",
			Urgent:          false,
			DurationDays:    30,
			ApplicantsCount: 12,
		},
	}

	for i := range tasks {
		db.Create(&tasks[i])
	}

	log.Println("Successfully seeded 4 tasks!")
}

func stringPtr(s string) *string {
	return &s
}
