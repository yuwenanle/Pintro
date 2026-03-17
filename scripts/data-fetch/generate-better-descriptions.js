
/**
 * 生成更吸引人的独特推荐描述
 * - 结合位置特色
 * - 更有画面感
 * - 突出品类特点
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, 'pintro-demo-data-api-final.json');
const OUTPUT = path.join(__dirname, 'pintro-demo-data-api-final.json');

// 读取数据
const data = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));

/**
 * 生成更好的推荐描述
 */
function generateDescription(item) {
  const { name, category, address, amap_id } = item;
  
  // ========== 一尺花园 特殊处理 ==========
  if (name.includes('一尺花园')) {
    // 提取位置分店名
    const match = name.match(/\((.*?)\)/);
    const location = match ? match[1] : '庭院店';
    
    // 检测区域特色
    if (location.includes('广富林')) {
      return `一尺花园(${location})，藏在广富林景区旁，庭院草坪绿树环绕，逛累了来坐坐发呆太舒服了。`;
    }
    if (location.includes('浦江')) {
      return `一尺花园(${location})，滨江绿地开阔，吹着江风喝咖啡太惬意。`;
    }
    if (location.includes('滨江')) {
      return `一尺花园(${location})，一线江景庭院咖啡馆，散步过来歇脚好去处。`;
    }
    if (location.includes('世纪公园')) {
      return `一尺花园(${location})，公园里环境绿意盎然，野餐逛街后歇歇脚。`;
    }
    if (location.includes('古镇')) {
      return `一尺花园(${location})，古镇里闹中取静，逛累了坐坐很舒服。`;
    }
    // 默认一尺花园
    return `一尺花园(${location})，庭院清幽绿树成荫，周末和朋友聚聚发呆太棒了。`;
  }

  // ========== 知名连锁品牌 ==========
  if (name.includes('瑞幸') || name.includes('luckin')) {
    return `${name}，性价比超高，日常咖啡续命很方便。`;
  }
  if (name.includes('星巴克')) {
    return `${name}，环境安静空间舒服，适合约朋友聊天办公。`;
  }
  if (name.includes('Manner') || name.includes('M Stand')) {
    return `${name}，性价比精品咖啡，价格亲民口味稳定，日常通勤来一杯。`;
  }
  if (name.includes('Peet') || name.includes('皮爷')) {
    return `${name}，深度烘焙咖啡豆香浓郁，咖啡老饕推荐。`;
  }
  if (name.includes('Tims')) {
    return `${name}，贝果配咖啡早餐绝配，工作日早晨活力开启。`;
  }
  if (name.includes('库迪')) {
    return `${name}，性价比炸裂，便宜好喝日常咖啡首选。`;
  }
  if (name.includes('Cubric') || name.includes('三立方')) {
    return `${name}，dirty好喝性价比高，办公路上带一杯方便。`;
  }

  // ========== 按分类默认特色 ==========
  switch (category) {
    case '咖啡馆':
      return `${name}，环境干净舒服，适合约朋友聊聊天拍拍照片。`;
    case '餐厅':
      return `${name}，本地口味地道食材新鲜，朋友家人聚餐很不错。`;
    case '景点':
      return `${name}，风景优美空气好，散步拍照散心赏景好去处。`;
    case '商店':
      return `${name}，东西品种多品质不错，想买来逛逛很合适。`;
    default:
      return `${name}，位置好找值得顺路打卡体验一下。`;
  }
}

// 逐个重新生成
const result = data.map(item => {
  return {
    ...item,
    description: generateDescription(item),
  };
});

// 统计
console.log(`处理完成: ${result.length} 条`);
const cats = {};
result.forEach(i => cats[i.category] = (cats[i.category] || 0) + 1);
console.log('\n按分类统计:');
Object.entries(cats).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log('  ' + k + ': ' + v));

// 保存
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
console.log(`\n输出完成: ${OUTPUT}`);
