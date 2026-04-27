const express = require('express');
const bcrypt = require('bcryptjs');
const { querySql, getOneSql, runSql, insertSql } = require('../db');
const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: '請先登入' });
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: '需要管理員權限' });
  next();
}

router.get('/', requireAdmin, (req, res) => {
  res.json(querySql('SELECT id, username, name, role, created_at FROM users ORDER BY id'));
});

router.post('/', requireAdmin, (req, res) => {
  const { username, password, name, role } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: '帳號、密碼、姓名為必填' });
  if (!['admin','user','viewer'].includes(role)) return res.status(400).json({ error: '角色無效' });
  const existing = getOneSql('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) return res.status(409).json({ error: '帳號已存在' });
  const id = insertSql('INSERT INTO users (username, password, name, role) VALUES (?,?,?,?)', [username, bcrypt.hashSync(password, 10), name, role]);
  res.json({ id, username, name, role });
});

router.put('/:id', requireAdmin, (req, res) => {
  const { name, role, password } = req.body;
  const user = getOneSql('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: '用戶不存在' });
  if (password) {
    runSql('UPDATE users SET name=?, role=?, password=? WHERE id=?', [name||user.name, role||user.role, bcrypt.hashSync(password,10), req.params.id]);
  } else {
    runSql('UPDATE users SET name=?, role=? WHERE id=?', [name||user.name, role||user.role, req.params.id]);
  }
  res.json({ ok: true });
});

router.delete('/:id', requireAdmin, (req, res) => {
  if (parseInt(req.params.id) === req.session.user.id) return res.status(400).json({ error: '無法刪除自己' });
  runSql('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
