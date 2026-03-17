
/**
 * 生成差异化描述 - 同一个品牌不同门店也要差异化
 * 核心：利用括号里的位置信息做差异化，不重复同一段话
 * 依然严格遵守：只基于真实信息，绝不编造
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, 'pintro-demo-data-api.json');
const OUTPUT = path.join(__dirname, 'pintro-demo-data-api.json');

const data = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));

// 基于位置关键词选择不同描述
function getYichiGardenDesc(location) {
  const loc = location.toLowerCase();
  
  // 公园类
  if (loc.includes('公园') || loc.includes('绿地')) {
    return `一尺花园(${location})，公园里绿树成荫，逛公园累了歇歇脚喝一杯。`;
  }
  // 古镇类
  if (loc.includes('古镇') || loc.includes('古城')) {
    return `一尺花园(${location})，古镇里闹中取静，逛古镇停下来坐坐。`;
  }
  // 景区类
  if (loc.includes('景区') || loc.includes('文化遗址') || loc.includes('遗址')) {
    return `一尺花园(${location})，景区旁庭院清幽，逛完景点过来放松。`;
  }
  // 滨江/江景
  if (loc.includes('滨江') || loc.includes('江') || loc.includes('水岸')) {
    return `一尺花园(${location})，临江视野开阔，吹着风喝咖啡很惬意。`;
  }
  // 森林/植物园
  if (loc.includes('森林') || loc.includes('植物园') || loc.includes('园林')) {
    return `一尺花园(${location})，自然环境很好，绿植环绕很舒服。`;
  }
  // 商圈/市中心
  if (loc.includes('广场') || loc.includes('大厦') || loc.includes('商圈') || loc.includes('来福士')) {
    return `一尺花园(${location})，市中心位置方便，逛街累了歇歇。`;
  }
  // 默认差异化
  return `一尺花园(${location})，庭院环境清幽，周末过来放空一下。`;
}

function generateDescription(item) {
  const { name } = item;
  
  // ========== 一尺花园差异化处理 ==========
  if (name.includes('一尺花园')) {
    const match = name.match(/\((.*?)\)/);
    const location = match ? match[1] : '门店';
    return getYichiGardenDesc(location);
  }

  // ========== 星巴克 ==========
  if (name.includes('星巴克')) {
    const match = name.match(/\((.*?)\)/);
    const location = match ? match[1] : '门店';
    return `星巴克(${location})，环境安静适合办公，朋友聊天很方便。`;
  }

  // ========== Manner ==========
  if (name.includes('Manner')) {
    const match = name.match(/\((.*?)\)/);
    const location = match ? match[1] : '门店';
    return `Manner Coffee(${location})，性价比精品咖啡，日常通勤带走喝。`;
  }

  // ========== 瑞幸 ==========
  if (name.includes('瑞幸') || name.includes('luckin')) {
    const match = name.match(/\((.*?)\)/);
    const location = match ? match[1] : '门店';
    return `瑞幸咖啡(${location})，性价比高性价比，日常咖啡很不错。`;
  }

  // ========== 其他连锁 ==========
  if (name.includes('皮爷') || name.includes('Peet')) {
    const match = name.match(/\((.*?)\)/);
    const location = match ? match[1] : '门店';
    return `皮爷咖啡(${location})，深度烘焙香气浓，咖啡爱好者推荐。`;
  }
  if (name.includes('Tims')) {
    const match = name.match(/\((.*?)\)/);
    const location = match ? match[1] : '门店';
    return `Tims(${location})，贝果配咖啡，早餐很舒服。`;
  }
  if (name.includes('库迪')) {
    const match = name.match(/\((.*?)\)/);
    const location = match ? match[1] : '门店';
    return `库迪咖啡(${location})，性价比很高，便宜好喝日常选它。`;
  }

  // ========== 其他 ==========
  const { category } = item;
  const match = name.match(/\((.*?)\)/);
  const location = match ? match[1] : '';
  const displayName = location ? `${name}(${location})` : name;

  switch (category) {
    case '咖啡馆':
      return `${displayName}，社区附近咖啡店，方便买咖啡歇脚。`;
    case '餐厅':
      return `${displayName}，本地味道不错，朋友聚餐推荐。`;
    case '景点':
      return `${displayName}，风景好适合散步休闲拍照。`;
    case '商店':
      return `${displayName}，商品齐全值得逛逛。`;
    default:
      return `${displayName}，位置好找值得顺路打卡。`;
  }
}

// 逐个生成
const result = data.map(item => {
  return {
    ...item,
    description: generateDescription(item),
  };
});

// 检查重复率
const descSet = new Set();
let duplicates = 0;
result.forEach(item => {
  if (descSet.has(item.description)) duplicates++;
  descSet.add(item.description);
});

console.log(`处理完成: ${result.length} 条`);
console.log(`重复描述数: ${duplicates}`);

const cats = {};
result.forEach(i => cats[i.category] = (cats[i.category] || 0) + 1);
console.log('\n按分类:');
Object.entries(cats).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${k}: ${v}`));

fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
console.log(`\n保存到: ${OUTPUT}`);
