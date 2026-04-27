const express = require('express');
const { querySql, getOneSql, runSql, insertSql } = require('../db');
const router = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: '請先登入' });
  next();
}
function requireEditor(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: '請先登入' });
  if (req.session.user.role === 'viewer') return res.status(403).json({ error: '權限不足' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: '請先登入' });
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: '需要管理員權限' });
  next();
}

router.get('/', requireLogin, (req, res) => {
  const { q, status, operator, sort } = req.query;
  let sql = 'SELECT * FROM cases WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (address LIKE ? OR company LIKE ? OR dev_name LIKE ? OR dev_phone LIKE ? OR note LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (operator) { sql += ' AND operator = ?'; params.push(operator); }
  const orderMap = {
    price: 'price DESC', deadline: 'CASE WHEN deadline IS NULL OR deadline = "" THEN 1 ELSE 0 END, deadline ASC',
    company: 'company ASC', createdAt: 'id DESC',
  };
  sql += ` ORDER BY ${orderMap[sort] || 'id DESC'}`;
  let rows = querySql(sql, params);
  if (status) {
    const now = new Date(); now.setHours(0,0,0,0);
    rows = rows.filter(r => {
      if (!r.deadline) return status === 'active';
      const diff = (new Date(r.deadline) - now) / 86400000;
      if (status === 'expired') return diff < 0;
      if (status === 'soon') return diff >= 0 && diff <= 30;
      if (status === 'active') return diff > 30;
      return true;
    });
  }
  if (req.session.user.role !== 'admin') rows = rows.map(r => ({ ...r, login_pass: '••••••' }));
  res.json(rows);
});

router.get('/:id', requireLogin, (req, res) => {
  const row = getOneSql('SELECT * FROM cases WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: '案件不存在' });
  if (req.session.user.role !== 'admin') row.login_pass = '••••••';
  res.json(row);
});

router.post('/', requireEditor, (req, res) => {
  const { address, company, website, login_user, login_pass, price, dev_name, dev_phone, match_time, deadline, note } = req.body;
  if (!address || !company) return res.status(400).json({ error: '地址和委託公司為必填' });
  const id = insertSql(
    'INSERT INTO cases (address,company,website,login_user,login_pass,price,dev_name,dev_phone,match_time,deadline,note,operator) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [address, company, website||'', login_user||'', login_pass||'', price||0, dev_name||'', dev_phone||'', match_time||'', deadline||'', note||'', req.session.user.username]
  );
  const newCase = getOneSql('SELECT * FROM cases WHERE id = ?', [id]);
  res.json(newCase);
});

router.put('/:id', requireEditor, (req, res) => {
  const existing = getOneSql('SELECT * FROM cases WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: '案件不存在' });
  const { address, company, website, login_user, login_pass, price, dev_name, dev_phone, match_time, deadline, note } = req.body;
  if (!address || !company) return res.status(400).json({ error: '地址和委託公司為必填' });
  const newPass = login_pass || existing.login_pass;
  runSql(
    `UPDATE cases SET address=?,company=?,website=?,login_user=?,login_pass=?,price=?,dev_name=?,dev_phone=?,match_time=?,deadline=?,note=?,operator=?,updated_at=datetime('now','localtime') WHERE id=?`,
    [address, company, website||'', login_user||'', newPass, price||0, dev_name||'', dev_phone||'', match_time||'', deadline||'', note||'', req.session.user.username, req.params.id]
  );
  const updated = getOneSql('SELECT * FROM cases WHERE id = ?', [req.params.id]);
  res.json(updated);
});

router.delete('/:id', requireAdmin, (req, res) => {
  const existing = getOneSql('SELECT id FROM cases WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: '案件不存在' });
  runSql('DELETE FROM cases WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
