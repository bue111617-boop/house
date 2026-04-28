const express = require('express');
const bcrypt = require('bcryptjs');
const { getOneSql } = require('../db');
const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '請輸入帳號和密碼' });
  const user = getOneSql('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }
  req.session.user = { id: user.id, username: user.username, name: user.name, role: user.role };
  res.json({ ok: true, user: req.session.user });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '未登入' });
  res.json(req.session.user);
});

// 使用者修改自己的密碼
router.post('/change-password', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '請先登入' });
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: '請填寫舊密碼與新密碼' });
  if (newPassword.length < 4) return res.status(400).json({ error: '新密碼至少需要 4 個字元' });
  const { getOneSql, runSql } = require('../db');
  const user = getOneSql('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
  if (!user || !bcrypt.compareSync(oldPassword, user.password)) {
    return res.status(401).json({ error: '舊密碼不正確' });
  }
  runSql('UPDATE users SET password = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), user.id]);
  res.json({ ok: true });
});

module.exports = router;
