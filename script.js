// ===============================
// QUADRO SEMANAL (Seg a Dom)
// Carrega CSV exportado do Excel
// ===============================

const DEFAULT_CSV_URL = 'dados.csv';

const DIAS = [
  { id: 'segunda',  label: 'SEGUNDA' },
  { id: 'terca',    label: 'TERÇA' },
  { id: 'quarta',   label: 'QUARTA' },
  { id: 'quinta',   label: 'QUINTA' },
  { id: 'sexta',    label: 'SEXTA' },
  { id: 'sabado',   label: 'SÁBADO' },
  { id: 'domingo',  label: 'DOMINGO' },
];

const DIA_SYNONYMS = new Map([
  ['seg', 'segunda'], ['segunda', 'segunda'], ['segunda-feira', 'segunda'],
  ['ter', 'terca'], ['terça', 'terca'], ['terca', 'terca'], ['terça-feira', 'terca'], ['terca-feira', 'terca'],
  ['qua', 'quarta'], ['quarta', 'quarta'], ['quarta-feira', 'quarta'],
  ['qui', 'quinta'], ['quinta', 'quinta'], ['quinta-feira', 'quinta'],
  ['sex', 'sexta'], ['sexta', 'sexta'], ['sexta-feira', 'sexta'],
  ['sab', 'sabado'], ['sáb', 'sabado'], ['sábado', 'sabado'], ['sabado', 'sabado'], ['sábado-feira', 'sabado'], ['sabado-feira', 'sabado'],
  ['dom', 'domingo'], ['domingo', 'domingo'],
]);

let allItems = [];
let query = '';

const els = {
  board: document.getElementById('board'),
  csvFile: document.getElementById('csvFile'),
  btnLoadDefault: document.getElementById('btnLoadDefault'),
  q: document.getElementById('q'),
  statusLine: document.getElementById('statusLine'),
  tplColumn: document.getElementById('tpl-column'),
  tplCard: document.getElementById('tpl-card'),
};

init();

function init(){
  renderEmptyBoard();

  els.csvFile.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    loadFromCsvText(text, `Arquivo: ${file.name}`);
  });

  els.btnLoadDefault.addEventListener('click', async () => {
    try{
      const res = await fetch(DEFAULT_CSV_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      loadFromCsvText(text, `Carregado: ${DEFAULT_CSV_URL}`);
    }catch(err){
      setStatus(`Falha ao carregar ${DEFAULT_CSV_URL}. Verifique se o arquivo existe no GitHub Pages. (${String(err.message || err)})`);
    }
  });

  els.q.addEventListener('input', () => {
    query = (els.q.value || '').trim().toLowerCase();
    renderBoard(allItems);
  });

  setStatus('Nenhum CSV carregado ainda.');
}

function setStatus(msg){
  els.statusLine.textContent = msg;
}

function renderEmptyBoard(){
  els.board.innerHTML = '';
  DIAS.forEach(d => {
    const col = els.tplColumn.content.firstElementChild.cloneNode(true);
    col.dataset.dia = d.id;
    col.querySelector('.col-title').textContent = d.label;
    col.querySelector('.col-count').textContent = '0';
    els.board.appendChild(col);
  });
}

function loadFromCsvText(text, sourceLabel){
  const rows = parseCsvSmart(text);
  if (!rows.length){
    setStatus(`CSV vazio ou inválido. (${sourceLabel})`);
    allItems = [];
    renderBoard(allItems);
    return;
  }

  const items = rows
    .map((r, idx) => toItem(r, idx + 2)) // +2 para considerar header (linha 1)
    .filter(Boolean);

  allItems = items;
  setStatus(`${sourceLabel} — ${items.length} cartão(ões).`);
  renderBoard(allItems);
}

function renderBoard(items){
  // filtro por busca (simples)
  const filtered = query ? items.filter(it => {
    const hay = [
      it.dia, it.horaRaw, it.tipo, it.obs, it.cliente, it.cidade,
      it.equipamentosRaw, it.tecnicosRaw, it.statusRaw, it.dataRaw
    ].join(' ').toLowerCase();
    return hay.includes(query);
  }) : items;

  // agrupar por dia
  const byDay = new Map(DIAS.map(d => [d.id, []]));
  filtered.forEach(it => {
    if (!byDay.has(it.dia)) return;
    byDay.get(it.dia).push(it);
  });

  // ordenar por hora dentro do dia
  for (const [dia, list] of byDay.entries()){
    list.sort((a, b) => (a.horaMin - b.horaMin) || a._line - b._line);
  }

  // render
  renderEmptyBoard();
  DIAS.forEach(d => {
    const col = els.board.querySelector(`.col[data-dia="${d.id}"]`);
    const body = col.querySelector('.col-body');
    const list = byDay.get(d.id) || [];
    col.querySelector('.col-count').textContent = String(list.length);

    list.forEach(it => {
      const card = renderCard(it);
      body.appendChild(card);
    });
  });
}

function renderCard(it){
  const card = els.tplCard.content.firstElementChild.cloneNode(true);

  // labels (barrinhas coloridas)
  const labelsEl = card.querySelector('.labels');
  const labelColors = getLabelColors(it.tipo);
  labelColors.slice(0, 3).forEach(c => {
    const bar = document.createElement('div');
    bar.className = 'label-bar';
    bar.style.background = c;
    labelsEl.appendChild(bar);
  });

  // status dot
  const dot = card.querySelector('.status-dot');
  const s = normalizeStatus(it.statusRaw);
  dot.classList.add(`status-${s.className}`);
  dot.title = s.title;

  // title
  card.querySelector('.card-title').textContent = [
    it.horaRaw ? `${it.horaRaw} — ` : '',
    it.tipo || '(Sem tipo)'
  ].join('');

  // description (estilo do print)
  const descLines = [];

  if (it.obs) descLines.push(it.obs);

  const line1 = compactLine([
    it.cliente,
    it.cidade
  ]);
  if (line1) descLines.push(`- ${line1}`);

  const eqLine = it.equipamentosRaw ? `- ${it.equipamentosRaw}` : '';
  if (eqLine) descLines.push(eqLine);

  if (it.tecnicos.length){
    const n = it.tecnicos.length;
    descLines.push(`(${n} TÉCNICO${n === 1 ? '' : 'S'})`);
  }

  card.querySelector('.card-desc').textContent = descLines.join('\n');

  // date chip (opcional)
  const chip = card.querySelector('.chip-date');
  if (it.dataObj){
    chip.hidden = false;
    chip.textContent = formatDateChip(it.dataObj);
  } else {
    chip.hidden = true;
  }

  // avatars (técnicos)
  const avatars = card.querySelector('.avatars');
  it.tecnicos.slice(0, 4).forEach((t, i) => {
    const av = document.createElement('div');
    av.className = 'avatar';
    av.textContent = initialsOf(t);
    av.style.background = pickAvatarColor(t, i);
    av.title = t;
    avatars.appendChild(av);
  });

  return card;
}

// -------------------------------
// CSV + Normalização
// -------------------------------

function parseCsvSmart(text){
  const trimmed = (text || '').trim();
  if (!trimmed) return [];

  const firstLine = trimmed.split(/\r?\n/)[0] || '';
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  const rows = parseCsvQuoted(trimmed, delimiter);
  if (!rows.length) return [];

  const header = rows[0].map(h => normalizeHeader(h));
  const out = [];

  for (let i = 1; i < rows.length; i++){
    const line = rows[i];
    if (line.every(v => !String(v || '').trim())) continue;

    const obj = {};
    header.forEach((k, idx) => obj[k] = (line[idx] ?? '').toString().trim());
    out.push(obj);
  }
  return out;
}

// Parser simples com suporte a aspas
function parseCsvQuoted(text, delimiter){
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++){
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"'){
      if (inQuotes && next === '"'){
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter){
      row.push(cur);
      cur = '';
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')){
      if (ch === '\r' && next === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
      continue;
    }

    cur += ch;
  }

  row.push(cur);
  rows.push(row);
  return rows;
}

function normalizeHeader(s){
  return stripAccents(String(s || ''))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function stripAccents(s){
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function toItem(r, lineNumber){
  // Suporte a nomes de colunas simples no Excel
  // Recomendadas:
  // data, dia, hora, tipo, observacao, cliente, cidade, equipamentos, tecnicos, status
  const dataRaw = pick(r, ['data', 'dt', 'data_da_operacao']);
  const diaRaw  = pick(r, ['dia', 'dia_da_semana', 'semana']);
  const horaRaw = pick(r, ['hora', 'horario', 'h']);
  const tipo    = pick(r, ['tipo', 'operacao', 'atividade']) || '';
  const obs     = pick(r, ['observacao', 'obs', 'nota', 'detalhes']) || '';
  const cliente = pick(r, ['cliente']) || '';
  const cidade  = pick(r, ['cidade', 'municipio']) || '';
  const equipamentosRaw = pick(r, ['equipamentos', 'equipamento']) || '';
  const tecnicosRaw     = pick(r, ['tecnicos', 'tecnico', 'time']) || '';
  const statusRaw       = pick(r, ['status', 'situacao']) || '';

  const dataObj = parseDateBr(dataRaw);
  const dia = normalizeDia(diaRaw) || (dataObj ? dayIdFromDate(dataObj) : null);

  if (!dia){
    // se não veio DIA nem DATA, não tem como colocar em coluna
    // (você pode preferir jogar em "segunda" por padrão, mas aqui eu prefiro avisar)
    return {
      _invalid: true,
      _line: lineNumber,
      dia: 'segunda',
      horaRaw: horaRaw || '',
      horaMin: parseTimeToMinutes(horaRaw),
      tipo: tipo || '',
      obs: obs || `Linha ${lineNumber}: faltou DIA ou DATA`,
      cliente, cidade,
      equipamentosRaw, tecnicosRaw,
      tecnicos: splitList(tecnicosRaw),
      statusRaw,
      dataRaw,
      dataObj: dataObj || null,
    };
  }

  return {
    _line: lineNumber,
    dia,
    horaRaw: (horaRaw || '').trim(),
    horaMin: parseTimeToMinutes(horaRaw),
    tipo: (tipo || '').trim(),
    obs: (obs || '').trim(),
    cliente: (cliente || '').trim(),
    cidade: (cidade || '').trim(),
    equipamentosRaw: (equipamentosRaw || '').trim(),
    tecnicosRaw: (tecnicosRaw || '').trim(),
    tecnicos: splitList(tecnicosRaw),
    statusRaw: (statusRaw || '').trim(),
    dataRaw: (dataRaw || '').trim(),
    dataObj,
  };
}

function pick(obj, keys){
  for (const k of keys){
    if (obj[k] != null && String(obj[k]).trim() !== '') return String(obj[k]).trim();
  }
  return '';
}

function normalizeDia(s){
  const raw = stripAccents(String(s || '')).trim().toLowerCase();
  if (!raw) return '';
  // remove sufixos e pontuação
  const cleaned = raw.replace(/[^\w-]/g, '').replace(/feira/g, 'feira');
  return DIA_SYNONYMS.get(cleaned) || DIA_SYNONYMS.get(raw) || '';
}

function parseTimeToMinutes(hhmm){
  const s = String(hhmm || '').trim();
  if (!s) return 9999; // sem hora vai pro final
  const m = s.match(/^(\d{1,2})\s*:\s*(\d{2})$/);
  if (!m) return 9999;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return 9999;
  return h * 60 + min;
}

function splitList(s){
  const raw = String(s || '').trim();
  if (!raw) return [];
  // aceita separador por vírgula ou "+"
  return raw
    .split(/[,;+]/g)
    .map(x => x.trim())
    .filter(Boolean);
}

function parseDateBr(s){
  const raw = String(s || '').trim();
  if (!raw) return null;

  // aceita dd/mm/aaaa ou dd-mm-aaaa
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  let yyyy = Number(m[3]);
  if (String(m[3]).length === 2) yyyy += 2000;

  if (!dd || !mm || !yyyy) return null;

  // Date: mês é 0-based
  const d = new Date(yyyy, mm - 1, dd);
  // validação básica
  if (d.getFullYear() !== yyyy || d.getMonth() !== (mm - 1) || d.getDate() !== dd) return null;

  return d;
}

function dayIdFromDate(date){
  // JS: 0=Dom,1=Seg,...6=Sáb
  const dow = date.getDay();
  if (dow === 0) return 'domingo';
  if (dow === 1) return 'segunda';
  if (dow === 2) return 'terca';
  if (dow === 3) return 'quarta';
  if (dow === 4) return 'quinta';
  if (dow === 5) return 'sexta';
  return 'sabado';
}

// -------------------------------
// Visual / Regras de cor
// -------------------------------

function normalizeStatus(s){
  const raw = stripAccents(String(s || '')).trim().toLowerCase();
  if (!raw) return { className: 'neutro', title: 'Sem status' };

  if (raw.includes('ok') || raw.includes('confirmado') || raw.includes('feito')) {
    return { className: 'ok', title: 'OK' };
  }
  if (raw.includes('cancel')) {
    return { className: 'cancelado', title: 'Cancelado' };
  }
  if (raw.includes('pend') || raw.includes('aguard') || raw.includes('confirmar')) {
    return { className: 'pendente', title: 'Pendente' };
  }
  return { className: 'neutro', title: s };
}

function getLabelColors(tipo){
  const t = stripAccents(String(tipo || '')).toLowerCase();

  // mapeamento simples (ajustável)
  const colors = [];
  if (t.includes('entrega')) colors.push('#34d399');      // verde
  if (t.includes('retirada')) colors.push('#60a5fa');    // azul
  if (t.includes('instal')) colors.push('#f472b6');      // rosa
  if (t.includes('ac')) colors.push('#a78bfa');          // roxo

  if (!colors.length) colors.push('#94a3b8');            // cinza
  return colors;
}

function formatDateChip(date){
  // exibe "21 de abr."
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function initialsOf(name){
  const n = String(name || '').trim();
  if (!n) return '?';

  // se for algo como "JB" já devolve
  if (/^[A-Za-z]{2,3}$/.test(n)) return n.toUpperCase();

  const parts = n.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : (parts[0]?.[1] || '');
  return (first + last).toUpperCase() || n.slice(0, 2).toUpperCase();
}

function pickAvatarColor(seed, i){
  const palette = ['#7c3aed', '#0ea5e9', '#ef4444', '#10b981', '#f59e0b', '#111827'];
  let h = 0;
  const s = String(seed || '');
  for (let j = 0; j < s.length; j++) h = (h * 31 + s.charCodeAt(j)) >>> 0;
  return palette[(h + i) % palette.length];
}

function compactLine(parts){
  return parts.map(p => String(p || '').trim()).filter(Boolean).join(', ');
}