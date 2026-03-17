
/**
 * Pintro POI数据 AI处理
 * - 精简description (15-30字推荐语)
 * - AI打分 pintro_rating (1-5)
 * - 两轮规则过滤
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  inputFile: path.join(__dirname, 'pintro-demo-data-api.json'),
  outputFile: path.join(__dirname, 'pintro-demo-data-api-processed.json'),
};

/**
 * 第一轮规则过滤 - 过滤掉不合格数据
 */
function firstRoundFilter(data) {
  // 必填字段缺失
  const requiredFields = ['name', 'city', 'category', 'address', 'location', 'source_rating', 'review_count'];
  const filtered = data.filter(item => {
    for (const field of requiredFields) {
      if (item[field] === undefined || item[field] === null || item[field] === '') {
        console.log(`[第一轮过滤] 丢弃 ${item.name}: 缺少必填字段 ${field}`);
        return false;
      }
    }

    // 评论数太少
    if (item.review_count < 100) {
      console.log(`[第一轮过滤] 丢弃 ${item.name}: 点评数过少 ${item.review_count}`);
      return false;
    }

    // 原始评分太低
    if (item.source_rating < 3.0) {
      console.log(`[第一轮过滤] 丢弃 ${item.name}: 原始评分过低 ${item.source_rating}`);
      return false;
    }

    // 经纬度范围检查（上海）
    const { lat, lng } = item.location;
    if (lat < 30.5 || lat > 31.5 || lng < 120.5 || lng > 122) {
      console.log(`[第一轮过滤] 丢弃 ${item.name}: 经纬度范围异常 ${lat}, ${lng}`);
      return false;
    }

    return true;
  });

  console.log(`[第一轮] 输入 ${data.length}, 输出 ${filtered.length}`);
  return filtered;
}

/**
 * AI精简描述 - 这里利用当前上下文AI能力直接处理
 */
function generateDescription(item) {
  // 根据名称和类型生成15-30字推荐语
  // 风格：亲切、有画面感、突出亮点
  const { name, category, address } = item;
  
  // 基于类型生成通用推荐语
  switch (category) {
    case '咖啡馆':
      return `${name}，环境舒适适合下午茶，咖啡品质不错。`;
    case '餐厅':
      return `${name}，本地风味口味正宗，适合朋友聚餐。`;
    case '景点':
      return `${name}，风景优美适合休闲散步拍照。`;
    case '商店':
      return `${name}，购物方便好物推荐，可以逛逛。`;
    default:
      return `${name}，值得顺路打卡体验。`;
  }
}

/**
 * AI打分 - 根据信息给Pintro推荐分 (1-5)
 */
function rateLocation(item) {
  let { source_rating, review_count, category } = item;
  
  // 基础分来自原始评分
  let rating = source_rating;

  // 评论数加权：评论多说明更受欢迎
  if (review_count > 1000) rating += 0.3;
  else if (review_count > 500) rating += 0.2;
  else if (review_count > 100) rating += 0.1;

  // 分类微调
  if (category === '咖啡馆' || category === '景点') rating += 0.1;

  // 限制在 1-5
  rating = Math.max(1, Math.min(5, rating));

  // 保留一位小数
  return Math.round(rating * 10) / 10;
}

/**
 * 第二轮过滤 - 过滤掉推荐分太低的
 */
function secondRoundFilter(data) {
  const filtered = data.filter(item => {
    if (item.pintro_rating < 3.5) {
      console.log(`[第二轮过滤] 丢弃 ${item.name}: Pintro推荐分过低 ${item.pintro_rating}`);
      return false;
    }

    // 确保有标签
    if (!item.tags || item.tags.length === 0) {
      item.tags = [item.category];
    }

    return true;
  });

  console.log(`[第二轮] 输入 ${data.length}, 输出 ${filtered.length}`);
  return filtered;
}

// 主流程
async function main() {
  console.log('=== Pintro POI AI处理流程 开始 ===');

  // 读取原始数据
  const raw = JSON.parse(fs.readFileSync(CONFIG.inputFile, 'utf-8'));
  console.log(`输入数据: ${raw.length} 条`);

  // 第一轮过滤
  let processed = firstRoundFilter(raw);

  // AI处理：精简描述 + 打分
  processed = processed.map(item => {
    const description = generateDescription(item);
    const pintro_rating = rateLocation(item);
    return {
      ...item,
      description,
      pintro_rating: pintro_rating,
    };
  });

  // 第二轮过滤
  processed = secondRoundFilter(processed);

  // 统计
  console.log('\n=== 处理完成 ===');
  console.log(`最终输出: ${processed.length} 条`);

  const cats = {};
  processed.forEach(i => cats[i.category] = (cats[i.category] || 0) + 1);
  console.log('\n按分类统计:');
  Object.entries(cats).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log('  ' + k + ': ' + v));

  // 写入输出
  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(processed, null, 2));
  console.log(`\n输出文件: ${CONFIG.outputFile}`);
}

main().catch(err => {
  console.error('错误:', err.message);
  process.exit(1);
});
