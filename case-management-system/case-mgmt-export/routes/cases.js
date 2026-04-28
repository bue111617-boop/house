const express = require('express');
const { querySql, getOneSql, runSql, insertSql } = require('../db');
const router = express.Router();

function requireLogin(req,res,next){ if(!req.session.user) return res.status(401).json({error:'請先登入'}); next(); }
function requireEditor(req,res,next){ if(!req.session.user) return res.status(401).json({error:'請先登入'}); if(req.session.user.role==='viewer') return res.status(403).json({error:'權限不足'}); next(); }
function requireAdmin(req,res,next){ if(!req.session.user) return res.status(401).json({error:'請先登入'}); if(req.session.user.role!=='admin') return res.status(403).json({error:'需要管理員權限'}); next(); }

// 取得操作人姓名
function withOperatorName(rows) {
  const users = querySql('SELECT username, name FROM users');
  const nameMap = {};
  users.forEach(u => nameMap[u.username] = u.name);
  return rows.map(r => ({ ...r, operator_name: nameMap[r.operator] || r.operator }));
}

router.get('/', requireLogin, (req,res) => {
  const { q, status, operator, sort } = req.query;
  let sql = 'SELECT * FROM cases WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (case_name LIKE ? OR address LIKE ? OR company LIKE ? OR dev_name LIKE ? OR dev_phone LIKE ? OR note LIKE ?)';
    const like = '%' + q + '%';
    params.push(like,like,like,like,like,like);
  }
  if (operator) { sql += ' AND operator = ?'; params.push(operator); }
  const orderMap = { price:'price DESC', deadline:'CASE WHEN deadline IS NULL OR deadline="" THEN 1 ELSE 0 END, deadline ASC', company:'company ASC', createdAt:'id DESC' };
  sql += ' ORDER BY ' + (orderMap[sort]||'id DESC');
  let rows = querySql(sql, params);
  if (status) {
    const now = new Date(); now.setHours(0,0,0,0);
    rows = rows.filter(r => {
      if (!r.deadline) return status==='active';
      const diff = (new Date(r.deadline)-now)/86400000;
      if (status==='expired') return diff<0;
      if (status==='soon') return diff>=0&&diff<=30;
      if (status==='active') return diff>30;
      return true;
    });
  }
  res.json(withOperatorName(rows));
});

router.get('/:id', requireLogin, (req,res) => {
  const row = getOneSql('SELECT * FROM cases WHERE id=?', [req.params.id]);
  if (!row) return res.status(404).json({error:'案件不存在'});
  const user = getOneSql('SELECT name FROM users WHERE username=?', [row.operator]);
  row.operator_name = user ? user.name : row.operator;
  res.json(row);
});

router.post('/', requireEditor, (req,res) => {
  const { case_name, address, company, website, price, reserve_price, dev_name, dev_phone, match_time, deadline, note, screenshot } = req.body;
  if (!address||!company) return res.status(400).json({error:'地址和委託公司為必填'});
  const id = insertSql(
    'INSERT INTO cases (case_name,address,company,website,price,reserve_price,dev_name,dev_phone,match_time,deadline,note,screenshot,operator) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [case_name||'',address,company,website||'',price||0,reserve_price||0,dev_name||'',dev_phone||'',match_time||'',deadline||'',note||'',screenshot||'',req.session.user.username]
  );
  const newCase = getOneSql('SELECT * FROM cases WHERE id=?', [id]);
  const user = getOneSql('SELECT name FROM users WHERE username=?', [newCase.operator]);
  newCase.operator_name = user ? user.name : newCase.operator;
  res.json(newCase);
});

router.put('/:id', requireEditor, (req,res) => {
  const existing = getOneSql('SELECT * FROM cases WHERE id=?', [req.params.id]);
  if (!existing) return res.status(404).json({error:'案件不存在'});
  const { case_name, address, company, website, price, reserve_price, dev_name, dev_phone, match_time, deadline, note, screenshot } = req.body;
  if (!address||!company) return res.status(400).json({error:'地址和委託公司為必填'});
  const ss = screenshot !== undefined ? screenshot : existing.screenshot;
  runSql(
    "UPDATE cases SET case_name=?,address=?,company=?,website=?,price=?,reserve_price=?,dev_name=?,dev_phone=?,match_time=?,deadline=?,note=?,screenshot=?,operator=?,updated_at=datetime('now','localtime') WHERE id=?",
    [case_name||'',address,company,website||'',price||0,reserve_price||0,dev_name||'',dev_phone||'',match_time||'',deadline||'',note||'',ss,req.session.user.username,req.params.id]
  );
  const updated = getOneSql('SELECT * FROM cases WHERE id=?', [req.params.id]);
  const user = getOneSql('SELECT name FROM users WHERE username=?', [updated.operator]);
  updated.operator_name = user ? user.name : updated.operator;
  res.json(updated);
});

router.delete('/:id', requireAdmin, (req,res) => {
  if (!getOneSql('SELECT id FROM cases WHERE id=?', [req.params.id])) return res.status(404).json({error:'案件不存在'});
  runSql('DELETE FROM cases WHERE id=?', [req.params.id]);
  res.json({ok:true});
});

module.exports = router;
