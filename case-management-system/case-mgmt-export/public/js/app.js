/* ── State ── */
let currentUser = null;
let allCases = [];
let currentPage = 1;
const PAGE_SIZE = 10;
let editingCaseId = null;
let viewingCaseId = null;
let editingUserId = null;

/* ── Utilities ── */
const $ = id => document.getElementById(id);
const fmt = n => n ? '$ ' + Number(n).toLocaleString() : '—';
const fmtDate = d => d ? d.replace('T', ' ').slice(0, 16) : '—';
const fmtDateShort = d => d || '—';

function getStatus(deadline) {
  if (!deadline) return 'active';
  const diff = (new Date(deadline) - new Date().setHours(0,0,0,0)) / 86400000;
  if (diff < 0) return 'expired';
  if (diff <= 30) return 'soon';
  return 'active';
}
const statusLabel = { active: '有效', expired: '已截止', soon: '即將截止' };
const statusClass = { active: 'badge-active', expired: 'badge-expired', soon: 'badge-soon' };

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '請求失敗');
  return data;
}

/* ── Auth ── */
async function checkAuth() {
  try {
    currentUser = await api('GET', '/api/auth/me');
    showApp();
  } catch { showLogin(); }
}

async function doLogin() {
  const btn = $('loginBtn');
  btn.disabled = true; btn.textContent = '登入中…';
  $('loginError').textContent = '';
  try {
    const res = await api('POST', '/api/auth/login', {
      username: $('loginUsername').value.trim(),
      password: $('loginPassword').value,
    });
    currentUser = res.user;
    showApp();
  } catch (e) {
    $('loginError').textContent = e.message;
  } finally {
    btn.disabled = false; btn.textContent = '登入';
  }
}

async function doLogout() {
  await api('POST', '/api/auth/logout');
  currentUser = null;
  $('mainApp').classList.add('hidden');
  $('loginPage').classList.remove('hidden');
  $('loginPassword').value = '';
}

$('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

function showLogin() {
  $('loginPage').classList.remove('hidden');
  $('mainApp').classList.add('hidden');
}

function showApp() {
  $('loginPage').classList.add('hidden');
  $('mainApp').classList.remove('hidden');

  $('navAvatar').textContent = currentUser.name.slice(0, 1);
  $('navName').textContent = currentUser.name;
  const rp = $('navRole');
  rp.textContent = { admin: '管理員', user: '一般用戶', viewer: '查看者' }[currentUser.role];
  rp.className = 'role-pill ' + { admin: 'role-admin', user: 'role-user', viewer: 'role-viewer' }[currentUser.role];

  if (currentUser.role !== 'admin') {
    $('usersTabBtn').classList.add('hidden');
    $('addCaseBtn').style.display = currentUser.role === 'viewer' ? 'none' : '';
  }

  loadCases();
}

/* ── Tab switching ── */
function switchTab(tab) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  $(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.remove('hidden');
  if (tab === 'users') loadUsers();
}

/* ── Cases ── */
async function loadCases() {
  const q = $('searchInput').value.trim();
  const status = $('statusFilter').value;
  const sort = $('sortField').value;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (sort) params.set('sort', sort);

  try {
    allCases = await api('GET', '/api/cases?' + params);
    currentPage = 1;
    renderCases();
    renderStats();
  } catch (e) { alert(e.message); }
}

function renderStats() {
  const all = await api ? allCases : [];
  const active = allCases.filter(c => getStatus(c.deadline) === 'active').length;
  const soon = allCases.filter(c => getStatus(c.deadline) === 'soon').length;
  const expired = allCases.filter(c => getStatus(c.deadline) === 'expired').length;

  $('statsRow').innerHTML = `
    <div class="stat-card"><div class="stat-label">顯示案件</div><div class="stat-value">${allCases.length}</div></div>
    <div class="stat-card"><div class="stat-label">有效</div><div class="stat-value" style="color:var(--green-text)">${active}</div></div>
    <div class="stat-card"><div class="stat-label">即將截止</div><div class="stat-value" style="color:var(--amber-text)">${soon}</div></div>
    <div class="stat-card"><div class="stat-label">已截止</div><div class="stat-value" style="color:var(--red-text)">${expired}</div></div>
  `;
}

function renderCases() {
  const total = allCases.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > pages) currentPage = 1;
  const slice = allCases.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const isAdmin = currentUser.role === 'admin';
  const canEdit = currentUser.role !== 'viewer';

  const tbody = $('casesBody');
  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-row">找不到符合條件的案件</td></tr>`;
  } else {
    tbody.innerHTML = slice.map(c => {
      const s = getStatus(c.deadline);
      return `<tr>
        <td title="${c.address}">${c.address}</td>
        <td title="${c.company}">${c.company}</td>
        <td>${fmt(c.price)}</td>
        <td>${c.dev_name || '—'}</td>
        <td>${c.dev_phone || '—'}</td>
        <td>${c.match_time ? c.match_time.slice(0, 10) : '—'}</td>
        <td>${c.deadline || '—'}</td>
        <td>${c.operator || '—'}</td>
        <td><span class="badge ${statusClass[s]}">${statusLabel[s]}</span></td>
        <td>
          <button class="act-btn" onclick="openDetail(${c.id})">查看</button>
          ${canEdit ? `<button class="act-btn" onclick="openCaseForm(${c.id})">編輯</button>` : ''}
          ${isAdmin ? `<button class="act-btn danger" onclick="deleteCase(${c.id})">刪除</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  }

  let pageHtml = '';
  for (let i = 1; i <= pages; i++) pageHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  $('pagination').innerHTML = `<span>共 ${total} 筆資料</span><div class="page-btns">${pageHtml}</div>`;
}

function goPage(p) { currentPage = p; renderCases(); }

function openCaseForm(id) {
  editingCaseId = id || null;
  $('caseModalTitle').textContent = id ? '編輯案件' : '新增案件';
  const fields = ['fAddress','fCompany','fWebsite','fLoginUser','fLoginPass','fPrice','fDevName','fDevPhone','fMatchTime','fDeadline','fNote'];

  if (id) {
    const c = allCases.find(x => x.id === id);
    if (!c) return;
    $('fAddress').value = c.address || '';
    $('fCompany').value = c.company || '';
    $('fWebsite').value = c.website || '';
    $('fLoginUser').value = c.login_user || '';
    $('fLoginPass').value = '';
    $('fPrice').value = c.price || '';
    $('fDevName').value = c.dev_name || '';
    $('fDevPhone').value = c.dev_phone || '';
    $('fMatchTime').value = c.match_time || '';
    $('fDeadline').value = c.deadline || '';
    $('fNote').value = c.note || '';
  } else {
    fields.forEach(f => $(f).value = '');
  }
  $('caseModal').classList.remove('hidden');
}

function closeCaseModal() { $('caseModal').classList.add('hidden'); }

async function saveCase() {
  const body = {
    address: $('fAddress').value.trim(),
    company: $('fCompany').value.trim(),
    website: $('fWebsite').value.trim(),
    login_user: $('fLoginUser').value.trim(),
    login_pass: $('fLoginPass').value.trim(),
    price: parseInt($('fPrice').value) || 0,
    dev_name: $('fDevName').value.trim(),
    dev_phone: $('fDevPhone').value.trim(),
    match_time: $('fMatchTime').value,
    deadline: $('fDeadline').value,
    note: $('fNote').value.trim(),
  };
  if (!body.address || !body.company) { alert('請填寫地址和委託公司'); return; }
  try {
    if (editingCaseId) {
      await api('PUT', `/api/cases/${editingCaseId}`, body);
    } else {
      await api('POST', '/api/cases', body);
    }
    closeCaseModal();
    await loadCases();
  } catch (e) { alert(e.message); }
}

async function deleteCase(id) {
  if (!confirm('確定要刪除此案件？此操作無法復原。')) return;
  try {
    await api('DELETE', `/api/cases/${id}`);
    await loadCases();
  } catch (e) { alert(e.message); }
}

async function openDetail(id) {
  try {
    const c = await api('GET', `/api/cases/${id}`);
    viewingCaseId = id;
    const s = getStatus(c.deadline);
    $('detailModalTitle').innerHTML = `<span style="font-weight:500">${c.address}</span> <span class="badge ${statusClass[s]}" style="margin-left:8px;vertical-align:middle;">${statusLabel[s]}</span>`;

    const isAdmin = currentUser.role === 'admin';
    $('detailBody').innerHTML = `
      <div class="section-title" style="padding-top:0">基本資料</div>
      <div class="detail-grid">
        <div class="detail-row"><span class="detail-label">委託公司</span><span class="detail-value">${c.company || '—'}</span></div>
        <div class="detail-row"><span class="detail-label">委託價格</span><span class="detail-value">${fmt(c.price)}</span></div>
        <div class="detail-row"><span class="detail-label">公司網站</span><span class="detail-value">${c.website ? `<a href="${c.website}" target="_blank">${c.website}</a>` : '—'}</span></div>
        <div class="detail-row"><span class="detail-label">操作人</span><span class="detail-value">${c.operator || '—'}</span></div>
        <div class="detail-row"><span class="detail-label">網站登入帳號</span><span class="detail-value">${c.login_user || '—'}</span></div>
        <div class="detail-row"><span class="detail-label">網站登入密碼</span><span class="detail-value">${isAdmin ? (c.login_pass || '—') : '<span class="pass-hidden">（僅管理員可見）</span>'}</span></div>
      </div>
      <div class="section-title">開發聯絡人</div>
      <div class="detail-grid">
        <div class="detail-row"><span class="detail-label">開發姓名</span><span class="detail-value">${c.dev_name || '—'}</span></div>
        <div class="detail-row"><span class="detail-label">開發電話</span><span class="detail-value">${c.dev_phone || '—'}</span></div>
      </div>
      <div class="section-title">時程</div>
      <div class="detail-grid">
        <div class="detail-row"><span class="detail-label">配按時間</span><span class="detail-value">${fmtDate(c.match_time)}</span></div>
        <div class="detail-row"><span class="detail-label">截止日</span><span class="detail-value">${fmtDateShort(c.deadline)}</span></div>
        <div class="detail-row"><span class="detail-label">建立時間</span><span class="detail-value">${c.created_at || '—'}</span></div>
        <div class="detail-row"><span class="detail-label">最後更新</span><span class="detail-value">${c.updated_at || '—'}</span></div>
      </div>
      ${c.note ? `<div class="section-title">備注</div><div style="font-size:13px;line-height:1.6;">${c.note}</div>` : ''}
    `;

    const canEdit = currentUser.role !== 'viewer';
    $('detailEditBtn').style.display = canEdit ? '' : 'none';
    $('detailModal').classList.remove('hidden');
  } catch (e) { alert(e.message); }
}

function closeDetailModal() { $('detailModal').classList.add('hidden'); }

function editFromDetail() {
  closeDetailModal();
  openCaseForm(viewingCaseId);
}

/* ── Users ── */
async function loadUsers() {
  try {
    const users = await api('GET', '/api/users');
    const roleLabel = { admin: '管理員', user: '一般用戶', viewer: '查看者' };
    const roleClass = { admin: 'role-admin', user: 'role-user', viewer: 'role-viewer' };
    $('usersBody').innerHTML = users.map(u => `
      <tr>
        <td>${u.username}</td>
        <td>${u.name}</td>
        <td><span class="role-pill ${roleClass[u.role]}">${roleLabel[u.role]}</span></td>
        <td>${u.created_at || '—'}</td>
        <td>
          <button class="act-btn" onclick="openUserForm(${u.id})">編輯</button>
          ${u.id !== currentUser.id ? `<button class="act-btn danger" onclick="deleteUser(${u.id})">刪除</button>` : ''}
        </td>
      </tr>
    `).join('');
  } catch (e) { alert(e.message); }
}

function openUserForm(id) {
  editingUserId = id || null;
  $('userModalTitle').textContent = id ? '編輯用戶' : '新增用戶';
  if (id) {
    api('GET', '/api/users').then(users => {
      const u = users.find(x => x.id === id);
      if (!u) return;
      $('uUsername').value = u.username;
      $('uUsername').disabled = true;
      $('uName').value = u.name;
      $('uPassword').value = '';
      $('uRole').value = u.role;
    });
  } else {
    $('uUsername').value = ''; $('uUsername').disabled = false;
    $('uName').value = ''; $('uPassword').value = ''; $('uRole').value = 'user';
  }
  $('userModal').classList.remove('hidden');
}

function closeUserModal() { $('userModal').classList.add('hidden'); }

async function saveUser() {
  const body = { name: $('uName').value.trim(), role: $('uRole').value, password: $('uPassword').value };
  try {
    if (editingUserId) {
      await api('PUT', `/api/users/${editingUserId}`, body);
    } else {
      body.username = $('uUsername').value.trim();
      await api('POST', '/api/users', body);
    }
    closeUserModal();
    loadUsers();
  } catch (e) { alert(e.message); }
}

async function deleteUser(id) {
  if (!confirm('確定要刪除此用戶？')) return;
  try { await api('DELETE', `/api/users/${id}`); loadUsers(); }
  catch (e) { alert(e.message); }
}

/* ── Close modals on overlay click ── */
$('caseModal').addEventListener('click', e => { if (e.target === $('caseModal')) closeCaseModal(); });
$('detailModal').addEventListener('click', e => { if (e.target === $('detailModal')) closeDetailModal(); });
$('userModal').addEventListener('click', e => { if (e.target === $('userModal')) closeUserModal(); });

/* ── Init ── */
checkAuth();
