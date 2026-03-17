/**
 * Pintro 数据抓取Demo
 * 遵循技术方案 v0.0.2
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const _ = require('lodash');

// 配置
const CONFIG = {
  concurrency: 3,
  requestDelayMin: 1000,
  requestDelayMax: 3000,
  outputFile: path.join(__dirname, 'pintro-demo-data.json'),
  cacheDir: path.join(__dirname, 'cache'),
  // 抓取目标：上海热门商圈
  targetCity: '上海',
  // 这里填入大众点评的店铺URL列表
  // 可以从分类页面收集链接
  urls: [
    // 示例：添加URL到这里
    // 'https://www.dianping.com/shop/xxxxxxx'
  ],
};

// 确保目录存在
if (!fs.existsSync(CONFIG.cacheDir)) {
  fs.mkdirSync(CONFIG.cacheDir, { recursive: true });
}

/**
 * 随机延时
 */
function randomDelay() {
  const delay = Math.floor(
    CONFIG.requestDelayMin +
    Math.random() * (CONFIG.requestDelayMax - CONFIG.requestDelayMin)
  );
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 读取缓存或抓取页面
 */
async function fetchPage(url, browser) {
  const cacheKey = Buffer.from(url).toString('base64').substring(0, 32);
  const cachePath = path.join(CONFIG.cacheDir, `${cacheKey}.html`);

  // 检查缓存
  if (fs.existsSync(cachePath)) {
    console.log(`[缓存] ${url}`);
    return fs.readFileSync(cachePath, 'utf-8');
  }

  // 抓取新页面
  console.log(`[抓取] ${url}`);
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  // 滚动加载内容
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  const html = await page.content();
  await page.close();
  fs.writeFileSync(cachePath, html);
  await randomDelay();
  return html;
}

/**
 * 使用LLM提取结构化数据
 */
async function extractStructuredData(html) {
  const prompt = `
从以下大众点评店铺页面内容中提取信息，输出严格JSON格式：
{
  "name": "",         // 店名
  "city": "",        // 所在城市
  "category": "",    // 地点大类型：餐厅/景点/博物馆/咖啡馆/酒店/商店/体验
  "address": "",     // 完整地址
  "lat": 0,          // 纬度（数字）
  "lng": 0,          // 经度（数字）
  "source_rating": 0,// 原始平台评分（数字，1-5）
  "review_count": 0, // 点评数量（数字）
  "price_range": "", // 平均消费价格区间，如"人均 50-100"，没有就填空字符串
  "tags": [],        // 分类/特色标签数组，每个标签2-4字
  "source_description": "", // 原始简介
  "opening_hours_text": "", // 原始营业时间文本，没有就填空
  "opening_hours_structured": [], // 结构化营业时间，每项包含day(mon/tue/wed/thu/fri/sat/sun), start, end，没有就填空数组
  "phone": "",       // 联系电话，没有就填空
  "official_url": "" // 官方网站，没有就填空
}

页面内容：
${html.slice(0, 8000)} // 限制长度，避免超出上下文
  `.trim();

  // 调用OpenClaw AI完成提取
  // 这里使用process.stdout.write和读取stdin方式调用
  // 在实际运行中，会由AI处理返回结果
  // 此处占位，实际运行时通过AI调用
  try {
    // 由于是Node.js环境，我们将prompt写出到临时文件
    // 然后由AI读取并返回结果
    const tmpPath = path.join(CONFIG.cacheDir, `extract-prompt-${Date.now()}.txt`);
    fs.writeFileSync(tmpPath, prompt);
    
    // 这里需要调用AI，返回JSON
    console.log('[LLM提取] 请求提取结构化数据...');
    
    // 在实际运行中，这里会被AI拦截处理
    // 我们抛出提示让AI处理
    throw new Error('NEED_AI_EXTRACTION:' + tmpPath);
  } catch (e) {
    throw e;
  }
}

/**
 * AI精简描述
 */
async function aiSimplifyDescription(sourceDescription) {
  const prompt = `
你是Pintro旅行编辑。将以下店铺简介精简为15-30字的旅行推荐语，
风格：亲切、有画面感、突出亮点。

原文：${sourceDescription}

推荐语：
  `.trim();

  // 调用AI返回结果
  console.log('[AI精简] 精简描述...');
  // 实际由AI处理，这里抛出需要AI处理
  throw new Error('NEED_AI_PROMPT:' + prompt);
}

/**
 * AI打Pintro推荐分
 */
async function aiRateLocation(data) {
  const prompt = `
你是Pintro旅行推荐官，请根据以下信息给这个地点打推荐分（1-5分）：
- 名称：${data.name}
- 类型：${data.category}
- 原始评分：${data.source_rating}
- 点评数：${data.review_count}
- 简介：${data.source_description}

打分参考标准：
1分：不推荐，没有特色
2分：一般，可去可不去
3分：不错，值得顺路去
4分：推荐，值得专门去
5分：强烈推荐，本地特色必须体验

请直接输出数字分数（1-5）：
  `.trim();

  console.log('[AI打分] 打分推荐分...');
  throw new Error('NEED_AI_PROMPT:' + prompt);
}

/**
 * 第一轮规则过滤
 */
function firstRoundFilter(data) {
  // 必填字段缺失
  const requiredFields = ['name', 'city', 'category', 'address', 'lat', 'lng', 'source_rating', 'review_count', 'tags', 'image_url'];
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      if (field !== 'image_url') { // image_url可以为空？不，也是必填
        return { pass: false, reason: `缺少必填字段: ${field}` };
      }
    }
  }

  // 评论数太少
  if (data.review_count < 100) {
    return { pass: false, reason: `点评数过少: ${data.review_count}` };
  }

  // 原始评分太低
  if (data.source_rating < 3.0) {
    return { pass: false, reason: `原始评分过低: ${data.source_rating}` };
  }

  // 经纬度范围检查（中国范围简单过滤）
  if (data.lat < 10 || data.lat > 50 || data.lng < 70 || data.lng > 140) {
    return { pass: false, reason: `经纬度范围异常: ${data.lat}, ${data.lng}` };
  }

  return { pass: true };
}

/**
 * 第二轮过滤（AI处理后）
 */
function secondRoundFilter(data) {
  // Pintro推荐分太低
  if (data.pintro_rating < 3.5) {
    return { pass: false, reason: `Pintro推荐分过低: ${data.pintro_rating}` };
  }

  // 没有特色标签
  if (!data.tags || data.tags.length === 0) {
    return { pass: false, reason: '没有提取到特色标签' };
  }

  return { pass: true };
}

/**
 * 去重
 */
function deduplicate(items) {
  const result = [];
  const map = new Map();

  for (const item of items) {
    const key = `${item.name}-${item.address}`.toLowerCase().replace(/\s+/g, ' ');
    // 计算简单相似度，如果已有相似地点，保留评分高的
    let foundSimilar = false;
    for (const [existingKey, existingItem] of map.entries()) {
      if (existingKey.includes(item.name.toLowerCase()) || 
          item.name.toLowerCase().includes(existingItem.name.toLowerCase())) {
        // 相似名称，保留评分高的
        if (item.pintro_rating > existingItem.pintro_rating) {
          map.delete(existingKey);
          map.set(key, item);
        }
        foundSimilar = true;
        break;
      }
    }
    if (!foundSimilar) {
      map.set(key, item);
    }
  }

  for (const item of map.values()) {
    result.push(item);
  }

  return result;
}

/**
 * 处理单个URL
 */
async function processUrl(url, browser) {
  try {
    const html = await fetchPage(url, browser);
    
    // 1. LLM提取结构化数据
    const extracted = await extractStructuredData(html);
    console.log(`[提取完成] ${extracted.name}`);
    
    // 2. 第一轮规则过滤
    const firstCheck = firstRoundFilter(extracted);
    if (!firstCheck.pass) {
      console.log(`[过滤-第一轮] 丢弃: ${firstCheck.reason}`);
      return null;
    }
    
    // 3. AI处理：精简描述 + 打分
    const description = await aiSimplifyDescription(extracted.source_description || '');
    const rating = await aiRateLocation(extracted);
    
    // 组装最终数据
    const item = {
      name: extracted.name,
      city: extracted.city,
      category: extracted.category,
      address: extracted.address,
      location: {
        lat: extracted.lat,
        lng: extracted.lng,
      },
      source_rating: extracted.source_rating,
      pintro_rating: rating,
      review_count: extracted.review_count,
      price_range: extracted.price_range || '',
      tags: extracted.tags || [],
      description: description,
      opening_hours: {
        text: extracted.opening_hours_text || '',
        structured: extracted.opening_hours_structured || [],
      },
      phone: extracted.phone || '',
      official_url: extracted.official_url || '',
      image_url: extracted.image_url || '',
    };
    
    // 4. 第二轮过滤
    const secondCheck = secondRoundFilter(item);
    if (!secondCheck.pass) {
      console.log(`[过滤-第二轮] 丢弃: ${secondCheck.reason}`);
      return null;
    }
    
    console.log(`[通过] ${item.name} 评分: ${item.pintro_rating}`);
    return item;
  } catch (e) {
    console.log(`[失败] ${url}: ${e.message}`);
    return null;
  }
}

/**
 * 分批并发处理
 */
async function processBatch(urls, browser, batchSize = 3) {
  const result = [];
  
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    console.log(`\n=== 批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(urls.length/batchSize)} 开始 ===`);
    
    const promises = batch.map(url => processUrl(url, browser));
    const batchResults = await Promise.all(promises);
    
    for (const item of batchResults) {
      if (item) {
        result.push(item);
      }
    }
    
    console.log(`=== 批次完成，当前累计 ${result.length} 条 ===`);
  }
  
  return result;
}

/**
 * 从文件读取URL列表（每行一个URL）
 */
function loadUrlsFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`[警告] URL列表文件不存在: ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const urls = content.split('\n')
    .map(line => line.trim())
    .filter(line => line && line.startsWith('http'));
  console.log(`[加载] 从文件加载了 ${urls.length} 个URL`);
  return urls;
}

/**
 * 主函数
 */
async function main() {
  console.log('=== Pintro 数据抓取 Demo 开始 ===');
  console.log(`目标城市: ${CONFIG.targetCity}`);

  // 尝试从urls.txt加载URL列表
  const urlsFile = path.join(__dirname, 'urls.txt');
  let urls = loadUrlsFromFile(urlsFile);
  
  // 如果配置里也有URL，合并进去
  if (CONFIG.urls && CONFIG.urls.length > 0) {
    urls = urls.concat(CONFIG.urls);
  }
  
  if (urls.length === 0) {
    console.log('错误: 没有URL要抓取，请在scripts/data-fetch/urls.txt中添加URL，每行一个');
    console.log('示例: https://www.dianping.com/shop/xxxxxxx');
    process.exit(1);
  }
  
  console.log(`总共 ${urls.length} 个URL待抓取`);

  // 启动浏览器
  const browser = await chromium.launch({ headless: true });
  console.log('浏览器启动完成');

  // 分批并发抓取
  const result = await processBatch(urls, browser, CONFIG.concurrency);

  // 去重
  const finalResult = deduplicate(result);

  // 输出文件
  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(finalResult, null, 2));
  console.log(`\n=== 全部完成 ===`);
  console.log(`原始抓取: ${urls.length} 个`);
  console.log(`过滤后: ${result.length} 个`);
  console.log(`去重后: ${finalResult.length} 个`);
  console.log(`输出文件: ${CONFIG.outputFile}`);

  await browser.close();
}

// 启动
main().catch(err => {
  console.error('错误:', err.message);
  process.exit(1);
});

