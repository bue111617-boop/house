const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || 'case-mgmt-secret-2025';

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 8 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',  require('./routes/auth'));
app.use('/api/cases', require('./routes/cases'));
app.use('/api/users', require('./routes/users'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`案件管理系統啟動中: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('資料庫初始化失敗:', err);
  process.exit(1);
});
