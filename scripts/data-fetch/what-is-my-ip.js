
const http = require('http');

function getMyIP() {
  return new Promise((resolve, reject) => {
    http.get('http://icanhazip.com', (res) => {
      let ip = '';
      res.on('data', chunk => ip += chunk);
      res.on('end', () => resolve(ip.trim()));
    }).on('error', reject);
  });
}

getMyIP().then(ip => {
  console.log('当前服务器发起请求实际出口IP:', ip);
}).catch(err => {
  console.error('获取IP失败:', err.message);
});
