
/**
 * 生成独特描述 - 基于位置和名称特点生成独特推荐语
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, 'pintro-demo-data-api-processed.json');
const OUTPUT = path.join(__dirname, 'pintro-demo-data-api-final.json');

// 读取数据
const data = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));

// 根据店铺特色生成独特推荐语
function generateUniqueDescription(item) {
  const { name, category, address } = item;
  
  // 一尺花园特殊处理
  if (name.includes('一尺花园')) {
    const location = extractLocation(name, address);
    return `一尺花园(${location})，庭院环境清幽，适合周末发呆朋友小聚。`;
  }

  // 咖啡连锁品牌
  if (name.includes('瑞幸')) return `${name}，性价比高方便快捷，随手买一杯很方便。`;
  if (name.includes('星巴克')) return `${name}，环境安静适合聊天办公，咖啡稳定出品。`;
  if (name.includes('Manner')) return `${name}，性价比精品咖啡，性价比高日常刚需。`;
  if (name.includes('Peet')) return `${name}，深度烘焙香味浓郁，咖啡爱好者推荐。`;
  if (name.includes('皮爷')) return `${name}，咖啡豆香浓郁，适合久坐办公聊天。`;
  if (name.includes('Tims')) return `${name}，贝果咖啡不错，早餐好去处。`;
  if (name.includes('库迪')) return `${name}，性价比高，日常咖啡便宜好喝。`;

  // 分类默认
  switch (category) {
    case '咖啡馆':
      return `${name}，咖啡味道不错，适合下午茶歇放松。`;
    case '餐厅':
      return `${name}，本地口味地道，朋友聚餐好去处。`;
    case '景点':
      return `${name}，风景优美适合散步休闲，拍照打卡出片。`;
    case '商店':
      return `${name}，商品丰富值得逛逛，买到心仪好物。`;
    default:
      return `${name}，值得顺路打卡体验一下。`;
  }
}

function extractLocation(name, address) {
  // 从店名或地址提取位置信息
  const match = name.match(/\((.*?)\)/);
  if (match && match[1]) {
    return match[1];
  }
  // 从地址取最后一段
  const parts = address.split('');
  return name.split('(')[0] || '门店';
}

// 逐个重新生成
const result = data.map(item => {
  return {
    ...item,
    description: generateUniqueDescription(item),
  };
});

// 统计
console.log(`处理完成: ${result.length} 条`);
const byCategory = {};
result.forEach(i => byCategory[i.category] = (byCategory[i.category] || 0) + 1);
console.log('\n按分类:');
Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${k}: ${v}`));

// 保存
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
console.log(`\n输出到: ${OUTPUT}`);
