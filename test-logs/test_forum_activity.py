#!/usr/bin/env python3
"""
Forum & Activity Test Script
Tests the complete flow of forum posts and events
Outputs results to JSON log file
"""

import json
import requests
import time
from datetime import datetime
from typing import Optional, Dict, Any

# Configuration
BASE_URL = "http://localhost:8080/api"
OUTPUT_FILE = "/Users/mac/Downloads/code2025/opc-aicom/test-logs/test_results.json"

class TestLogger:
    def __init__(self):
        self.results = {
            "test_run": datetime.now().isoformat(),
            "total_tests": 0,
            "passed": 0,
            "failed": 0,
            "tests": []
        }
    
    def log_test(self, name: str, success: bool, details: Dict[str, Any] = None):
        self.results["total_tests"] += 1
        if success:
            self.results["passed"] += 1
        else:
            self.results["failed"] += 1
        
        test_entry = {
            "name": name,
            "success": success,
            "timestamp": datetime.now().isoformat(),
            "details": details or {}
        }
        self.results["tests"].append(test_entry)
        
        status = "✅" if success else "❌"
        print(f"{status} {name}")
        if details and not success:
            print(f"   Details: {json.dumps(details, indent=2)}")
    
    def save(self):
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        print(f"\n📄 Results saved to: {OUTPUT_FILE}")
        print(f"   Total: {self.results['total_tests']}, Passed: {self.results['passed']}, Failed: {self.results['failed']}")


class APIClient:
    def __init__(self, logger: TestLogger):
        self.logger = logger
        self.session = requests.Session()
        self.user_id: Optional[int] = None
        self.cookie_token: Optional[str] = None
    
    def request(self, method: str, endpoint: str, data: Dict = None, auth: bool = True) -> tuple:
        url = f"{BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        proxies = {"http": None, "https": None}
        
        # Manually set cookie for auth (workaround for localhost cookie issue)
        if auth and self.cookie_token:
            headers["Cookie"] = f"auth_token={self.cookie_token}"

        try:
            if method == "GET":
                resp = self.session.get(url, headers=headers, params=data, proxies=proxies)
            elif method == "POST":
                resp = self.session.post(url, headers=headers, json=data, proxies=proxies)
            else:
                return False, {"error": f"Unknown method: {method}"}

            # Extract cookie from response
            if 'auth_token' in self.session.cookies:
                self.cookie_token = self.session.cookies.get('auth_token')

            result = resp.json()
            return resp.status_code == 200, result
        except Exception as e:
            return False, {"error": str(e)}
    
    def register_user(self, username: str, password: str) -> bool:
        success, result = self.request("POST", "/user/register", {
            "username": username,
            "password": password,
            "email": f"{username}@test.com"
        }, auth=False)
        
        if success or result.get("code") == 0 or "已存在" in str(result):
            self.logger.log_test("User Registration", True, {"username": username})
            return True
        else:
            self.logger.log_test("User Registration", False, result)
            return False
    
    def login(self, username: str, password: str) -> bool:
        success, result = self.request("POST", "/user/login", {
            "username": username,
            "password": password
        }, auth=False)
        
        if success and result.get("code") == 0:
            self.user_id = result.get("data", {}).get("userId")
            self.logger.log_test("User Login", True, {"username": username, "user_id": self.user_id})
            return True
        else:
            self.logger.log_test("User Login", False, result)
            return False

def test_forum(logger: TestLogger, client: APIClient):
    """Test forum post functionality"""
    
    # 1. Create a post
    success, result = client.request("POST", "/community/create", {
        "title": f"测试帖子 - {datetime.now().strftime('%Y%m%d%H%M%S')}",
        "content": "这是一条自动化测试创建的帖子内容。\n\n测试内容包括多行文本和中文。",
        "category": "技术干货",
        "tags": "测试,自动化,Python"
    })
    
    if not success or result.get("code") != 0:
        logger.log_test("Create Post", False, result)
        return None
    
    post_id = result.get("data", {}).get("postId")
    logger.log_test("Create Post", True, {"post_id": post_id})
    
    # 2. Get post list
    success, result = client.request("POST", "/community/list", {
        "page": 1,
        "pageSize": 10
    }, auth=False)
    
    if success and result.get("code") == 0:
        total = result.get("data", {}).get("total", 0)
        logger.log_test("List Posts", True, {"total": total})
    else:
        logger.log_test("List Posts", False, result)
    
    # 3. Get post detail
    if post_id:
        success, result = client.request("GET", f"/community/{post_id}", auth=False)
        if success and result.get("code") == 0:
            post = result.get("data", {}).get("post", {})
            logger.log_test("Get Post Detail", True, {
                "title": post.get("title"),
                "views": post.get("views")
            })
        else:
            logger.log_test("Get Post Detail", False, result)
        
        # 4. Add comment
        success, result = client.request("POST", "/community/comment", {
            "postId": post_id,
            "content": "这是一条自动化测试评论。"
        })
        
        if success and result.get("code") == 0:
            logger.log_test("Add Comment", True, {"post_id": post_id})
        else:
            logger.log_test("Add Comment", False, result)
        
        # 5. Get comments
        success, result = client.request("GET", f"/community/{post_id}/comments", {
            "page": 1,
            "pageSize": 10
        }, auth=False)
        
        if success and result.get("code") == 0:
            total = result.get("data", {}).get("total", 0)
            logger.log_test("Get Comments", True, {"total": total})
        else:
            logger.log_test("Get Comments", False, result)
        
        # 6. Like post
        success, result = client.request("POST", "/community/like", {
            "postId": post_id
        })
        
        if success and result.get("code") == 0:
            is_liked = result.get("data")
            logger.log_test("Like Post", True, {"post_id": post_id, "is_liked": is_liked})
        else:
            logger.log_test("Like Post", False, result)
    
    return post_id


def test_events(logger: TestLogger, client: APIClient):
    """Test event functionality"""
    
    # 1. Create an event
    from datetime import datetime, timedelta
    start = datetime.now() + timedelta(days=7)
    end = start + timedelta(hours=3)
    
    success, result = client.request("POST", "/event/create", {
        "title": f"测试活动 - {datetime.now().strftime('%Y%m%d%H%M%S')}",
        "description": "这是一场自动化测试创建的活动。",
        "location": "深圳市南山区科技园",
        "start_time": start.strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "end_time": end.strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "category": "技术分享",
        "tags": "测试,AI,技术",
        "limit_count": 100
    })
    
    if not success or result.get("code") != 0:
        logger.log_test("Create Event", False, result)
        return None
    
    event_id = result.get("data", {}).get("id")
    share_code = result.get("data", {}).get("share_code")
    logger.log_test("Create Event", True, {"event_id": event_id, "share_code": share_code})
    
    # 2. Get event list
    success, result = client.request("POST", "/community/events", {
        "page": 1,
        "pageSize": 10
    }, auth=False)
    
    if success and result.get("code") == 0:
        total = result.get("data", {}).get("total", 0)
        logger.log_test("List Events", True, {"total": total})
    else:
        logger.log_test("List Events", False, result)
    
    # 3. Get event detail
    if event_id:
        success, result = client.request("GET", f"/event/{event_id}", auth=False)
        if success and result.get("code") == 0:
            event = result.get("data", {}).get("event", {})
            logger.log_test("Get Event Detail", True, {
                "title": event.get("title"),
                "joined_count": event.get("joined_count")
            })
        else:
            logger.log_test("Get Event Detail", False, result)
        
        # 4. Join event
        success, result = client.request("POST", "/event/join", {
            "event_id": event_id
        })
        
        if success and result.get("code") == 0:
            logger.log_test("Join Event", True, {"event_id": event_id})
        else:
            # Already joined is also success
            if "已报名" in str(result):
                logger.log_test("Join Event", True, {"event_id": event_id, "note": "Already joined"})
            else:
                logger.log_test("Join Event", False, result)
    
    return event_id


def main():
    print("=" * 60)
    print("Forum & Activity Test Script")
    print("=" * 60)
    print()
    
    logger = TestLogger()
    client = APIClient(logger)
    
    # Test user
    test_username = f"testuser_{int(time.time())}"
    test_password = "Test123456"
    
    print("📋 Running tests...\n")
    
    # Register and login
    if not client.register_user(test_username, test_password):
        # Try login if user exists
        if not client.login(test_username, test_password):
            logger.save()
            return
    
    client.login(test_username, test_password)
    
    print("\n📌 Testing Forum...")
    test_forum(logger, client)
    
    print("\n📌 Testing Events...")
    test_events(logger, client)
    
    print("\n" + "=" * 60)
    logger.save()


if __name__ == "__main__":
    main()
