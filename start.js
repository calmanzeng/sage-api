const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({ status: 'ok', message: 'Sage API Server' }));
});
const PORT = process.env.PORT || 3456;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
