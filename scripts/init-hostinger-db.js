const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

async function main() {
  const host = env('DB_HOST');
  const port = Number(env('DB_PORT', '3306'));
  const database = env('DB_NAME');
  const user = env('DB_USER');
  const password = env('DB_PASSWORD');

  if (!host || !database || !user || !password) {
    console.error('Defina DB_HOST, DB_PORT, DB_NAME, DB_USER e DB_PASSWORD.');
    process.exit(1);
  }

  const connection = await mysql.createConnection({ host, port, user, password, database, multipleStatements: true });
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'hostinger-schema.sql'), 'utf8');

  await connection.query(sql);
  await connection.end();

  console.log('Banco Hostinger inicializado com sucesso.');
}

main().catch((error) => {
  console.error('Falha ao inicializar banco Hostinger:', error.message);
  process.exit(1);
});
