const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
let db;
let saveTimer;

function persistDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }, 200);
}

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_name TEXT DEFAULT '',
      address TEXT NOT NULL,
      company TEXT NOT NULL,
      website TEXT DEFAULT '',
      price REAL DEFAULT 0,
      reserve_price REAL DEFAULT 0,
      dev_name TEXT DEFAULT '',
      dev_phone TEXT DEFAULT '',
      match_time TEXT DEFAULT '',
      deadline TEXT DEFAULT '',
      note TEXT DEFAULT '',
      screenshot TEXT DEFAULT '',
      operator TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // 若舊表缺少新欄位，補上
  const cols = db.exec("PRAGMA table_info(cases)")[0];
  if (cols) {
    const names = cols.values.map(r => r[1]);
    if (!names.includes('case_name')) db.run("ALTER TABLE cases ADD COLUMN case_name TEXT DEFAULT ''");
    if (!names.includes('screenshot')) db.run("ALTER TABLE cases ADD COLUMN screenshot TEXT DEFAULT ''");
    if (!names.includes('reserve_price')) db.run("ALTER TABLE cases ADD COLUMN reserve_price REAL DEFAULT 0");
  }

  const existingAdmin = db.exec("SELECT id FROM users WHERE username = 'admin'");
  if (!existingAdmin.length || !existingAdmin[0].values.length) {
    const ins = (u,p,n,r) => db.run('INSERT INTO users (username,password,name,role) VALUES (?,?,?,?)', [u,bcrypt.hashSync(p,10),n,r]);
    ins('admin','admin123','管理員','admin');
    ins('user1','user123','王小明','user');
    ins('viewer','view123','陳查看','viewer');

    const ic = (cn,a,co,w,pr,dn,dp,mt,dl,no,op) => db.run(
      'INSERT INTO cases (case_name,address,company,website,price,dev_name,dev_phone,match_time,deadline,note,operator) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [cn,a,co,w,pr,dn,dp,mt,dl,no,op]
    );
    ic('信義豪宅','台北市信義區忠孝東路五段100號','信義不動產','https://sinyi.com.tw',1200,'李建宏','0912-345-678','2025-04-20','2026-06-30','屋主急售，議價空間大','admin');
    ic('板橋文化路','新北市板橋區文化路二段88號3樓','永慶房屋','https://yungching.com.tw',850,'張美玲','02-2951-8899','2025-05-01','2026-05-10','','user1');
    ic('中壢中山路','桃園市中壢區中山路456號','住商不動產','',680,'吳志偉','0933-222-111','2025-03-10','2025-12-31','近捷運站','admin');
    ic('台中西屯大樓','台中市西屯區台灣大道三段200號','21世紀不動產','https://century21.com.tw',1500,'林淑芬','04-2359-6677','2026-06-15','2026-12-31','全新大樓','user1');
    ic('高雄前鎮','高雄市前鎮區中山二路300號','海悅廣告','https://hoyih.com.tw',920,'陳俊男','07-335-4488','2026-05-20','2026-05-20','','admin');
    persistDb();
  }
  return db;
}

function getDb() { return db; }

function runSql(sql, params=[]) { db.run(sql, params); persistDb(); }

function querySql(sql, params=[]) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function getOneSql(sql, params=[]) { return querySql(sql, params)[0] || null; }

function insertSql(sql, params=[]) {
  db.run(sql, params);
  const res = db.exec('SELECT last_insert_rowid() as id');
  persistDb();
  return res[0]?.values[0][0];
}

module.exports = { initDb, runSql, querySql, getOneSql, insertSql };
