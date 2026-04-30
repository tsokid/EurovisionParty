// deploy-functions.mjs — deploys edge functions via Supabase management API
import fs from 'fs';
import https from 'https';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = 'ameneqrrfdhntfzvchnn';

async function apiCall(method, path, body, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await _apiCall(method, path, body);
      return result;
    } catch (e) {
      if (attempt === retries) throw e;
      const delay = attempt * 3000;
      console.log(`    Retry ${attempt}/${retries-1} in ${delay/1000}s (${e.code || e.message})...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

function _apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.supabase.com',
      path,
      method,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data, 'utf8') } : {}),
      },
    };
    const req = https.request(options, (res) => {
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

async function deployFunction(slug, code) {
  const check = await apiCall('GET', `/v1/projects/${REF}/functions/${slug}`);
  let result;
  if (check.status === 200) {
    console.log(`  Updating ${slug}...`);
    result = await apiCall('PATCH', `/v1/projects/${REF}/functions/${slug}`, {
      body: code, verify_jwt: false, name: slug,
    });
  } else {
    console.log(`  Creating ${slug}...`);
    result = await apiCall('POST', `/v1/projects/${REF}/functions`, {
      slug, name: slug, body: code, verify_jwt: false,
    });
  }
  const ok = result.status >= 200 && result.status < 300;
  console.log(`  ${ok ? '✅' : '❌'} ${slug} (${result.status})${ok ? '' : ': ' + JSON.stringify(result.body).slice(0,200)}`);
  return ok;
}

async function runSQL(sql) {
  return apiCall('POST', `/v1/projects/${REF}/database/query`, { query: sql });
}

// Read bundled files
const sendEmailCode = fs.readFileSync('supabase/functions/send-email/index.bundled.ts', 'utf8');
const parseCode = fs.readFileSync('supabase/functions/eurovision-parse/index.bundled.ts', 'utf8');

console.log('🚀 Eurovision Games deployment\n');

// 1. Service role key
console.log('1. Fetching service role key...');
const keysResp = await apiCall('GET', `/v1/projects/${REF}/api-keys`);
const serviceKey = Array.isArray(keysResp.body)
  ? keysResp.body.find(k => k.name === 'service_role')?.api_key : null;
console.log(serviceKey ? `  ✅ Got key (${serviceKey.length} chars)` : '  ❌ Failed');

// 2. Deploy functions
console.log('\n2. Edge functions...');
await deployFunction('send-email', sendEmailCode);
await deployFunction('eurovision-parse', parseCode);

// 3. EMAIL_FROM secret
console.log('\n3. Setting EMAIL_FROM secret...');
const secretsResp = await apiCall('POST', `/v1/projects/${REF}/secrets`, [
  { name: 'EMAIL_FROM', value: 'Eurovision Games <noreply@eurovision.games>' },
]);
console.log(secretsResp.status < 300 ? '  ✅ Done' : `  ❌ ${secretsResp.status}`);

// 4. Auth config
console.log('\n4. Auth config (site URL + redirects)...');
const authResp = await apiCall('PATCH', `/v1/projects/${REF}/config/auth`, {
  site_url: 'https://eurovision.games',
  additional_redirect_urls: ['https://eurovision.games', 'https://eurovision.games/admin'],
  mailer_otp_exp: 600,
  mailer_otp_length: 6,
});
console.log(authResp.status < 300 ? '  ✅ Done' : `  ❌ ${authResp.status}: ${JSON.stringify(authResp.body).slice(0,200)}`);

// 5. DB GUCs
if (serviceKey) {
  console.log('\n5. Database GUCs...');
  const guc = await runSQL(
    `ALTER DATABASE postgres SET "app.settings.functions_url" = 'https://ameneqrrfdhntfzvchnn.supabase.co/functions/v1'; ` +
    `ALTER DATABASE postgres SET "app.settings.service_role_key" = '${serviceKey}'; ` +
    `SELECT pg_reload_conf();`
  );
  console.log(guc.status < 300 ? '  ✅ Done' : `  ❌ ${guc.status}: ${JSON.stringify(guc.body).slice(0,200)}`);
}

// 6. Migrations
console.log('\n6. Migrations...');
const migrFiles = [
  'supabase/migrations/018_super_admins.sql',
  'supabase/migrations/019_winners.sql',
  'supabase/migrations/019b_sudden_death_rpc.sql',
  'supabase/migrations/020_eurovision_parser.sql',
  'supabase/migrations/021_security_hardening.sql',
  'supabase/migrations/022_email_log.sql',
];
for (const f of migrFiles) {
  if (!fs.existsSync(f)) { console.log(`  ⚠️  ${f} not found`); continue; }
  const r = await runSQL(fs.readFileSync(f, 'utf8'));
  const ok = r.status < 300;
  console.log(`  ${ok ? '✅' : '❌'} ${f.split('/').pop()}${ok ? '' : ': ' + JSON.stringify(r.body).slice(0,250)}`);
}

console.log('\n─────────────────────────────────────────');
console.log('✨ Done! TWO manual steps remain:');
console.log('  1. Dashboard → Edge Functions → Secrets');
console.log('     Add: RESEND_API_KEY = re_XXXXX (your Resend key)');
console.log('  2. Dashboard → Auth → Email Templates → Magic Link');
console.log('     Subject: "Your Eurovision Games admin code"');
console.log('     Body: paste supabase/templates/magic-link.html');
console.log('\n⚠️  REVOKE token now: https://supabase.com/dashboard/account/tokens');
