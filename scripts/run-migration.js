/**
 * Run the SQL migration against your Supabase project.
 *
 * Usage:
 *   1. Go to your Supabase dashboard → Project Settings → Database
 *   2. Reset the database password if you don't have it
 *   3. Copy the connection string from the "Connection pooling" section (Session mode)
 *   4. Run: node scripts/run-migration.js "postgresql://postgres.[ref]:[password]@[host]:5432/postgres"
 *
 * OR simply copy the contents of supabase/migrations/001_initial_schema.sql
 * and paste it into the Supabase SQL Editor and click "Run".
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const connectionString = process.argv[2];

  if (!connectionString) {
    console.log('\\n📋 No connection string provided.\\n');
    console.log('Option 1: Run with connection string:');
    console.log('  node scripts/run-migration.js "postgresql://postgres.[ref]:[password]@[host]:5432/postgres"\\n');
    console.log('Option 2: Copy-paste the SQL:');
    console.log('  1. Open your Supabase dashboard → SQL Editor');
    console.log('  2. Copy the contents of supabase/migrations/001_initial_schema.sql');
    console.log('  3. Paste and click "Run"\\n');
    process.exit(1);
  }

  const sqlFile = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  console.log('🔌 Connecting to database...');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('✅ Connected!');
    console.log('🚀 Running migration...');
    await client.query(sql);
    console.log('✅ Migration completed successfully!');
    console.log('\\n🎤 Your EuroParty database is ready!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
