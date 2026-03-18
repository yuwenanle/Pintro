
/**
 * Pintro 数据抓取Demo - Amap Web API 版本
 * 使用高德地图Web服务API获取POI详情
 * 遵循技术方案 v0.0.2
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// 配置 - 请替换为实际的Key和Secret
const CONFIG = {
  amap: {
    key: '2d4f60de38352d277dbd384826213154',
    secret: '', // 数字签名已关闭
  },
  outputFile: path.join(__dirname, 'pintro-demo-data-api.json'),
  cacheDir: path.join(__dirname, 'cache'),
  // 抓取目标：上海松江区关键词搜索
  keywords: ['一尺花园', '咖啡', '农家菜', '景点', '网红', '松江特色'],
  city: '上海',
  cityCode: '310117', // 松江区
};

// 确保目录存在
if (!fs.existsSync(CONFIG.cacheDir)) {
  fs.mkdirSync(CONFIG.cacheDir, { recursive: true });
}

/**
 * HTTP GET请求封装
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 生成数字签名 (如果开启了数字签名验证)
 * 高德签名规则: 
 * 1. 将请求所有请求参数（除了sig）按参数名字典序排序
 * 2. 拼接成 k1=v1&k2=v2... 的格式
 * 3. 在最后拼接上secret，得到原始字符串
 * 4. 对原始字符串做MD5计算，结果就是sig
 */
function generateSig(params, secret) {
  // 按参数名字典序排序
  const sorted = Object.keys(params).sort();
  let str = '';
  for (const key of sorted) {
    if (str.length > 0) str += '&';
    // 高德文档不需要URL编码原始值进行签名计算
    str += `${key}=${params[key]}`;
  }
  // 拼接secret
  str += secret;
  // MD5计算
  const crypto = require('crypto');
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * 构建请求URL
 * - 如果有secret：带数字签名
 * - 如果没有secret：直接调用不带sig（不签名模式，不需要IP白名单）
 */
function buildUrl(endpoint, params) {
  let fullParams = { ...params, key: CONFIG.amap.key };
  let url = `https://restapi.amap.com${endpoint}?`;
  
  // 如果有secret，添加数字签名
  if (CONFIG.amap.secret && CONFIG.amap.secret.length > 0) {
    const sig = generateSig(fullParams, CONFIG.amap.secret);
    fullParams.sig = sig;
  }
  
  const query = Object.entries(fullParams)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  
  return url + query;
}

/**
 * 搜索POI
 * 高德POI搜索API: https://restapi.amap.com/v3/place/text
 */
async function searchPOI(keyword, page = 1, pageSize = 25) {
  const cacheKey = `search-${Buffer.from(`${keyword}-${page}`).toString('base64')}.json`;
  const cachePath = path.join(CONFIG.cacheDir, cacheKey);

  // 检查缓存
  if (fs.existsSync(cachePath)) {
    console.log(`[缓存] 搜索: ${keyword} 页 ${page}`);
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  }

  const params = {
    keywords: keyword,
    city: CONFIG.city,
    citylimit: true,
    page: page,
    page_size: pageSize,
    output: 'json'
  };
  
  const url = buildUrl('/v3/place/text', params);
  console.log(`[API搜索] ${keyword} 页 ${page}`);
  const result = await httpGet(url);
  
  // 缓存结果
  fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
  
  return result;
}

/**
 * 获取POI详情
 * 高德POI详情API: https://restapi.amap.com/v3/place/detail
 */
async function getPOIDetail(id) {
  const cacheKey = `detail-${id}.json`;
  const cachePath = path.join(CONFIG.cacheDir, cacheKey);

  if (fs.existsSync(cachePath)) {
    console.log(`[缓存] POI详情: ${id}`);
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  }

  const params = { id, extensions: 'all' };
  const url = buildUrl('/v3/place/detail', params);
  
  console.log(`[API详情] ${id} (extensions=all 获取photos)`);
  const result = await httpGet(url);
  
  fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
  return result;
}

/**
 * API错误解析
 */
function parseAPIError(result) {
  if (result.status !== '1' && result.infocode) {
    const code = result.infocode;
    const msg = result.info;
    switch (code) {
      case '10009':
        return `USERKEY_PLAT_NOMATCH - 密钥与平台不匹配，可能是IP绑定或域名绑定限制`;
      case '10001':
        return `INVALID_USER_KEY - 密钥不正确`;
      case '10004':
        return `QUOTA_PARALLEST_OVER - 并发超过配额`;
      case '10018':
        return `DAILY_QUERY_OVER_LIMIT - 日查询量超限`;
      default:
        return `${code} - ${msg}`;
    }
  }
  return null;
}

/**
 * 转换Amap POI到Pintro schema
 */
function convertPOIToPintro(poi, detail) {
  // 经纬度
  const [lng, lat] = poi.location.split(',').map(parseFloat);
  
  // 提取评分
  let sourceRating = 0;
  let reviewCount = 0;
  if (poi.photos && poi.photos.length > 0) {
    // 有些版本有biz_ext
    if (poi.biz_ext) {
      sourceRating = parseFloat(poi.biz_ext.rating) || 0;
      reviewCount = parseInt(poi.biz_ext.cost) || 0;
    }
  }
  
  // 价格范围
  let priceRange = '';
  if (poi.cost !== undefined && poi.cost !== '') {
    priceRange = `人均 ${poi.cost} 元`;
  }

  // 标签
  const tags = [];
  if (poi.type) {
    // 分类拆分标签
    poi.type.split(';').slice(0, 5).forEach(t => {
      const clean = t.trim();
      if (clean) tags.push(clean);
    });
  }

  // 营业时间
  let openingHoursText = '';
  if (detail && detail.pois && detail.pois[0]) {
    openingHoursText = detail.pois[0].open_time || '';
  }

  // 电话
  let tel = '';
  if (poi.tel) {
    tel = poi.tel;
  }

  return {
    name: poi.name,
    city: CONFIG.city,
    category: getCategoryFromType(poi.type),
    address: poi.address || '',
    location: { lat, lng },
    source_rating: sourceRating || 3.5,
    pintro_rating: 0, // will be filled by AI
    review_count: reviewCount || 0,
    price_range: priceRange,
    tags: tags.slice(0, 5),
    description: '', // will be filled by AI
    opening_hours: parseOpeningHours(openingHoursText),
    phone: tel,
    official_url: '',
    image_url: '',
    source_url: `https://www.amap.com/poi/${poi.id}`,
    amap_id: poi.id,
  };
}

/**
 * 从Amap type提取Pintro分类
 */
function getCategoryFromType(typeStr) {
  if (!typeStr) return '其他';
  const lower = typeStr.toLowerCase();
  if (lower.includes('咖啡') || lower.includes('咖啡馆')) return '咖啡馆';
  if (lower.includes('餐厅') || lower.includes('小吃') || lower.includes('美食')) return '餐厅';
  if (lower.includes('景点') || lower.includes('公园') || lower.includes('风景区')) return '景点';
  if (lower.includes('购物') || lower.includes('商店') || lower.includes('百货')) return '商店';
  if (lower.includes('酒店') || lower.includes('宾馆')) return '酒店';
  if (lower.includes('博物馆') || lower.includes('展览')) return '博物馆';
  return '其他';
}

/**
 * 解析营业时间
 */
function parseOpeningHours(openingText) {
  if (!openingText) {
    return { text: '', structured: [] };
  }
  const text = openingText.trim();
  const structured = [];
  
  const timeMatch = text.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
  if (timeMatch && !text.match(/周|一|二|三|四|五|六|日/)) {
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    for (const day of days) {
      let start = timeMatch[1];
      let end = timeMatch[2];
      if (start.length === 4) start = `0${start}`;
      if (end.length === 4) end = `0${end}`;
      structured.push({ day, start, end });
    }
  }

  return { text, structured };
}

/**
 * 去重
 */
function deduplicate(items) {
  const result = [];
  const map = new Map();

  for (const item of items) {
    const key = `${item.name}-${item.address}`.toLowerCase().replace(/\s+/g, ' ');
    let foundSimilar = false;
    for (const [existingKey] of map.entries()) {
      if (existingKey.includes(item.name.toLowerCase()) || 
          item.name.toLowerCase().includes(existingKey.toLowerCase())) {
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
 * 主函数
 */
async function main() {
  console.log('=== Pintro 数据抓取 Demo (高德Web API) 开始 ===');
  console.log(`目标城市: ${CONFIG.city} 松江区`);
  console.log(`API Key: ${CONFIG.amap.key}`);

  const allItems = [];
  let totalPages = 0;

  // 遍历关键词搜索
  for (const keyword of CONFIG.keywords) {
    console.log(`\n--- 搜索关键词: ${keyword} ---`);
    
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await searchPOI(keyword, page);
      
      // 检查API错误
      const error = parseAPIError(result);
      if (error) {
        console.error(`[API错误] ${error}`);
        throw new Error(`高德API调用失败: ${error}`);
      }

      if (!result.pois || result.pois.length === 0) {
        console.log(`[搜索完成] 关键词 ${keyword} 没有更多结果`);
        hasMore = false;
        break;
      }

      console.log(`[搜索结果] 页 ${page}: 返回 ${result.pois.length} 个POI`);
      totalPages++;

      // 获取每个POI详情
      for (const poi of result.pois) {
        try {
          const detail = await getPOIDetail(poi.id);
          const converted = convertPOIToPintro(poi, detail);
          allItems.push(converted);
          console.log(`  ✓ ${converted.name} (${converted.category})`);
        } catch (e) {
          console.error(`  ✗ 获取 ${poi.name} 详情失败: ${e.message}`);
        }
      }

      // 检查是否还有下一页
      if (result.pois.length < 25) {
        hasMore = false;
      } else {
        page++;
        // 限流延时，避免超过QPS
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // 去重
  const finalResult = deduplicate(allItems);

  // 输出文件
  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(finalResult, null, 2));
  
  console.log(`\n=== 全部完成 ===`);
  console.log(`搜索关键词: ${CONFIG.keywords.length} 个`);
  console.log(`搜索页数: ${totalPages}`);
  console.log(`获取POI总数: ${allItems.length}`);
  console.log(`去重后: ${finalResult.length}`);
  console.log(`输出文件: ${CONFIG.outputFile}`);
}

// 启动
main().catch(err => {
  console.error('错误:', err.message);
  process.exit(1);
});
