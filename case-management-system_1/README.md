# 案件管理系統

委託案件資料庫，支援多用戶、角色權限、SQLite 資料庫。

## 功能

- 登入 / 登出（session 驗證）
- 三種角色：管理員 / 一般用戶 / 查看者
- 案件 CRUD：地址、委託公司、公司網站、網站登入帳密、委託價格、開發姓名、開發電話、配按時間、截止日、備注
- 操作人自動記錄
- 搜索、篩選、排序、分頁
- 用戶管理（管理員）
- SQLite 資料庫（單一 .db 檔案）

## 預設帳號

| 帳號 | 密碼 | 角色 |
|------|------|------|
| admin | admin123 | 管理員 |
| user1 | user123 | 一般用戶 |
| viewer | view123 | 查看者 |

**⚠️ 上線前請先到系統內修改密碼！**

---

## 本機執行

```bash
npm install
npm start
```

瀏覽器開啟 http://localhost:3000

---

## 部署方法

### 方法一：Railway（推薦，免費）

1. 前往 https://railway.app 註冊
2. 點 "New Project" → "Deploy from GitHub repo"
3. 上傳此資料夾到 GitHub，連結 Railway
4. Railway 自動偵測 Node.js，點 Deploy
5. 設定環境變數（選填）：
   - `SESSION_SECRET` = 任意長字串（建議設定）
   - `PORT` = Railway 自動設定，不用填

### 方法二：Render（免費）

1. 前往 https://render.com 註冊
2. New → Web Service → Connect GitHub repo
3. Build Command: `npm install`
4. Start Command: `npm start`
5. 環境變數加入 `SESSION_SECRET`

### 方法三：VPS / 自有伺服器

```bash
# 安裝 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 上傳檔案後
cd case-mgmt
npm install
npm start

# 使用 PM2 常駐執行
npm install -g pm2
pm2 start server.js --name case-mgmt
pm2 startup
pm2 save
```

### 方法四：Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -t case-mgmt .
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data case-mgmt
```

---

## 環境變數

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `PORT` | 監聽埠號 | 3000 |
| `SESSION_SECRET` | Session 加密金鑰 | case-mgmt-secret-2025 |
| `DB_PATH` | SQLite 資料庫路徑 | ./data.db |

---

## 注意事項

- 資料儲存在 `data.db`，請定期備份此檔案
- 部署到 Railway / Render 時，每次 redeploy 資料會重置（這些平台不支援持久磁碟免費版）
- 建議搭配 VPS 或付費方案以保留資料
- 若需要多台伺服器，改用 PostgreSQL / MySQL（修改 `db.js`）
