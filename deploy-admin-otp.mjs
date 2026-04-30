// Redeploy admin-otp with DB-backed allowlist
import fs from 'fs';
import https from 'https';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = 'ameneqrrfdhntfzvchnn';

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.supabase.com',
      path, method, timeout: 30000,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data, 'utf8') } : {}),
      },
    }, (res) => {
      let buf = '';
      res.on('data', (d) => buf += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    if (data) req.write(data, 'utf8');
    req.end();
  });
}

const code = fs.readFileSync('supabase/functions/admin-otp/index.bundled.ts', 'utf8');

console.log('Updating admin-otp with DB-backed allowlist...');
const r = await api('PATCH', `/v1/projects/${REF}/functions/admin-otp`, {
  body: code, verify_jwt: false, name: 'admin-otp',
});
console.log(`  ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
