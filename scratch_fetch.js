const https = require('https');

https.get('https://krishi-mitra-33ss.vercel.app/', (res) => {
  let html = '';
  res.on('data', d => html += d);
  res.on('end', () => {
    const match = html.match(/src="(\/assets\/index-.*?\.js)"/);
    if (match) {
      https.get('https://krishi-mitra-33ss.vercel.app' + match[1], (jsRes) => {
        let js = '';
        jsRes.on('data', d => js += d);
        jsRes.on('end', () => {
          const loginIdx = js.indexOf('/api/send-otp');
          if (loginIdx > -1) {
            console.log('Code around fetch:', js.substring(loginIdx - 50, loginIdx + 50));
          } else {
            console.log('Could not find /api/send-otp in JS!');
          }
        });
      });
    }
  });
});
