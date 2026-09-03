import http from 'http';
http.get('http://localhost:5000/api/health', (res) => {
  console.log('Health status:', res.statusCode);
});
