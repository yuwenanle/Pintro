# Pintro 数据抓取 Demo

基于技术方案 **v0.0.2** 实现。

## 功能

- Playwright 抓取大众点评页面
- 缓存原始HTML，支持断点续爬
- LLM 结构化提取数据
- 双层过滤 + AI 打分 + 去重
- 输出 `pintro-demo-data.json` 供前端使用

## 输出字段

| 字段 | 说明 | 是否必填 |
|------|------|----------|
| name | 地点名称 | ✅ 必填 |
| city | 所在城市 | ✅ 必填 |
| category | 地点大类型 | ✅ 必填 |
| address | 详细地址 | ✅ 必填 |
| lat | 纬度 | ✅ 必填 |
| lng | 经度 | ✅ 必填 |
| source_rating | 原始平台评分 | ✅ 保留 |
| pintro_rating | Pintro AI推荐分 | ✅ 展示 |
| review_count | 点评数量 | ✅ 必填 |
| price_range | 平均消费价格区间 | ⭕ 可选 |
| tags | 特色标签数组 | ✅ 必填 |
| description | AI精简推荐语 | ✅ 必填 |
| opening_hours.text | 原始营业时间文本 | ⭕ 可选 |
| opening_hours.structured | 结构化分时数据 | ⭕ 可选 |
| phone | 联系电话 | ⭕ 可选 |
| official_url | 官方网站链接 | ⭕ 可选 |
| image_url | 主图URL | ✅ 必填 |

## 安装依赖

```bash
cd scripts/data-fetch
npm install
npx playwright install chromium
```

## 运行

```bash
npm run fetch
```

## 技术方案文档

飞书文档：https://www.feishu.cn/docx/VlJkdic9oovHhGxblCxc1no2n9e

## 版本记录

- v0.0.2 (2026-03-17)：更新完整输出字段，增加 city、category、结构化营业时间
- v0.0.1 (2026-03-17)：初始框架搭建
