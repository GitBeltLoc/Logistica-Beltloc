const CSV_URL = 'dados.csv';

const DIAS = [
  { id: 'segunda', label: 'SEGUNDA' },
  { id: 'terca',   label: 'TERÇA'   },
  { id: 'quarta',  label: 'QUARTA'  },
  { id: 'quinta',  label: 'QUINTA'  },
  { id: 'sexta',   label: 'SEXTA'   },
  { id: 'sabado',  label: 'SÁBADO'  },
  { id: 'domingo', label: 'DOMINGO' },
];

const DIA_MAP = {
  'segunda': 'segunda', 'seg': 'segunda',
  'terca': 'terca', 'terça': 'terca', 'ter': 'terca',
  'quarta': 'quarta', 'qua': 'quarta',
  'quinta': 'quinta', 'qui': 'quinta',
  'sexta': 'sexta', 'sex': 'sexta',
  'sabado': 'sabado', 'sábado': 'sabado', 'sab': 'sabado', 'sáb': 'sabado',
  'domingo': 'domingo', 'dom': 'domingo',
};

let allItems = [];

document.addEventListener('DOMContentLoaded', () => {
  buildBoard();
  loadCSV();

  document.getElementById('q').addEventListener('input', function () {
    renderBoard(allItems, this.value.trim().toLowerCase());
  });
});

// ── CARREGAMENTO ──────────────────────────────────────────
function loadCSV() {
  setStatus('Carregando dados...');

  fetch(CSV_URL + '?nocache=' + Date.now())
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(text => {
      if (!text || !text.trim()) throw new Error('Arquivo vazio');
      allItems = parseCSV(text);
      setStatus('✅ ' + allItems.length + ' operações carregadas.');
      renderBoard(allItems, '');
    })
    .catch(err => {
      setStatus('❌ Erro: ' + err.message + ' — Verifique se dados.csv está na raiz do repositório.');
    });
}

// ── PARSER CSV ────────────────────────────────────────────
function parseCSV(raw) {
  // Remove BOM
  const text = raw.replace(/^\uFEFF/, '').trim();
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Detecta delimitador
  const first = lines[0];
  const delim = (first.split(';').length > first.split(',').length) ? ';' : ',';

  const headers = first.split(delim).map(h => normalize(h));
  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = splitLine(line, delim);
    const row = {};
    headers.forEach((h, idx) => row[h] = (cols[idx] || '').trim());

    const diaRaw = normalize(row['dia'] || '');
    const dia = DIA_MAP[diaRaw];
    if (!dia) continue;

    items.push({
      dia,
      hora:    row['hora'] || '',
      tipo:    row['tipo'] || '',
      obs:     row['observacao'] || row['obs'] || '',
      cliente: row['cliente'] || '',
      cidade:  row['cidade'] || '',
      equip:   row['equipamentos'] || row['equipamento'] || '',
      tecs:    splitTecs(row['tecnicos'] || row['tecnico'] || ''),
      status:  row['status'] || '',
      horaMin: toMin(row['hora'] || ''),
    });
  }

  return items;
}

// Divide linha respeitando aspas
function splitLine(line, delim) {
  const cols = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (!inQ && c === delim) { cols.push(cur); cur = ''; continue; }
    cur += c;
  }
  cols.push(cur);
  return cols;
}

function normalize(s) {
  return String(s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function splitTecs(s) {
  return String(s || '').split(/[,;+]/).map(t => t.trim()).filter(Boolean);
}

function toMin(hhmm) {
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
  return m ? +m[1] * 60 + +m[2] : 9999;
}

// ── RENDER ────────────────────────────────────────────────
function buildBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  const tpl = document.getElementById('tpl-column');
  DIAS.forEach(d => {
    const col = tpl.content.firstElementChild.cloneNode(true);
    col.dataset.dia = d.id;
    col.querySelector('.col-title').textContent = d.label;
    board.appendChild(col);
  });
}

function renderBoard(items, q) {
  const byDay = {};
  DIAS.forEach(d => byDay[d.id] = []);

  const filtered = q ? items.filter(it =>
    [it.dia, it.hora, it.tipo, it.obs, it.cliente, it.cidade, it.equip, it.tecs.join(' '), it.status]
      .join(' ').toLowerCase().includes(q)
  ) : items;

  filtered.forEach(it => {
    if (byDay[it.dia]) byDay[it.dia].push(it);
  });

  DIAS.forEach(d => {
    const col = document.querySelector(`.col[data-dia="${d.id}"]`);
    const body = col.querySelector('.col-body');
    const list = byDay[d.id].sort((a, b) => a.horaMin - b.horaMin);

    col.querySelector('.col-count').textContent = list.length;
    body.innerHTML = '';
    list.forEach(it => body.appendChild(makeCard(it)));
  });
}

function makeCard(it) {
  const tpl = document.getElementById('tpl-card');
  const card = tpl.content.firstElementChild.cloneNode(true);

  // Barrinhas coloridas
  const labelsEl = card.querySelector('.labels');
  getColors(it.tipo).forEach(c => {
    const bar = document.createElement('div');
    bar.className = 'label-bar';
    bar.style.background = c;
    labelsEl.appendChild(bar);
  });

  // Status dot
  const dot = card.querySelector('.status-dot');
  const st = getStatus(it.status);
  dot.classList.add('status-' + st);
  dot.title = it.status;

  // Título
  card.querySelector('.card-title').textContent =
    (it.hora ? it.hora + ' — ' : '') + (it.tipo || 'Sem tipo');

  // Descrição
  const lines = [];
  if (it.obs)     lines.push(it.obs);
  if (it.cliente || it.cidade) lines.push('- ' + [it.cliente, it.cidade].filter(Boolean).join(', '));
  if (it.equip)   lines.push('- ' + it.equip);
  card.querySelector('.card-desc').textContent = lines.join('\n');

  // Chip data (oculto por padrão)
  card.querySelector('.chip-date').hidden = true;

  // Avatares técnicos
  const avatars = card.querySelector('.avatars');
  it.tecs.slice(0, 4).forEach((t, i) => {
    const av = document.createElement('div');
    av.className = 'avatar';
    av.style.background = avatarColor(t, i);
    av.textContent = initials(t);
    av.title = t;
    avatars.appendChild(av);
  });

  return card;
}

// ── HELPERS VISUAIS ───────────────────────────────────────
function getColors(tipo) {
  const t = normalize(tipo);
  const c = [];
  if (t.includes('entrega'))  c.push('#34d399');
  if (t.includes('retirada')) c.push('#60a5fa');
  if (t.includes('instal'))   c.push('#f472b6');
  if (t.includes('ac'))       c.push('#a78bfa');
  return c.length ? c : ['#94a3b8'];
}

function getStatus(s) {
  const t = normalize(s);
  if (t.includes('ok') || t.includes('confirmado')) return 'ok';
  if (t.includes('cancel')) return 'cancelado';
  if (t.includes('pend') || t.includes('confirmar')) return 'pendente';
  return 'neutro';
}

function initials(name) {
  const n = name.trim();
  if (/^[A-Za-z]{2,3}$/.test(n)) return n.toUpperCase();
  const p = n.split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase() || n.slice(0, 2).toUpperCase();
}

function avatarColor(seed, i) {
  const p = ['#7c3aed','#0ea5e9','#ef4444','#10b981','#f59e0b','#111827'];
  let h = 0;
  for (let j = 0; j < seed.length; j++) h = (h * 31 + seed.charCodeAt(j)) >>> 0;
  return p[(h + i) % p.length];
}

function setStatus(msg) {
  document.getElementById('statusLine').textContent = msg;
}