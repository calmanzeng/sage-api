# 🧭 Sage API

奇门遁甲 + 紫微斗数 HTTP API 服务。任何 LLM/Agent 可通过 HTTP 调用获取排盘数据。

## 快速部署

### Railway.app (推荐)

```bash
# 1. Fork 此仓库
# 2. 在 Railway 新建项目 → 选择此仓库
# 3. 部署完成，自动获得 https://sage-api.up.railway.app
```

### 本地启动

```bash
npm install
ZIWEI_DIR=/path/to/ziwei-doushu npm start
# 默认端口 3456，可设 SAGE_API_PORT=8888
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV ZIWEI_DIR=/app/node_modules/iztro
EXPOSE 3456
CMD ["node", "sage-api-server.js"]
```

## 端点

| 端点 | 方法 | 说明 |
|:----|:----|:------|
| /api/health | GET | 健康检查 |
| /api/qimen | POST | 奇门遁甲排盘 |
| /api/ziwei | POST | 紫微斗数排盘 |

### 奇门遁甲排盘

```json
POST /api/qimen
{ "date": "2026-07-17 18:00", "method": "时家", "purpose": "综合" }
```

返回：局数/四柱/值符/值使/八门/九星/八神/格局/空亡/逐宫分析

### 紫微斗数排盘

```json
POST /api/ziwei
{ "year": 2000, "month": 8, "day": 18, "hour": 3, "gender": "female" }
```

返回：五行局/命宫身宫/十二宫(主星+四化+辅星+杂曜+大限+长生十二神等)

## 技术栈

- Node.js 内置 http 模块（零外部 Web 框架依赖）
- lunar-javascript — 农历/节气/四柱
- iztro — 紫微斗数排盘
