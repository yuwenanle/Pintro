
const fs = require('fs');
const path = require('path');

// 从缓存中合并所有POI
const cacheDir = path.join(__dirname, 'cache');
const result = [];

// 读取所有detail缓存
const files = fs.readdirSync(cacheDir);
console.log('Found', files.length, 'cache files');

files.forEach(file => {
  if (!file.startsWith('detail-')) return;
  try {
    const content = fs.readFileSync(path.join(cacheDir, file), 'utf-8');
    const data = JSON.parse(content);
    if (data.status === '1' && data.pois && data.pois[0]) {
      // 这个已经在搜索的时候处理过了，我们需要从搜索缓存重新构建完整列表
    }
  } catch (e) {
    // ignore
  }
});

// 读取所有搜索缓存
let allPois = [];
files.forEach(file => {
  if (!file.startsWith('search-')) return;
  try {
    const content = fs.readFileSync(path.join(cacheDir, file), 'utf-8');
    const data = JSON.parse(content);
    if (data.status === '1' && data.pois) {
      allPois = allPois.concat(data.pois);
    }
  } catch (e) {
    console.error('Error parsing', file, e.message);
  }
});

console.log('Total pois from search cache:', allPois.length);

// 转换函数
function getCategoryFromType(typeStr) {
  if (!typeStr) return '其他';
  const lower = typeStr.toLowerCase();
  if (lower.includes('咖啡') || lower.includes('咖啡馆')) return '咖啡馆';
  if (lower.includes('餐厅') || lower.includes('小吃') || lower.includes('美食')) return '餐厅';
  if (lower.includes('景点') || lower.includes('公园') || lower.includes('风景区')) return '景点';
  if (lower.includes('购物') || lower.includes('商店')) return '商店';
  if (lower.includes('酒店') || lower.includes('宾馆')) return '酒店';
  if (lower.includes('博物馆') || lower.includes('展览')) return '博物馆';
  return '其他';
}

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

// 去重
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

// 转换
const finalResult = allPois.map(poi => {
  const [lng, lat] = poi.location.split(',').map(parseFloat);
  
  let sourceRating = 0;
  let reviewCount = 0;
  if (poi.biz_ext) {
    sourceRating = parseFloat(poi.biz_ext.rating) || 0;
    reviewCount = parseInt(poi.biz_ext.cost) || 0;
  }
  
  let priceRange = '';
  if (poi.cost !== undefined && poi.cost !== '') {
    priceRange = `人均 ${poi.cost} 元`;
  }

  const tags = [];
  if (poi.type) {
    poi.type.split(';').slice(0, 5).forEach(t => {
      const clean = t.trim();
      if (clean) tags.push(clean);
    });
  }

  return {
    name: poi.name,
    city: '上海',
    category: getCategoryFromType(poi.type),
    address: poi.address || '',
    location: { lat, lng },
    source_rating: sourceRating || 3.5,
    pintro_rating: 0,
    review_count: reviewCount || 0,
    price_range: priceRange,
    tags: tags.filter(t => t && t.length > 0).slice(0, 5),
    description: '',
    opening_hours: parseOpeningHours(''),
    phone: poi.tel || '',
    official_url: '',
    image_url: '',
    source_url: `https://www.amap.com/poi/${poi.id}`,
    amap_id: poi.id,
  };
});

const final = deduplicate(finalResult);

console.log('\n=== Final Result ===');
console.log('Total after dedup:', final.length);
const cats = {};
final.forEach(i => cats[i.category] = (cats[i.category] || 0) + 1);
console.log('\nBy category:');
Object.entries(cats).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log('  ' + k + ': ' + v));

fs.writeFileSync(path.join(__dirname, 'pintro-demo-data-api.json'), JSON.stringify(final, null, 2));
console.log('\nWrote to pintro-demo-data-api.json');
