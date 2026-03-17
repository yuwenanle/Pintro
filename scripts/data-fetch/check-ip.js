
const http = require('http');

http.get('http://icanhazip.com', (res) => {
  let ip = '';
  res.on('data', (chunk) => {
    ip += chunk;
  });
  res.on('end', () => {
    console.log('当前服务器实际出口IP:', ip.trim());
  });
}).on('error', (err) => {
  console.error('错误:', err);
});
