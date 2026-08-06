
// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
let currentView = 'inbox';
var orcamentosMes = JSON.parse(localStorage.getItem('painel_orc_mes') || '{}');

let backlog = [];
let nextBacklogId = 8;

let tasks = [];
let nextTaskId = 200;

let kanbanCols = [];
let nextColId = 10;

let finCategories = [];
let customPayMethods = JSON.parse(localStorage.getItem('painel_pay_methods') || '[]');
let finCalMonth = new Date().getMonth();
let finCalYear = new Date().getFullYear();

let nextListId = 10;

let events = [];
let nextEventId = 300;

let finances = [];
let nextFinId = 465;

let lists = [];
let nextListItemId = 100;

let calYear = 2026, calMonth = 5;
let selectedDateKey = todayLocal();
let dragId = null;

// ══════════════════════════════════════════
//  VIEW SWITCHING
// ══════════════════════════════════════════
const viewMeta = {
  inbox:    {title:'Inbox',       sub:'— captura rápida'},
  kanban:   {title:'Tarefas',     sub:'— kanban + gantt'},
  calendar: {title:'Calendário',  sub:'— eventos e prazos'},
  finance:  {title:'Financeiro',  sub:'— fluxo de caixa'},
  lists:    {title:'Listas',      sub:'— referências'},
  notes:    {title:'Notas',       sub:'— mural de notas'},
  estudos:  {title:'Estudos',     sub:'— SEFAZ/RS · FGV'},
  jogo:        {title:'Quitação',    sub:'— jogo de dívidas'},
};

function switchView(name, btn) {
  currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  // Reset scroll ao trocar de view
  var contentEl = document.querySelector('.content') || document.getElementById('content');
  if (contentEl) contentEl.scrollTop = 0;

  // sidebar buttons
  document.querySelectorAll('.sidebar .nav-btn').forEach(b => b.classList.remove('active'));
  // bottom nav buttons
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const m = viewMeta[name];
  document.getElementById('topbar-title').textContent = m.title;
  document.getElementById('topbar-sub').textContent   = m.sub;

  activeFilters = {};
  if (filterPanelOpen) { filterPanelOpen=false; document.getElementById('filter-panel').classList.remove('open'); document.getElementById('filter-toggle-btn').classList.remove('active'); }
  if (name === 'inbox')    renderBacklog();
  if (name === 'kanban')   renderKanban();
  if (name === 'calendar') renderCalendar();
  if (name === 'finance')  renderFinance();
  if (name === 'lists')    renderLists();
  if (name === 'notes')    renderNotes();
  if (name === 'estudos')  renderEstudos();
  if (name === 'jogo')     { jogoUpdateStreak(); renderJogo(); }
}

function onTopbarAction() {
  const actions = {
    inbox:    () => document.getElementById('inbox-input').focus(),
    kanban:   () => openTaskModal(null, null),
    calendar: () => openEventModal(null, null),
    finance:  () => openFinModal(null, null),
    lists:    () => showToast('Clique em "+ Adicionar…" em qualquer lista'),
    notes:    () => openNoteModal(null),
    estudos:  () => openAtividadeModal(),
  };
  (actions[currentView] || (() => {}))();
}

function onTopbarFilter() { toggleFilterPanel(); }

// ══════════════════════════════════════════
//  INBOX / BACKLOG
// ══════════════════════════════════════════
function renderBacklog() {
  const n = backlog.length;  // total badge
  const filtB_count = filteredBacklog().length;
  document.getElementById('backlog-count').textContent = n;
  document.getElementById('badge-sb').textContent = n;
  document.getElementById('badge-bn').textContent = n;

  const filtB = filteredBacklog();
  document.getElementById('backlog-list').innerHTML = activeFiltersPillsHtml() + filtB.map(item => `
    <div class="backlog-item" id="bi-${item.id}" onclick="editBacklog(${item.id})">
      ${(item.photo && (item.photo.startsWith('data:image') || item.photo.startsWith('https://')))
        ? '<div style="width:100%;overflow:hidden;line-height:0;border-radius:var(--radius) var(--radius) 0 0"><img src="' + item.photo + '" style="width:100%;height:200px;object-fit:cover;display:block" loading="lazy"></div>'
        : ''}
      <div class="backlog-content">
        <div class="backlog-header">
          <span class="item-text" id="bit-${item.id}">${escHtml(item.text)}</span>
          <button class="item-opts-btn" onclick="toggleBacklogOpts(${item.id},event)" title="Opções" aria-label="Opções">⋮</button>
        </div>
        ${item.fromGmail && item.meta
          ? `<div class="backlog-gmail"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg> ${escHtml(item.meta.from)}</div>`
          : ''}
        <div style="display:flex;align-items:center;gap:5px;margin-top:6px;flex-wrap:wrap">
          ${(item.tags||[]).map(tg=>`<button class="backlog-tag" onclick="event.stopPropagation();setFilter('tag','${tg}');closeSearch()">#${escHtml(tg)}</button>`).join('')}
          ${item.priority && item.priority!=='normal'
            ? `<span class="backlog-priority ${item.priority}">${item.priority==='urgente'?'🔴':'🔺'} ${item.priority}</span>`
            : ''}
          <span class="item-meta" style="margin-left:auto">${item.time}</span>
        </div>
      </div>
      <div class="item-actions-wrap">
        <div class="item-actions" id="opts-${item.id}" style="display:none">
          <button class="action-chip"       onclick="event.stopPropagation();editBacklog(${item.id})">✏️ Editar</button>
          <button class="action-chip task"  onclick="event.stopPropagation();openTaskModal(${item.id},'${escJs(item.text)}')">→ Tarefa</button>
          <button class="action-chip event" onclick="event.stopPropagation();openEventModal(${item.id},'${escJs(item.text)}')">→ Evento</button>
          <button class="action-chip fin"   onclick="event.stopPropagation();openFinModal(${item.id},'${escJs(item.text)}')">→ Gasto</button>
          <button class="action-chip list"  onclick="event.stopPropagation();openListPick(${item.id},'${escJs(item.text)}')">→ Lista</button>
          <button class="action-chip note"  onclick="event.stopPropagation();openNoteFromBacklog(${item.id},'${escJs(item.text)}')">→ Nota</button>
          <button class="action-chip del"   onclick="event.stopPropagation();deleteBacklog(${item.id})">✕ Remover</button>
        </div>
      </div>
    </div>
  `).join('') || '<p style="color:var(--text-dim);font-size:13px;padding:16px 0">Backlog limpo. ⚡</p>';
}

function addToBacklog() {
  scheduleSave();
  const inp = document.getElementById('inbox-input');
  const text = inp.value.trim();
  if (!text) return;
  backlog.unshift({id: nextBacklogId++, text, time:'agora'});
  inp.value = '';
  renderBacklog();
}

function handleInboxKey(e) {
  // Desktop: Enter salva. Mobile: Enter apenas quebra linha (usuário usa botão Salvar)
  if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 1024) {
    e.preventDefault();
    addToBacklogFull();
  }
}

function deleteBacklog(id) {
  lsSave();
  backlog = backlog.filter(i => i.id !== id);
  renderBacklog();
}

function removeFromBacklog(id) {
  lsSave();
  backlog = backlog.filter(i => i.id !== id);
  renderBacklog();
}

// ── Voice (Web Speech API) ──
let recognition = null;

function toggleVoice() {
  const btn = document.getElementById('voice-btn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('❌ Reconhecimento de voz não suportado. Use Chrome ou Edge.');
    return;
  }
  if (recognition) {
    recognition.stop();
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.continuous = true;       // keeps listening
  recognition.interimResults = true;   // shows partial transcription

  const interim = document.getElementById('voice-interim');
  const inp     = document.getElementById('inbox-input');
  let finalText = inp.value;

  recognition.onstart = () => {
    btn.classList.add('recording');
    btn.textContent = '⏹';
    btn.title = 'Clique para parar';
    if (interim) interim.textContent = '🎙️ Ouvindo…';
  };

  recognition.onresult = e => {
    let interimStr = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) {
        finalText += t + ' ';
        inp.value = finalText;
      } else {
        interimStr += t;
      }
    }
    if (interim) interim.textContent = interimStr ? '🎙️ ' + interimStr : '🎙️ Ouvindo…';
  };

  recognition.onerror = ev => {
    const msgs = {
      'not-allowed': '❌ Microfone negado — abra via HTTPS (GitHub Pages) ou localhost',
      'no-speech':   '⚠️ Nenhum áudio detectado',
      'network':     '❌ Erro de rede',
    };
    showToast(msgs[ev.error] || '❌ Erro: ' + ev.error);
    recognition = null;
    btn.classList.remove('recording');
    btn.innerHTML = '<span class="ico" style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></span>';
    btn.title = 'Entrada por voz';
    if (interim) interim.textContent = '';
  };

  recognition.onend = () => {
    recognition = null;
    btn.classList.remove('recording');
    btn.innerHTML = '<span class="ico" style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></span>';
    btn.title = 'Entrada por voz';
    if (interim) interim.textContent = '';
    if (inp.value.trim()) showToast('🎙️ Transcrição concluída');
  };

  recognition.start();
}

// ══════════════════════════════════════════
//  MODAL — TAREFA
// ══════════════════════════════════════════
function openTaskModal(originId, text) {
  document.getElementById('task-origin-id').value = originId || '';
  document.getElementById('task-title').value = text || '';
  document.getElementById('task-tag').value = '';
  document.getElementById('task-notes').value = '';
  document.getElementById('task-due').value = '';
  document.getElementById('task-priority').value = 'normal';
  document.getElementById('task-col').value = 'backlog';
  document.getElementById('task-progress').value = 0;
  document.getElementById('task-progress-label').textContent = '0';
  openModal('modal-task');
}

function saveTask() {
  lsSave();
  scheduleSave();
  const title = document.getElementById('task-title').value.trim();
  if (!title) { showToast('⚠️ Informe o título da tarefa'); return; }
  const originId = parseInt(document.getElementById('task-origin-id').value);
  const col      = document.getElementById('task-col').value;
  const tag      = document.getElementById('task-tag').value.trim() || 'geral';
  const due      = document.getElementById('task-due').value;
  const priority = document.getElementById('task-priority').value;
  const notes    = document.getElementById('task-notes').value.trim();
  const progress = parseInt(document.getElementById('task-progress').value) || 0;

  tasks.push({id: nextTaskId++, title, col, tag, tagColor:'violet', priority, due, notes, progress});
  if (originId) removeFromBacklog(originId);
  closeModal('modal-task');
  renderKanban();
  showToast(`✅ Tarefa adicionada em "${kanbanCols.find(c=>c.id===col)?.name}"`);
}

// ══════════════════════════════════════════
//  MODAL — EVENTO
// ══════════════════════════════════════════
function openEventModal(originId, text) {
  document.getElementById('event-origin-id').value = originId || '';
  document.getElementById('event-title').value = text || '';
  document.getElementById('event-location').value = '';
  document.getElementById('event-time').value = '';
  const today = todayLocal();
  document.getElementById('event-date').value = today;
  resetEventModal();
  openModal('modal-event');
}

function saveEvent() {
  const title = document.getElementById('event-title').value.trim();
  if (!title) { showToast('⚠️ Informe o título do evento'); return; }
  const originId = parseInt(document.getElementById('event-origin-id').value);
  const date     = document.getElementById('event-date').value;
  const time     = document.getElementById('event-time').value;
  const duration = parseInt(document.getElementById('event-duration').value);
  const location = document.getElementById('event-location').value.trim();
  const recur    = document.getElementById('event-recur').value;

  const newEv = {id: nextEventId++, title, date, time, duration, location, recur, color:'var(--violet)'};
  events.push(newEv);
  if (originId) removeFromBacklog(originId);
  closeModal('modal-event');
  lsSave();
  renderCalendar();
  showToast('📅 Evento adicionado ao calendário');
  if (gcalState.connected) gcalCreateEvent(newEv);
}

// ══════════════════════════════════════════
//  MODAL — FINANCEIRO
// ══════════════════════════════════════════
function openFinModal(originId, text) {
  var btnParc = document.getElementById('btn-fin-parcelar');
  if (btnParc) btnParc.style.display = 'none';
  window._currentEditFinId = null;
  document.getElementById('fin-origin-id').value = originId || '';
  document.getElementById('fin-desc').value = text || '';
  document.getElementById('fin-value').value = '';
  document.getElementById('fin-source').value = '';
  document.getElementById('fin-obs').value = '';
  document.getElementById('fin-type').value = 'saida';
  document.getElementById('fin-method').value = 'Débito';
  updateFinCategorySelects();
  document.getElementById('fin-category').value = 'Alimentação';
  resetFinModal();
  const today = todayLocal();
  document.getElementById('fin-date').value = today;
  syncPayMethodsFromFinances(); // garante formas dos lançamentos antes de popular
  updateFinMethodSelects();
  openModal('modal-fin');
  setTimeout(finShowRecentTags, 100);
}

function updateFinType() {
  const t = document.getElementById('fin-type').value;
  document.getElementById('fin-category').value = t === 'entrada' ? 'Renda fixa' : 'Alimentação';
  // Adapta botões de status conforme tipo
  var btnPago     = document.querySelector('.fin-status-opt[data-status="pago"]');
  var btnPendente = document.querySelector('.fin-status-opt[data-status="pendente"]');
  var btnParcela  = document.querySelector('.fin-status-opt[data-status="parcela"]');
  if (t === 'entrada') {
    if (btnPago)     btnPago.textContent     = '✅ Recebido';
    if (btnPendente) btnPendente.textContent = '⏳ A receber';
    if (btnParcela)  btnParcela.style.display = 'none';
    // Se estava em parcela, volta para pago
    var statusInp = document.getElementById('fin-status');
    if (statusInp && statusInp.value === 'parcela') finSetStatus('pago');
  } else {
    if (btnPago)     btnPago.textContent     = '✅ Pago';
    if (btnPendente) btnPendente.textContent = '⏳ Pendente';
    if (btnParcela)  btnParcela.style.display = '';
  }
}

function saveFinance() {
  const desc  = document.getElementById('fin-desc').value.trim();
  const val   = parseFloat(document.getElementById('fin-value').value);
  if (!desc)    { showToast('⚠️ Informe a descrição'); return; }
  if (!val||val<=0) { showToast('⚠️ Informe um valor válido'); return; }

  const originId = parseInt(document.getElementById('fin-origin-id').value);
  const type     = document.getElementById('fin-type').value;
  const date     = document.getElementById('fin-date').value;
  const method   = document.getElementById('fin-method').value;
  const category = document.getElementById('fin-category').value;
  const source   = document.getElementById('fin-source').value.trim();
  const obs      = document.getElementById('fin-obs').value.trim();

  // Confirma tag digitada mas não fixada (usuário pode não ter pressionado +)
  var finInp = document.getElementById('fin-tag-inp');
  if (finInp && finInp.value.trim()) { finAddTagChip(finInp.value.trim()); finInp.value = ''; }
  // Confirma tag digitada mas não fixada
  var finInp = document.getElementById('fin-tag-inp');
  if (finInp && finInp.value.trim()) { finAddTagChip(finInp.value.trim()); finInp.value = ''; }
  const tags   = finGetTags();
  const status = document.getElementById('fin-status') ? document.getElementById('fin-status').value : 'pago';
  var novoLanc = {id: nextFinId++, desc, type, value:val, date, method, category, source, obs, tags, status};
  if (type === 'saida') applyCartaoDueDate(novoLanc);
  finances.unshift(novoLanc);
  if (originId) removeFromBacklog(originId);
  closeModal('modal-fin');
  lsSave();
  renderFinance();
  showToast(`💰 Lançamento registrado — R$ ${val.toFixed(2)}`);
}

// ══════════════════════════════════════════
//  MODAL — LISTA
// ══════════════════════════════════════════
function openListPick(originId, text) {
  document.getElementById('list-origin-id').value = originId || '';
  document.getElementById('list-item-tag').value = '';
  const sel = document.getElementById('list-dest-select');
  sel.innerHTML = lists.map(l => `<option value="${l.id}">${l.icon} ${l.name}</option>`).join('');
  openModal('modal-list-pick');
}

function saveToList() {
  lsSave();
  const originId = parseInt(document.getElementById('list-origin-id').value);
  const destId   = document.getElementById('list-dest-select').value;
  const tag      = document.getElementById('list-item-tag').value.trim();
  const item     = backlog.find(i => i.id === originId);
  if (!item) { closeModal('modal-list-pick'); return; }

  const list = lists.find(l => l.id === destId);
  if (list) {
    list.items.push({id: nextListItemId++, text: item.text, tag: tag||'', done:false});
  }
  removeFromBacklog(originId);
  closeModal('modal-list-pick');
  renderLists();
  showToast(`📌 Adicionado a "${list?.name}"`);
}

// ══════════════════════════════════════════
//  MODAL HELPERS
// ══════════════════════════════════════════
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
});

// ══════════════════════════════════════════
//  KANBAN
// ══════════════════════════════════════════
function renderKanban() {
  const board = document.getElementById('kanban-board');
  board.innerHTML = kanbanCols.map(col => {
    const allColTasks = filteredTasks(); const cards = allColTasks.filter(t => t.col === col.id);
    const today = todayLocal();
    return `
      <div class="kanban-col" id="col-${col.id}"
        ondragover="e=>e.preventDefault()" ondrop="dropCard(event,'${col.id}')">
        <div class="col-header">
          <div class="col-dot" style="background:${col.dotColor}"></div>
          <span class="col-name">${col.name}</span>
          <span class="col-count">${cards.length}</span>
        </div>
        <div class="col-cards" id="cards-${col.id}"
          ondragover="onDragOver(event)" ondrop="dropCard(event,'${col.id}')">
          ${cards.map(t => {
            const dueCls = t.due && t.due < today ? 'urgent' : (t.due && t.due <= addDays(today,3) ? 'soon' : '');
            const dueLabel = t.due ? fmtDate(t.due) : 'sem prazo';
            const fillColor = col.id==='done' ? 'var(--green)' : col.id==='review' ? 'var(--amber)' : 'var(--violet)';
            return `
            <div class="k-card col-${col.id==='done'?'gray':col.id==='review'?'amber':col.id==='doing'?'blue':''}
              ${t.priority==='urgente'?'col-red':''}"
              draggable="true"
              ondragstart="dragStart(event,${t.id})"
              onclick="editTask(${t.id})"
              title="${escHtml(t.notes||t.title)}">
              <div class="k-title">${escHtml(t.title)}</div>
              ${t.tag ? `<div class="k-tags"><span class="k-tag ${t.tagColor||'violet'}">${escHtml(t.tag)}</span>${t.priority!=='normal'?`<span class="k-tag amber">${t.priority}</span>`:''}</div>` : ''}
              <div class="k-footer">
                <span class="k-due ${dueCls}">${dueCls==='urgent'?'▲ ':dueCls==='soon'?'△ ':''}${dueLabel}</span>
                <div class="k-progress">
                  <div class="k-progress-bar"><div class="k-progress-fill" style="width:${t.progress}%;background:${fillColor}"></div></div>
                  ${t.progress}%
                </div>
              </div>
              <div class="k-back-btn" onclick="event.stopPropagation();sendToBacklog('task',${t.id})" title="Devolver ao Backlog">↩ Backlog</div>
            </div>`;
          }).join('')}
          <div class="col-drop-zone" id="dz-${col.id}"></div>
        </div>
        <button class="col-add-btn" onclick="openTaskModal(null,null);document.getElementById('task-col').value='${col.id}'">+ Adicionar</button>
      </div>`;
  }).join('');
  renderGantt();
}

function dragStart(e, id) {
  dragId = id;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => e.target.classList.add('dragging'), 0);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function dropCard(e, colId) {
  e.preventDefault();
  if (dragId === null) return;
  const task = tasks.find(t => t.id === dragId);
  if (task) { task.col = colId; if (colId==='done') task.progress=100; }
  dragId = null;
  renderKanban();
  showToast(`✅ Movido para ${kanbanCols.find(c=>c.id===colId)?.name}`);
}

function editTask(id) {
  const t = tasks.find(x=>x.id===id);
  if (!t) return;
  document.getElementById('task-origin-id').value = '';
  document.getElementById('task-title').value = t.title;
  document.getElementById('task-tag').value = t.tag||'';
  document.getElementById('task-due').value = t.due||'';
  document.getElementById('task-priority').value = t.priority||'normal';
  updateTaskColSelect();
  document.getElementById('task-col').value = t.col;
  document.getElementById('task-notes').value = t.notes||'';
  document.getElementById('task-progress').value = t.progress||0;
  document.getElementById('task-progress-label').textContent = t.progress||0;
  document.querySelector('#modal-task .modal-title').textContent = 'Editar Tarefa';
  // Show delete button
  let delBtn = document.getElementById('task-delete-btn');
  if (!delBtn) {
    delBtn = document.createElement('button');
    delBtn.id = 'task-delete-btn';
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = '🗑️ Excluir';
    document.querySelector('#modal-task .modal-footer').prepend(delBtn);
  }
  delBtn.style.display = 'inline-flex';
  delBtn.onclick = () => {
    if (!confirm('Excluir esta tarefa?')) return;
    tasks = tasks.filter(x=>x.id!==id);
    closeModal('modal-task');
    resetTaskModal();
    renderKanban();
    showToast('🗑️ Tarefa excluída');
  };
  const saveBtn = document.querySelector('#modal-task .btn-primary');
  saveBtn.textContent = 'Salvar alterações';
  saveBtn.onclick = () => {
    t.title    = document.getElementById('task-title').value.trim() || t.title;
    t.tag      = document.getElementById('task-tag').value.trim();
    t.due      = document.getElementById('task-due').value;
    t.priority = document.getElementById('task-priority').value;
    t.col      = document.getElementById('task-col').value;
    t.notes    = document.getElementById('task-notes').value.trim();
    t.progress = parseInt(document.getElementById('task-progress').value) || 0;
    closeModal('modal-task');
    resetTaskModal();
    renderKanban();
    lsSave();
  showToast('✏️ Tarefa atualizada');
  };
  openModal('modal-task');
}

// ══════════════════════════════════════════
//  GANTT
// ══════════════════════════════════════════
const ganttColors = ['#7C3AED','#3B82F6','#F59E0B','#06B6D4','#10B981','#EF4444'];
let ganttScale = 'semana'; // 'dia' | 'semana' | 'mes'

function setScale(btn, scale) {
  document.querySelectorAll('.scale-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  ganttScale = scale;
  renderGantt();
}

function renderGantt() {
  const body = document.getElementById('gantt-body');
  const active = tasks.filter(t => t.due);
  if (!active.length) {
    body.innerHTML = '<p style="color:var(--text-dim);font-size:12px;padding:12px 0">Nenhuma tarefa com prazo.</p>';
    return;
  }

  const today = new Date(); today.setHours(0,0,0,0);

  // ── Window ──
  let winStart, winEnd;
  if (ganttScale === 'dia') {
    winStart = new Date(today); winStart.setDate(today.getDate() - 3);
    winEnd   = new Date(today); winEnd.setDate(today.getDate() + 11);
  } else if (ganttScale === 'semana') {
    winStart = new Date(today); winStart.setDate(today.getDate() - 7);
    winEnd   = new Date(today); winEnd.setDate(today.getDate() + 35);
  } else {
    winStart = new Date(today); winStart.setDate(1); winStart.setMonth(winStart.getMonth()-1);
    winEnd   = new Date(today); winEnd.setMonth(winEnd.getMonth()+4); winEnd.setDate(0);
  }
  const totalMs = winEnd - winStart || 1;

  // ── Helper: date → % of timeline ──
  function pct(date) {
    return Math.max(0, Math.min(100, (date - winStart) / totalMs * 100));
  }

  const todayP = pct(today);

  // ── Ticks ──
  const tickStep = ganttScale === 'dia' ? 1 : ganttScale === 'semana' ? 7 : 30;
  const ticks = [];
  let d = new Date(winStart);
  while (d <= winEnd) {
    const p = (d - winStart) / totalMs * 100;
    const label = ganttScale === 'mes'
      ? monthNames[d.getMonth()].slice(0,3)
      : d.getDate() + '/' + (d.getMonth()+1);
    ticks.push({ p: p.toFixed(2), label });
    d = new Date(d); d.setDate(d.getDate() + tickStep);
  }

  // ── Build HTML using a SINGLE grid div for both header and rows ──
  // Architecture:
  //   .gantt-outer: display:flex on each row → [name 160px fixed] [.gantt-grid flex:1]
  //   .gantt-grid is position:relative, shared reference for ALL % positions
  //   Today line and task markers both use left:X% inside .gantt-grid
  //   The header tick row is ALSO a .gantt-grid so ticks align perfectly

  const NAME_W = 160;

  // Header row
  let html = '<div style="display:flex;margin-bottom:6px;align-items:stretch">';
  html += '<div style="width:' + NAME_W + 'px;flex-shrink:0"></div>';
  html += '<div style="flex:1;position:relative;height:24px;border-bottom:1px solid var(--border-soft)" id="gantt-header-track">';
  // Ticks
  ticks.forEach(t => {
    html += '<div style="position:absolute;left:' + t.p + '%;transform:translateX(-50%);font-size:9px;color:var(--text-dim);font-family:JetBrains Mono,monospace;white-space:nowrap;top:4px">' + t.label + '</div>';
  });
  // Today marker in header
  if (todayP >= 0 && todayP <= 100) {
    html += '<div style="position:absolute;left:' + todayP.toFixed(2) + '%;top:0;bottom:0;width:2px;background:#EF4444;z-index:4">';
    html += '<div style="position:absolute;top:2px;left:4px;font-size:8px;color:#EF4444;font-family:monospace;font-weight:700;white-space:nowrap">hoje</div>';
    html += '</div>';
  }
  html += '</div></div>';

  // Task rows — all share the same track width reference
  active.forEach((t, i) => {
    const color = ganttColors[i % ganttColors.length];
    // Parse YYYY-MM-DD as local midnight (avoid UTC offset shifting the day)
    const dueParts = t.due.split('-');
    const dueDate = new Date(parseInt(dueParts[0]), parseInt(dueParts[1])-1, parseInt(dueParts[2]));
    dueDate.setHours(0,0,0,0);
    const dueP    = pct(dueDate);
    const isOverdue = dueDate < today && t.col !== 'done';
    const isDone    = t.col === 'done';
    const barColor  = isDone ? '#10B981' : isOverdue ? '#EF4444' : color;
    const progress  = t.progress || 0;
    const inView    = dueDate >= winStart && dueDate <= winEnd;
    const outLeft   = dueDate < winStart;
    const outRight  = dueDate > winEnd;

    html += '<div style="display:flex;align-items:center;margin-bottom:8px;cursor:pointer" onclick="editTask(' + t.id + ')">';
    html += '<div class="gantt-row-name" style="width:' + NAME_W + 'px;min-width:' + NAME_W + 'px;max-width:' + NAME_W + 'px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(t.title) + '">' + escHtml(t.title) + '</div>';

    // The track — same flex:1 as the header, so same rendered width
    html += '<div style="flex:1;position:relative;height:22px;background:var(--bg);border-radius:4px;overflow:visible">';

    // Today line inside track — same left% as in header
    if (todayP >= 0 && todayP <= 100) {
      html += '<div style="position:absolute;left:' + todayP.toFixed(2) + '%;top:0;bottom:0;width:2px;background:rgba(239,68,68,0.55);z-index:5;pointer-events:none"></div>';
    }

    if (inView) {
      // Progress bar: from 0 to dueP, filled by progress%
      html += '<div style="position:absolute;left:0;top:4px;height:14px;width:' + dueP.toFixed(2) + '%;background:' + barColor + '15;border-radius:3px;overflow:hidden">';
      html += '<div style="height:100%;width:' + progress + '%;background:' + barColor + '40;border-radius:3px 0 0 3px"></div>';
      html += '</div>';
      // Deadline marker: solid vertical line at exact due date
      html += '<div style="position:absolute;left:' + dueP.toFixed(2) + '%;top:0;bottom:0;width:2px;background:' + barColor + ';border-radius:1px;z-index:6"></div>';
      // Label — pinned left of marker when near left edge, right when near right edge
      var labelAlign = dueP < 15 ? 'left:' + (dueP+0.5).toFixed(2) + '%'
                     : dueP > 85 ? 'right:' + (100-dueP+0.5).toFixed(2) + '%'
                     : 'left:' + dueP.toFixed(2) + '%;transform:translateX(-50%)';
      html += '<div style="position:absolute;' + labelAlign + ';top:1px;font-size:9px;font-weight:700;color:' + barColor + ';white-space:nowrap;z-index:7">';
      html += fmtDate(t.due) + (isOverdue ? ' ⚠' : '') + (isDone ? ' ✓' : '');
      html += '</div>';
    } else {
      // Out of view
      const side = outLeft ? 'left:2px' : 'right:2px';
      const arrow = outLeft ? '◀ ' : '';
      const arrowR = outRight ? ' ▶' : '';
      html += '<div style="position:absolute;' + side + ';top:50%;transform:translateY(-50%);font-size:9px;color:var(--text-dim);white-space:nowrap">';
      html += arrow + fmtDate(t.due) + arrowR;
      html += '</div>';
    }

    html += '</div>'; // track
    html += '</div>'; // row
  });

  body.innerHTML = html;
}


// ══════════════════════════════════════════
//  CALENDÁRIO
// ══════════════════════════════════════════
const dayNames   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function renderCalendar() {
  document.getElementById('cal-month-label').textContent = `${monthNames[calMonth]} ${calYear}`;
  document.getElementById('cal-day-names').innerHTML = dayNames.map(d=>`<div class="cal-day-name">${d}</div>`).join('');

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const prevDays = new Date(calYear, calMonth, 0).getDate();
  const today = new Date();

  let cells = '';
  for (let i=firstDay-1;i>=0;i--)
    cells += `<div class="cal-cell other-month"><span class="cal-day-num">${prevDays-i}</span></div>`;

  for (let d=1;d<=daysInMonth;d++) {
    const isToday = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d;
    const key = `${calYear}-${pad(calMonth+1)}-${pad(d)}`;
    const dayEvts   = [...events.filter(e=>e.date===key), ...(gcalState.googleEvents||[]).filter(e=>e.date===key)];
    const dayTasks  = getTasksForDate(key);
    const allDots   = [
      ...dayEvts.slice(0,3).map(e=>`<div class="cal-dot" style="background:${e.color}"></div>`),
      ...dayTasks.slice(0,2).map(()=>`<div class="cal-dot" style="background:var(--amber);border:1px solid var(--amber)"></div>`)
    ];
    const dots = allDots.slice(0,5).join('');
    // Eventos inline estilo Google Calendar
    // Dia todo → chip colorido | Com horário → ponto + hora + nome
    const MAX_SHOW = 5;
    let evChips = [];
    // All-day events primeiro
    dayEvts.filter(e=>!e.time||e.duration===0).slice(0,MAX_SHOW).forEach(e=>{
      evChips.push(`<span class="cal-ev-chip" style="background:${e.color||'var(--violet)'};color:#fff">${escHtml((e.title||'').slice(0,16))}</span>`);
    });
    // Timed events com pontinho
    dayEvts.filter(e=>e.time&&e.duration!==0).slice(0,MAX_SHOW-evChips.length).forEach(e=>{
      const hm = e.time ? e.time.slice(0,5).replace(/^0/,'') : '';
      evChips.push(`<span class="cal-ev-dot-row"><span class="cal-ev-dot" style="background:${e.color||'var(--violet)'}"></span><span class="cal-ev-dot-text">${hm} ${escHtml((e.title||'').slice(0,13))}</span></span>`);
    });
    // Tarefas com prazo
    dayTasks.slice(0,MAX_SHOW-evChips.length).forEach(t=>{
      evChips.push(`<span class="cal-ev-dot-row"><span class="cal-ev-dot" style="background:var(--amber)"></span><span class="cal-ev-dot-text">${escHtml((t.title||'').slice(0,14))}</span></span>`);
    });
    const totalEv = dayEvts.length + dayTasks.length;
    const moreLabel = totalEv > MAX_SHOW ? `<span class="cal-ev-more">+${totalEv-MAX_SHOW}</span>` : '';
    const isSelected = key === selectedDateKey;
    cells += `<div class="cal-cell${isToday?' today':''}${isSelected?' selected':''}" onclick="showDayEvents('${key}');selectedDateKey='${key}'">
      <span class="cal-day-num">${d}</span>
      ${evChips.join('')}${moreLabel}
    </div>`;
  }
  document.getElementById('cal-grid').innerHTML = cells;
  var todayKey = `${calYear}-${pad(calMonth+1)}-${pad(today.getDate())}`;
  if (!selectedDateKey) selectedDateKey = todayKey;
  showDayEvents(selectedDateKey);
}

function showDayEvents(dateKey) {
  const localEvts  = events.filter(e=>e.date===dateKey);
  const gEvts      = (gcalState.googleEvents||[]).filter(e=>e.date===dateKey);
  const dayEvts    = [...localEvts, ...gEvts].sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  const dayTasks = getTasksForDate(dateKey);
  const d = new Date(dateKey+'T12:00:00');
  const label = d.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}).replace(/^\w/,s=>s.toUpperCase());
  const el = document.getElementById('event-list');
  const total = dayEvts.length + dayTasks.length;
  var dH = new Date(dateKey+'T12:00:00');
  var weekdayStr = dH.toLocaleDateString('pt-BR',{weekday:'long'});
  weekdayStr = weekdayStr.charAt(0).toUpperCase() + weekdayStr.slice(1);
  var monthStr = dH.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  el.innerHTML = `
    <div style="padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid var(--border-soft)">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-dim);margin-bottom:5px">${weekdayStr}</div>
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:28px;font-weight:800;color:var(--text);line-height:1;font-family:'JetBrains Mono',monospace">${dH.getDate()}</span>
        <span style="font-size:12px;color:var(--text-muted);line-height:1.4">${monthStr}</span>
        ${total?`<span style="margin-left:auto;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:var(--violet-glow);border:1px solid var(--violet);color:var(--violet-light)">${total} evento${total!==1?'s':''}</span>`:''}
      </div>
    </div>
    ${dayEvts.length ? dayEvts.map(function(ev) {
      var gBtns = ev.fromGoogle
        ? '<button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:10px" onclick="event.stopPropagation();editGoogleEventBtn(this)" data-gid="'+ev.googleId+'" data-title="'+escHtml(ev.title)+'" data-date="'+ev.date+'" data-time="'+ev.time+'" data-dur="'+ev.duration+'" data-loc="'+escHtml(ev.location||'')+'" title="Editar no Google">✏️</button>'
          +'<button class="btn btn-danger btn-sm" style="padding:2px 6px;font-size:10px" onclick="event.stopPropagation();gcalDeleteEventBtn(this)" data-gid="'+ev.googleId+'" title="Excluir">✕</button>'
        : '<button class="btn btn-ghost btn-sm" style="padding:2px 5px;font-size:10px" onclick="event.stopPropagation();editEvent('+ev.id+')" title="Editar">✏️</button>'
          +'<button class="btn btn-ghost btn-sm" style="padding:2px 5px;font-size:10px" onclick="event.stopPropagation();sendToBacklog(\'event\','+ev.id+')" title="↩ Backlog">↩</button>'
          +'<button class="btn btn-danger btn-sm" style="padding:2px 5px;font-size:10px" onclick="event.stopPropagation();deleteEvent('+ev.id+')" title="Excluir">✕</button>';
      var gBadge = ev.fromGoogle ? '<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:rgba(59,130,246,0.15);color:#93C5FD;border:1px solid rgba(59,130,246,0.25)">Google</span>' : '';
      var durLabel = ev.duration===0 ? 'Dia todo' : (ev.duration ? ev.duration+'min' : '');
      var locLabel = ev.location ? ' · '+escHtml(ev.location) : '';
      return '<div class="event-item" style="position:relative;gap:8px">'
        +'<div class="event-time-col">'
          +'<span class="event-time">'+(ev.duration===0?'—':(ev.time||'—'))+'</span>'
          +'<div class="event-bar" style="background:'+ev.color+'"></div>'
        +'</div>'
        +'<div style="flex:1;min-width:0">'
          +'<div class="event-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(ev.title)+'</div>'
          +'<div class="event-detail">'+gBadge+' '+durLabel+locLabel+'</div>'
        +'</div>'
        +'<div style="display:flex;gap:3px;flex-shrink:0">'+gBtns+'</div>'
        +'</div>';
    }).join('') : ''}
    ${dayTasks.length ? `
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--amber);padding:8px 0 4px">📋 Prazos de tarefas</div>
      ${dayTasks.map(t=>`
        <div class="event-item" onclick="editTask(${t.id});switchView('kanban',document.querySelector('.sidebar .nav-btn:nth-child(2)'))" style="cursor:pointer">
          <div class="event-time-col">
            <span class="event-time">prazo</span>
            <div class="event-bar" style="background:var(--amber)"></div>
          </div>
          <div>
            <div class="event-name">${escHtml(t.title)}</div>
            <div class="event-detail">${escHtml(t.tag||'')} · ${escHtml(kanbanCols.find(c=>c.id===t.col)?.name||t.col)} · ${t.priority}</div>
          </div>
        </div>`).join('')}` : ''}
    ${!dayEvts.length && !dayTasks.length ? '<p style="color:var(--text-dim);font-size:12px;padding:8px 0">Nenhum evento ou prazo neste dia.</p>' : ''}
    <button class="btn btn-ghost btn-sm" style="margin-top:10px;width:100%" onclick="openEventModal(null,null);document.getElementById('event-date').value='${dateKey}'">+ Novo evento neste dia</button>`;
}

function changeMonth(dir) {
  calMonth += dir;
  if (calMonth>11){calMonth=0;calYear++;}
  if (calMonth<0){calMonth=11;calYear--;}
  renderCalendar();
  if (gcalState.connected) gcalFetchEvents();
}

function editGoogleEventBtn(btn) {
  editGoogleEvent(btn.dataset.gid, btn.dataset.title, btn.dataset.date, btn.dataset.time, parseInt(btn.dataset.dur)||0, btn.dataset.loc||'');
}
function gcalDeleteEventBtn(btn) {
  gcalDeleteEvent(btn.dataset.gid);
}

function editGoogleEvent(googleId, title, date, time, duration, location) {
  document.getElementById('event-origin-id').value = '';
  document.getElementById('event-title').value = title;
  document.getElementById('event-date').value = date;
  document.getElementById('event-time').value = time||'';
  document.getElementById('event-duration').value = duration||60;
  document.getElementById('event-location').value = location||'';
  document.getElementById('event-recur').value = 'nunca';
  document.querySelector('#modal-event .modal-title').textContent = 'Editar Evento (Google)';
  const saveBtn = document.querySelector('#modal-event .btn-primary');
  saveBtn.textContent = 'Salvar no Google';
  saveBtn.onclick = () => {
    const updData = {
      title:    document.getElementById('event-title').value.trim(),
      date:     document.getElementById('event-date').value,
      time:     document.getElementById('event-time').value,
      duration: parseInt(document.getElementById('event-duration').value),
      location: document.getElementById('event-location').value.trim(),
    };
    if (!updData.title) { showToast('⚠️ Informe o título'); return; }
    closeModal('modal-event');
    resetEventModal();
    gcalUpdateEvent(googleId, updData);
  };
  openModal('modal-event');
}

// ══════════════════════════════════════════
//  FINANCEIRO
// ══════════════════════════════════════════
function renderFinCalendar() {
  var el = document.getElementById('fin-calendar');
  if (!el) return;
  var m = finCalMonth, y = finCalYear;
  var today = new Date();
  var todayKey = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  var firstDay = new Date(y, m, 1).getDay(); // 0=Sun
  var daysInMonth = new Date(y, m+1, 0).getDate();
  var monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var wdays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  var prefix = y + '-' + String(m+1).padStart(2,'0') + '-';

  // Build daily totals
  var dayTotals = {};
  finances.forEach(function(f) {
    if (!f.date || !f.date.startsWith(y + '-' + String(m+1).padStart(2,'0'))) return;
    var d = parseInt(f.date.split('-')[2]);
    if (!dayTotals[d]) dayTotals[d] = {entradas:0, saidas:0};
    if (f.type === 'entrada') dayTotals[d].entradas += f.value;
    else dayTotals[d].saidas += f.value;
  });

  // Month totals
  var monthEntradas = 0, monthSaidas = 0;
  Object.values(dayTotals).forEach(function(dt) { monthEntradas += dt.entradas; monthSaidas += dt.saidas; });

  var html = '<div class="fin-cal-header">';
  html += '<div style="display:flex;align-items:center;gap:8px">';
  html += '<button class="btn btn-ghost btn-sm" style="padding:2px 8px" onclick="finCalNav(-1)">‹</button>';
  html += '<span class="fin-cal-title">' + monthNames[m] + ' ' + y + '</span>';
  html += '<button class="btn btn-ghost btn-sm" style="padding:2px 8px" onclick="finCalNav(1)">›</button>';
  html += '<button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:10px;color:var(--text-dim)" onclick="finCalNav(0)">Hoje</button>';
  html += '</div></div>';

  html += '<div class="fin-cal-grid">';
  wdays.forEach(function(w) { html += '<div class="fin-cal-wday">' + w + '</div>'; });

  // Empty cells before first day
  for (var i = 0; i < firstDay; i++) html += '<div class="fin-cal-cell empty"></div>';

  // Day cells
  var acumulado = 0;
  for (var d = 1; d <= daysInMonth; d++) {
    var key = prefix + String(d).padStart(2,'0');
    var isToday = key === todayKey;
    var dt = dayTotals[d];
    var dayNet = dt ? (dt.entradas - dt.saidas) : 0;
    acumulado += dayNet;

    var isFiltered = activeFilters.finDate === key;
    html += '<div class="fin-cal-cell' + (isToday ? ' today' : '') + (isFiltered ? ' selected' : '') + '" onclick="filterFinDay(\'' + key + '\')" title="Clique para filtrar / Acumulado: ' + fmtMoney(acumulado) + '">';
    html += '<div class="fin-cal-day">' + d + '</div>';
    if (dt) {
      if (dt.saidas > 0) html += '<div class="fin-cal-val neg">-' + fmtMoney(dt.saidas) + '</div>';
      if (dt.entradas > 0) html += '<div class="fin-cal-val pos">+' + fmtMoney(dt.entradas) + '</div>';
    }
    // Ícone 🔔 se há lembrete ativo neste dia (lançamentos ou faturas de cartão)
    var temLembrete = finances.some(function(f) {
      if (!f.lembrete || f.status === 'pago') return false;
      var ref = f.due_date || f.date || '';
      return ref === key;
    });
    // Adiciona lembrete de fatura de cartão com valor
    var faturaInfo = null;
    cartoesCredito.forEach(function(cc) {
      if (!cc.lembrete) return;
      // Calcula o vencimento da fatura atual do cartão (baseado em hoje)
      var due = calcDueDate(todayLocal(), cc);
      if (due !== key) return;
      temLembrete = true;
      // Calcula o ciclo desta fatura
      var keyD = new Date(key+'T12:00:00');
      var diaKey = keyD.getDate();
      // Início do ciclo = dia após fechamento do mês anterior
      var cicloFimD = new Date(keyD.getFullYear(), keyD.getMonth(), cc.fecha);
      var cicloIniD = new Date(cicloFimD.getFullYear(), cicloFimD.getMonth()-1, cc.fecha+1);
      var cicloIni = cicloIniD.getFullYear()+'-'+String(cicloIniD.getMonth()+1).padStart(2,'0')+'-'+String(cicloIniD.getDate()).padStart(2,'0');
      var cicloFim = cicloFimD.getFullYear()+'-'+String(cicloFimD.getMonth()+1).padStart(2,'0')+'-'+String(cicloFimD.getDate()).padStart(2,'0');
      var totalFatura = finances.filter(function(f){
        return f.type==='saida' && f.method===cc.nome && f.date>=cicloIni && f.date<=cicloFim;
      }).reduce(function(s,f){ return s+f.value; }, 0);
      faturaInfo = {nome: cc.nome, total: totalFatura};
    });
    if (temLembrete) {
      var hoje = todayLocal();
      var diff = Math.round((new Date(key+'T12:00:00') - new Date(hoje+'T12:00:00')) / 86400000);
      var opacity = diff <= 0 ? '1' : diff <= 2 ? '0.7' : '0.45';
      if (faturaInfo && faturaInfo.total > 0) {
        html += '<div class="cal-bell" style="opacity:'+opacity+';font-size:8px;line-height:1.3;text-align:center">🔔<br><span style="font-size:7px;color:var(--amber)">'+fmtMoney(faturaInfo.total)+'</span></div>';
      } else {
        html += '<div class="cal-bell" style="opacity:'+opacity+';font-size:9px">🔔</div>';
      }
    }
    html += '</div>';
  }
  html += '</div>';

  // Footer
  var saldoMes = monthEntradas - monthSaidas;
  html += '<div class="fin-cal-footer">';
  html += '<div class="fin-cal-stat"><div class="fin-cal-stat-label">Entradas no mês</div><div class="fin-cal-stat-val" style="color:var(--green)">+' + fmtMoney(monthEntradas) + '</div></div>';
  html += '<div class="fin-cal-stat"><div class="fin-cal-stat-label">Saídas no mês</div><div class="fin-cal-stat-val" style="color:var(--red)">-' + fmtMoney(monthSaidas) + '</div></div>';
  html += '<div class="fin-cal-stat"><div class="fin-cal-stat-label">Saldo do mês</div><div class="fin-cal-stat-val" style="color:' + (saldoMes >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (saldoMes>=0?'+':'') + fmtMoney(saldoMes) + '</div></div>';
  html += '</div>';

  el.innerHTML = html;
}

function finCalNav(dir) {
  if (dir === 0) {
    finCalMonth = new Date().getMonth();
    finCalYear = new Date().getFullYear();
  } else {
    finCalMonth += dir;
    if (finCalMonth < 0) { finCalMonth = 11; finCalYear--; }
    if (finCalMonth > 11) { finCalMonth = 0; finCalYear++; }
  }
  renderFinCalendar();
  renderFinCards();
  renderFinSaude();
  renderIndicadores();
  renderFinCatChart();
  renderFinMethodChart();
  renderFinStatusChart();
  renderFinList();
}

function renderFinList() {
  var el = document.getElementById('fin-tx-list');
  if (!el) return;
  var filtFin = filteredFinances();
  el.innerHTML = filtFin.length
    ? filtFin.map(f=>`
      <tr class="${f.status==='pendente'?'tx-pendente':f.status==='parcela'?'tx-parcela':''}" onclick="editFinance(${f.id})">
        <td class="col-desc">
          <div class="tx-nome">${escHtml(f.desc)}</div>
          <div class="tx-sub">
            <span>${escHtml(f.category||'')}${f.source?' · '+escHtml(f.source):''}</span>
            ${f.tags&&f.tags.length?f.tags.map(t=>'<span class="tag-chip">'+escHtml(t)+'</span>').join(''):''}
          </div>
        </td>
        <td class="col-data">${f.date?fmtDate(f.date):'—'}</td>
        <td class="col-forma">${escHtml(f.method||'—')}</td>
        <td class="col-status" onclick="event.stopPropagation()">
          ${f.type==='entrada'
            ?`<div class="status-selector">
              <button class="status-opt ${f.status!=='pendente'?'active-pago':''}" onclick="finSetStatusInline(${f.id},'pago')">✅ Recebido</button>
              <button class="status-opt ${f.status==='pendente'?'active-pendente':''}" onclick="finSetStatusInline(${f.id},'pendente')">⏳ A receber</button>
            </div>`
            :`<div class="status-selector">
              <button class="status-opt ${(!f.status||f.status==='pago')?'active-pago':''}" onclick="finSetStatusInline(${f.id},'pago')">✅ Pago</button>
              <button class="status-opt ${f.status==='pendente'?'active-pendente':''}" onclick="finSetStatusInline(${f.id},'pendente')">⏳ Pendente</button>
              <button class="status-opt ${f.status==='parcela'?'active-parcela':''}" onclick="finSetStatusInline(${f.id},'parcela')">📋 Parcela</button>
            </div>
            ${f.due_date?`<div class="venc-badge${(new Date(f.due_date+'T12:00:00')-new Date())<=3*86400000?' urgente':''}">
              ${(new Date(f.due_date+'T12:00:00')-new Date())<=3*86400000?'⚠️':'📅'} vence ${new Date(f.due_date+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}
            </div>`:''}`}
        </td>
        <td class="col-valor ${f.type==='entrada'?'pos':'neg'}">${f.type==='entrada'?'+':'-'}${fmtMoney(f.value)}</td>
        <td class="col-acts" onclick="event.stopPropagation()">
          <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end">
            ${(f.status==='pendente'||f.status==='parcela')?`<button class="btn-lembrete${f.lembrete?' ativo':''}" onclick="toggleLembrete(${f.id})" title="${f.lembrete?'Lembrete ativo':'Ativar lembrete'}">🔔</button>`:''}
            <button class="fin-acts-btn" onclick="finToggleOpts(${f.id},event)" title="Opções" aria-label="Opções">⋮</button>
          </div>
          <div class="fin-acts-menu" id="fin-opts-${f.id}">
            <button class="btn-act" onclick="finToBacklog(${f.id})" title="Backlog">↩</button>
            <button class="btn-act" onclick="duplicateFinance(${f.id})" title="Duplicar" style="color:var(--cyan)">⎘</button>
            <button class="btn-act btn-del" onclick="deleteFinance(${f.id})">✕</button>
          </div>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--dim);font-size:12px">Nenhum lançamento neste mês.</td></tr>';
}

function renderFinance() {
  // Filtra pelo mês do calendário
  const mesFin = finances.filter(f => f.date && f.date.startsWith(
    finCalYear + '-' + String(finCalMonth+1).padStart(2,'0')
  ));
  const entradas = mesFin.filter(f=>f.type==='entrada');
  const saidas   = mesFin.filter(f=>f.type==='saida');
  const totalE = entradas.reduce((s,f)=>s+f.value,0);
  const totalS = saidas.reduce((s,f)=>s+f.value,0);
  const saldo  = totalE - totalS;

  // Saldo pago (só lançamentos com status pago)
  const entradasPagas = entradas.filter(f=>!f.status||f.status==='pago');
  const saidasPagas   = saidas.filter(f=>!f.status||f.status==='pago');
  const totalEP = entradasPagas.reduce((s,f)=>s+f.value,0);
  const totalSP = saidasPagas.reduce((s,f)=>s+f.value,0);
  const saldoPago = totalEP - totalSP;
  renderFinCards();

  document.getElementById('fin-entrada').textContent = fmtMoney(totalE);
  document.getElementById('fin-saida').textContent   = fmtMoney(totalS);
  document.getElementById('fin-entrada-delta').textContent = `${entradas.length} lançamento${entradas.length!==1?'s':''}`;
  document.getElementById('fin-saida-delta').textContent   = `${saidas.length} lançamento${saidas.length!==1?'s':''}`;

  // Transactions
    renderFinList();

  renderFinCalendar();
  renderFinCatPanel();

  renderAllCharts();
  renderIndicadores();
  renderCompromissos();
  renderTimeline();
}

// ══════════════════════════════════════════
//  LISTAS
// ══════════════════════════════════════════
function renderLists() {
  document.getElementById('lists-grid').innerHTML = lists.map(list=>`
    <div class="list-card">
      <div class="list-head">
        <div class="list-icon" style="background:${list.iconBg};color:${list.iconColor}">${list.icon}</div>
        <span class="list-name">${list.name}</span>
        <span class="list-count">${list.items.filter(i=>!i.done).length}/${list.items.length}</span>
        <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px;opacity:0.6" onclick="openTagsModal('${list.id}')" title="Gerenciar tags">🏷️</button>
      </div>
      <div class="list-items">
        ${(()=>{
          const pending = filteredListItems(list).filter(i=>!i.done);
          const done    = filteredListItems(list).filter(i=>i.done);
          const renderItem = (item) => `
          <div class="list-item${item.done?' done':''}" id="li-wrap-${list.id}-${item.id}">
            <div class="check-box" onclick="event.stopPropagation();toggleListItem('${list.id}',${item.id})">${item.done?'✓':''}</div>
            <span class="list-item-text" onclick="event.stopPropagation();toggleListItem('${list.id}',${item.id})" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${escHtml(item.text)}</span>
            ${item.tag?`<span class="list-item-tag" onclick="event.stopPropagation();editListItem('${list.id}',${item.id})" style="cursor:pointer" title="Editar">${escHtml(item.tag)}</span>`:''}
            <button class="list-item-opts-btn" onclick="event.stopPropagation();toggleListItemOpts('${list.id}',${item.id})" title="Opções" aria-label="Opções">⋮</button>
          </div>
          <div class="list-item-actions" id="li-opts-${list.id}-${item.id}">
            <button class="btn btn-ghost btn-sm" onclick="moveListItem('${list.id}',${item.id},-1)" title="Subir">▲ Subir</button>
            <button class="btn btn-ghost btn-sm" onclick="moveListItem('${list.id}',${item.id},1)" title="Descer">▼ Descer</button>
            <button class="btn btn-ghost btn-sm" onclick="editListItem('${list.id}',${item.id})">✏️ Editar</button>
            <button class="btn btn-ghost btn-sm" onclick="sendToBacklog('list-item',{listId:'${list.id}',itemId:${item.id}})">↩ Backlog</button>
            <button class="btn btn-danger btn-sm" onclick="deleteListItem('${list.id}',${item.id})">✕ Excluir</button>
          </div>`;
          const html = pending.map(renderItem).join('');
          const doneHtml = done.length
            ? `<div class="list-done-divider">✓ Concluídos (${done.length})</div>` + done.map(renderItem).join('')
            : '';
          return html + doneHtml;
        })()}
      </div>
      <div class="list-footer">
        <input class="list-add-input" id="add-inp-${list.id}" placeholder="Adicionar item…"
          onkeydown="addListItem(event,'${list.id}',this)">
        <button class="list-add-btn" onclick="addListItemBtn('${list.id}')" title="Adicionar">➕</button>
      </div>
    </div>`).join('');
}

function toggleListItem(listId, itemId) {
  lsSave();
  const list = lists.find(l=>l.id===listId);
  if (!list) return;
  const item = list.items.find(i=>i.id===itemId);
  if (item) item.done = !item.done;
  renderLists();
}

function addListItem(e, listId, inp) {
  if (e.key !== 'Enter') return;
  const text = inp.value.trim();
  if (!text) return;
  const list = lists.find(l=>l.id===listId);
  if (list) list.items.push({id:nextListItemId++, text, tag:'', done:false});
  lsSave();
  renderLists();
}

// ══════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(()=>t.remove(),350); }, 2200);
}


// ══════════════════════════════════════════
//  TAGS SYSTEM
// ══════════════════════════════════════════
let inboxPendingTags = [];
let inboxPriority = 'normal';
const tagColors = ['violet','amber','green','cyan','blue','red'];
let tagColorIdx = 0;

// Global tag registry — id:label:color
let globalTags = [];

function getAllUsedTags() {
  const used = new Set();
  tasks.forEach(t => { if(t.tag) used.add(t.tag); });
  backlog.forEach(i => { if(i.tags) i.tags.forEach(tg=>used.add(tg)); });
  globalTags.forEach(t => used.add(t.label));
  return [...used];
}

function getTagColor(label) {
  const found = globalTags.find(t=>t.label===label);
  return found ? found.color : 'violet';
}

function ensureTag(label) {
  if (!globalTags.find(t=>t.label===label)) {
    globalTags.push({label, color: tagColors[tagColorIdx++ % tagColors.length]});
  }
}

function toggleTagInput() {
  const wrap = document.getElementById('tag-autocomplete');
  if (wrap.style.display !== 'none') { wrap.style.display = 'none'; return; }
  renderTagAutocomplete('');
  wrap.style.display = 'block';
  setTimeout(()=>document.addEventListener('click', closeTagAC, {once:true}), 10);
}

function closeTagAC() {
  const el = document.getElementById('tag-autocomplete');
  if(el) el.style.display = 'none';
}

function renderTagAutocomplete(q) {
  const all = getAllUsedTags().filter(t => !q || t.toLowerCase().includes(q.toLowerCase()));
  const ac = document.getElementById('tag-autocomplete');
  if (!ac) return;
  ac.innerHTML = `
    <div style="display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid var(--border-soft);flex-wrap:wrap">
      ${inboxPendingTags.map(tg=>`
        <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:20px;background:var(--violet-glow);border:1px solid var(--violet);font-size:11px;color:var(--violet-light)">
          #${tg} <button onclick="removeInboxTag('${tg}')" style="background:none;border:none;color:inherit;cursor:pointer;font-size:11px">×</button>
        </span>`).join('')}
      ${!inboxPendingTags.length ? '<span style="font-size:11px;color:var(--text-dim)">Nenhuma tag</span>' : ''}
    </div>
    <input id="tag-search-inp" class="form-input" style="border:none;border-bottom:1px solid var(--border-soft);border-radius:0;font-size:12px;padding:8px 12px"
      placeholder="Buscar ou criar tag…" value="${q}"
      oninput="renderTagAutocomplete(this.value)" onkeydown="tagInputKey(event)">
    ${all.slice(0,8).map(tg=>`
      <div class="tag-ac-item" onclick="addInboxTag('${tg}')">
        <div class="tag-color" style="background:var(--${getTagColor(tg)})"></div>
        #${tg}
      </div>`).join('')}
    ${q && !all.find(t=>t===q) ? `
      <div class="tag-ac-item" onclick="addInboxTag('${q}')" style="color:var(--violet-light)">
        + Criar tag "#${q}"
      </div>` : ''}`;
  const inp = document.getElementById('tag-search-inp');
  if (inp) inp.focus();
}

function addInboxTag(label) {
  if (!inboxPendingTags.includes(label)) {
    inboxPendingTags.push(label);
    ensureTag(label);
  }
  renderTagAutocomplete('');
}

function removeInboxTag(label) {
  inboxPendingTags = inboxPendingTags.filter(t=>t!==label);
  renderTagAutocomplete('');
}

function tagInputKey(e) {
  if (e.key === 'Enter') {
    const val = e.target.value.trim();
    if (val) { addInboxTag(val); e.target.value = ''; renderTagAutocomplete(''); }
    e.preventDefault();
  }
  if (e.key === 'Escape') closeTagAC();
}

function cyclePriority() {
  const opts = ['normal','alta','urgente'];
  const idx = opts.indexOf(inboxPriority);
  inboxPriority = opts[(idx+1) % opts.length];
  const labels = {normal:'', alta:'🔺 Alta', urgente:'🔴 Urgente'};
  const btn = document.getElementById('priority-btn');
  const lbl = document.getElementById('inbox-priority-label');
  if (btn) btn.style.color = inboxPriority==='urgente'?'var(--red)':inboxPriority==='alta'?'var(--amber)':'';
  if (lbl) lbl.textContent = labels[inboxPriority];
}

// ── Override addToBacklog to include tags/priority ──
let inboxPendingPhoto = null;

function inboxLoadPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = async function() {
      // Comprime via canvas
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      else if (h > MAX)     { w = Math.round(w * MAX / h); h = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const base64 = canvas.toDataURL('image/jpeg', 0.75);

      // Exibe preview imediato com base64
      const preview = document.getElementById('inbox-photo-preview');
      if (preview) {
        preview.style.display = 'block';
        preview.style.position = 'relative';
        preview.innerHTML =
          '<img id="inbox-preview-img" src="' + base64 + '" style="max-height:120px;max-width:100%;border-radius:8px;border:1px solid var(--border);display:block">' +
          '<div id="inbox-upload-badge" style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.65);color:#fff;font-size:10px;padding:2px 7px;border-radius:20px;display:none">☁️ Enviando…</div>' +
          '<button onclick="inboxClearPhoto()" style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.75);border:none;color:#fff;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">✕</button>';
      }
      const photoBtn = document.getElementById('inbox-photo-btn');
      if (photoBtn) photoBtn.style.color = 'var(--violet-light)';

      // Guarda base64 como fallback imediato
      inboxPendingPhoto = base64;

      // Tenta upload para Storage
      var badge = document.getElementById('inbox-upload-badge');
      if (badge) badge.style.display = 'block';
      showToast('📷 Foto carregada — enviando para nuvem…');

      var url = await uploadImageToStorage(base64, 'backlog_images');
      if (url) {
        inboxPendingPhoto = url; // substitui base64 pela URL da nuvem
        if (badge) badge.style.display = 'none';
        var prevImg = document.getElementById('inbox-preview-img');
        if (prevImg) prevImg.src = url;
        showToast('✅ Foto enviada para a nuvem!');
      } else {
        if (badge) { badge.textContent = '📱 Local'; badge.style.display = 'block'; }
        const kb = Math.round(base64.length * 0.75 / 1024);
        showToast('📷 Foto local (' + kb + 'KB) — configure Firebase Storage para sincronizar');
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function inboxClearPhoto() {
  inboxPendingPhoto = null;
  const preview = document.getElementById('inbox-photo-preview');
  if (preview) preview.style.display = 'none';
  const photoBtn = document.getElementById('inbox-photo-btn');
  if (photoBtn) photoBtn.style.color = '';
}

function addToBacklogFull() {
  const inp = document.getElementById('inbox-input');
  const text = inp.value.trim();
  if (!text && !inboxPendingPhoto) return;
  const item = {
    id: nextBacklogId++,
    text: text || '📷 Foto',
    time: 'agora',
    tags: [...inboxPendingTags],
    priority: inboxPriority,
    photo: inboxPendingPhoto || null,
  };
  backlog.unshift(item);
  inp.value = '';
  inboxPendingTags = [];
  inboxPriority = 'normal';
  inboxPendingPhoto = null;
  const preview = document.getElementById('inbox-photo-preview');
  if (preview) preview.style.display = 'none';
  const btn = document.getElementById('priority-btn');
  const lbl = document.getElementById('inbox-priority-label');
  const photoBtn = document.getElementById('inbox-photo-btn');
  if (btn) btn.style.color = '';
  if (lbl) lbl.textContent = '';
  if (photoBtn) photoBtn.style.color = '';
  closeTagAC();
  lsSave();
  scheduleSave();
  renderBacklog();
}

// ══════════════════════════════════════════
//  SEARCH
// ══════════════════════════════════════════
let searchOpen = false;

function toggleSearch() {
  searchOpen ? closeSearch() : openSearch();
}

function openSearch() {
  searchOpen = true;
  const overlay = document.getElementById('search-overlay');
  const box     = document.getElementById('search-box');
  overlay.classList.add('open');
  box.style.display = 'block';
  setTimeout(()=>{ const inp=document.getElementById('search-input'); if(inp){inp.focus();inp.value='';} doSearch(''); }, 50);
}

function closeSearch() {
  searchOpen = false;
  document.getElementById('search-overlay').classList.remove('open');
  document.getElementById('search-box').style.display = 'none';
}

function searchKeydown(e) {
  if (e.key === 'Escape') closeSearch();
}

// Keyboard shortcut: / to open search
document.addEventListener('keydown', e => {
  if (e.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
    e.preventDefault(); openSearch();
  }
  if (e.key === 'Escape' && searchOpen) closeSearch();
});

function highlight(text, q) {
  if (!q) return escHtml(text);
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
  return escHtml(text).replace(re, '<span class="hl">$1</span>');
}

function doSearch(q) {
  const res = document.getElementById('search-results');
  if (!q || q.length < 2) { res.style.display = 'none'; return; }
  const ql = q.toLowerCase();
  let html = '';
  let total = 0;

  // Backlog
  const bRes = backlog.filter(i=>i.text.toLowerCase().includes(ql));
  if (bRes.length) {
    html += `<div class="search-section-label">⚡ Backlog</div>`;
    html += bRes.slice(0,5).map(i=>`
      <div class="search-result-item" onclick="closeSearch();switchView('inbox',document.querySelector('.sidebar .nav-btn'))">
        <span class="search-result-icon">⚡</span>
        <span class="search-result-text">${highlight(i.text,q)}</span>
        <span class="search-result-meta">${i.time}</span>
      </div>`).join('');
    total += bRes.length;
  }

  // Tasks
  const tRes = tasks.filter(t=>t.title.toLowerCase().includes(ql)||(t.tag||'').toLowerCase().includes(ql)||(t.notes||'').toLowerCase().includes(ql));
  if (tRes.length) {
    html += `<div class="search-section-label">📋 Tarefas</div>`;
    html += tRes.slice(0,5).map(t=>`
      <div class="search-result-item" onclick="closeSearch();switchView('kanban',document.querySelectorAll('.sidebar .nav-btn')[1]);editTask(${t.id})">
        <span class="search-result-icon">📋</span>
        <span class="search-result-text">${highlight(t.title,q)}</span>
        <span class="search-result-meta">${t.tag||''} · ${kanbanCols.find(c=>c.id===t.col)?.name||''}</span>
      </div>`).join('');
    total += tRes.length;
  }

  // Events
  const eRes = events.filter(e=>e.title.toLowerCase().includes(ql)||(e.location||'').toLowerCase().includes(ql));
  if (eRes.length) {
    html += `<div class="search-section-label">📅 Eventos</div>`;
    html += eRes.slice(0,5).map(e=>`
      <div class="search-result-item" onclick="closeSearch();switchView('calendar',document.querySelectorAll('.sidebar .nav-btn')[2]);showDayEvents('${e.date}')">
        <span class="search-result-icon">📅</span>
        <span class="search-result-text">${highlight(e.title,q)}</span>
        <span class="search-result-meta">${fmtDate(e.date)} ${e.time||''}</span>
      </div>`).join('');
    total += eRes.length;
  }

  // Finance
  const fRes = finances.filter(f=>f.desc.toLowerCase().includes(ql)||f.category.toLowerCase().includes(ql)||(f.source||'').toLowerCase().includes(ql));
  if (fRes.length) {
    html += `<div class="search-section-label">💰 Financeiro</div>`;
    html += fRes.slice(0,5).map(f=>`
      <div class="search-result-item" onclick="closeSearch();switchView('finance',document.querySelectorAll('.sidebar .nav-btn')[3]);editFinance(${f.id})">
        <span class="search-result-icon">💰</span>
        <span class="search-result-text">${highlight(f.desc,q)}</span>
        <span class="search-result-meta">${f.type==='entrada'?'+':'-'}${fmtMoney(f.value)}</span>
      </div>`).join('');
    total += fRes.length;
  }

  // Lists
  lists.forEach(list => {
    const iRes = list.items.filter(i=>i.text.toLowerCase().includes(ql)||(i.tag||'').toLowerCase().includes(ql));
    if (iRes.length) {
      html += `<div class="search-section-label">${list.icon} ${list.name}</div>`;
      html += iRes.slice(0,4).map(i=>`
        <div class="search-result-item" onclick="closeSearch();switchView('lists',document.querySelectorAll('.sidebar .nav-btn')[4])">
          <span class="search-result-icon">${list.icon}</span>
          <span class="search-result-text">${highlight(i.text,q)}</span>
          <span class="search-result-meta">${i.tag||''}</span>
        </div>`).join('');
      total += iRes.length;
    }
  });

  // Notes
  const nRes = notes.filter(n=>
    n.title.toLowerCase().includes(ql) ||
    n.body.toLowerCase().includes(ql) ||
    (n.tags||[]).some(t=>t.toLowerCase().includes(ql)) ||
    (n.checklist||[]).some(i=>i.text.toLowerCase().includes(ql))
  );
  if (nRes.length) {
    html += `<div class="search-section-label">📝 Notas</div>`;
    html += nRes.slice(0,5).map(n=>`
      <div class="search-result-item" onclick="closeSearch();switchView('notes',document.querySelectorAll('.sidebar .nav-btn')[5]);openNoteModal(${n.id})">
        <span class="search-result-icon">📝</span>
        <span class="search-result-text">${highlight(n.title||'(sem título)',q)}</span>
        <span class="search-result-meta">${(n.tags||[]).map(t=>'#'+t).join(' ')}</span>
      </div>`).join('');
    total += nRes.length;
  }

  if (!total) {
    html = `<div class="search-empty">Nenhum resultado para "<strong>${escHtml(q)}</strong>"</div>`;
  }

  res.innerHTML = html;
  res.style.display = 'block';
}

// ══════════════════════════════════════════
//  FILTER PANEL
// ══════════════════════════════════════════
let activeFilters = {};  // { type, value }[]
let filterPanelOpen = false;

function toggleFilterPanel() {
  filterPanelOpen = !filterPanelOpen;
  const panel = document.getElementById('filter-panel');
  const btn   = document.getElementById('filter-toggle-btn');
  panel.classList.toggle('open', filterPanelOpen);
  btn.classList.toggle('active', filterPanelOpen);
  if (filterPanelOpen) buildFilterPanel();
}

function buildFilterPanel() {
  const panel = document.getElementById('filter-panel');
  const view  = currentView;
  let html = '';

  if (view === 'inbox' || view === 'kanban') {
    // Tags
    const tags = [...new Set(tasks.map(t=>t.tag).filter(Boolean).concat(backlog.flatMap(i=>i.tags||[])))];
    if (tags.length) {
      html += `<span style="font-size:10px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">Tag:</span>`;
      html += tags.map(tg=>`<button class="filter-chip ${activeFilters.tag===tg?'active':''}" onclick="setFilter('tag','${tg}')">#${tg}</button>`).join('');
      html += `<div class="filter-separator"></div>`;
    }
    // Priority
    html += `<span style="font-size:10px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">Prioridade:</span>`;
    ['urgente','alta','normal'].forEach(p=>{
      html += `<button class="filter-chip ${activeFilters.priority===p?'active':''}" onclick="setFilter('priority','${p}')">${p}</button>`;
    });
    if (view === 'kanban') {
      html += `<div class="filter-separator"></div>`;
      html += `<span style="font-size:10px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">Coluna:</span>`;
      kanbanCols.forEach(c=>{
        html += `<button class="filter-chip ${activeFilters.col===c.id?'active':''}" onclick="setFilter('col','${c.id}')">${c.name}</button>`;
      });
    }
  }

  if (view === 'finance') {
    html += `<span style="font-size:10px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">Tipo:</span>`;
    html += `<button class="filter-chip ${activeFilters.finType==='entrada'?'active':''}" onclick="setFilter('finType','entrada')">Entradas</button>`;
    html += `<button class="filter-chip ${activeFilters.finType==='saida'?'active':''}" onclick="setFilter('finType','saida')">Saídas</button>`;
    html += `<div class="filter-separator"></div>`;
    const cats = [...new Set(finances.map(f=>f.category).filter(Boolean))];
    html += `<span style="font-size:10px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">Categoria:</span>`;
    cats.forEach(cat=>{
      html += `<button class="filter-chip ${activeFilters.finCat===cat?'active':''}" onclick="setFilter('finCat','${cat}')">${cat}</button>`;
    });
    html += `<div class="filter-separator"></div>`;
    const methods = [...new Set(finances.map(f=>f.method).filter(Boolean))];
    if (methods.length) {
      html += `<span style="font-size:10px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">Forma:</span>`;
      methods.forEach(m=>{
        html += `<button class="filter-chip ${activeFilters.finMethod===m?'active':''}" onclick="setFilter('finMethod','${m}')">${m}</button>`;
      });
    }
    if (activeFilters.finDate) {
      html += `<div class="filter-separator"></div>`;
      var dp = activeFilters.finDate.split('-');
      html += `<span style="font-size:10px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">Dia:</span>`;
      html += `<button class="filter-chip active" onclick="setFilter('finDate','${activeFilters.finDate}')">${dp[2]}/${dp[1]}/${dp[0]}</button>`;
    }
  }

  if (view === 'lists') {
    const tags = [...new Set(lists.flatMap(l=>l.items.map(i=>i.tag)).filter(Boolean))];
    html += `<span style="font-size:10px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">Tag:</span>`;
    tags.forEach(tg=>{
      html += `<button class="filter-chip ${activeFilters.listTag===tg?'active':''}" onclick="setFilter('listTag','${tg}')">#${tg}</button>`;
    });
    html += `<div class="filter-separator"></div>`;
    html += `<button class="filter-chip ${activeFilters.listDone==='false'?'active':''}" onclick="setFilter('listDone','false')">Pendentes</button>`;
    html += `<button class="filter-chip ${activeFilters.listDone==='true'?'active':''}" onclick="setFilter('listDone','true')">Concluídos</button>`;
  }

  if (view === 'calendar') {
    html += `<span style="font-size:10px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">Mostrar:</span>`;
    html += `<button class="filter-chip ${activeFilters.calShow==='events'?'active':''}" onclick="setFilter('calShow','events')">Só eventos</button>`;
    html += `<button class="filter-chip ${activeFilters.calShow==='tasks'?'active':''}" onclick="setFilter('calShow','tasks')">Só tarefas</button>`;
  }

  const hasActive = Object.keys(activeFilters).length > 0;
  if (hasActive) {
    html += `<div class="filter-separator"></div>`;
    html += `<button class="filter-chip clear" onclick="clearFilters()">✕ Limpar filtros</button>`;
  }

  panel.innerHTML = html || '<span style="font-size:12px;color:var(--text-dim)">Nenhum filtro disponível para esta view.</span>';
}

function setFilter(key, value) {
  if (activeFilters[key] === value) {
    delete activeFilters[key];
  } else {
    activeFilters[key] = value;
  }
  buildFilterPanel();
  applyFilters();
}

function clearFilters() {
  activeFilters = {};
  buildFilterPanel();
  applyFilters();
}

function applyFilters() {
  const v = currentView;
  if (v === 'kanban')   renderKanban();
  if (v === 'inbox')    renderBacklog();
  if (v === 'finance')  renderFinance();
  if (v === 'lists')    renderLists();
  if (v === 'calendar') renderCalendar();
}

// Inject filter logic into renders via filtered arrays
function filteredTasks() {
  let t = [...tasks];
  if (activeFilters.tag)      t = t.filter(x=>x.tag===activeFilters.tag);
  if (activeFilters.priority) t = t.filter(x=>x.priority===activeFilters.priority);
  if (activeFilters.col)      t = t.filter(x=>x.col===activeFilters.col);
  return t;
}

function filteredBacklog() {
  let b = [...backlog];
  if (activeFilters.tag)      b = b.filter(i=>(i.tags||[]).includes(activeFilters.tag));
  if (activeFilters.priority) b = b.filter(i=>(i.priority||'normal')===activeFilters.priority);
  return b;
}


function filterFinDay(dateKey) {
  if (activeFilters.finDate === dateKey) {
    // Clicou duas vezes: remove filtro
    delete activeFilters.finDate;
    showToast('Filtro de data removido');
  } else {
    activeFilters.finDate = dateKey;
    var parts = dateKey.split('-');
    showToast('Filtrando: ' + parts[2] + '/' + parts[1] + '/' + parts[0]);
  }
  renderFinCalendar();
  renderFinance();
}
function filteredFinances() {
  // Filtra pelo mês do calendário
  var mes = finCalYear + '-' + String(finCalMonth+1).padStart(2,'0');
  let f = finances.filter(x => x.date && x.date.startsWith(mes));
  // Filtros adicionais
  if (activeFilters.finType) f = f.filter(x=>x.type===activeFilters.finType);
  if (activeFilters.finCat)  f = f.filter(x=>x.category===activeFilters.finCat);
  if (activeFilters.finDate) f = f.filter(x=>x.date===activeFilters.finDate);
  // Ordena: mais recentes primeiro
  f.sort((a,b) => (b.date||'') > (a.date||'') ? 1 : (b.date||'') < (a.date||'') ? -1 : b.id - a.id);
  return f;
}

function filteredListItems(list) {
  let items = [...list.items];
  if (activeFilters.listTag)  items = items.filter(i=>i.tag===activeFilters.listTag);
  if (activeFilters.listDone !== undefined) items = items.filter(i=>String(i.done)===activeFilters.listDone);
  // Concluidos sempre no final, mantendo ordem relativa dentro de cada grupo
  items.sort((a, b) => (a.done === b.done) ? 0 : a.done ? 1 : -1);
  return items;
}

// Active filters pill bar HTML
function activeFiltersPillsHtml() {
  const entries = Object.entries(activeFilters);
  if (!entries.length) return '';
  return `<div class="active-filters">
    ${entries.map(([k,v])=>`
      <span class="active-filter-pill">
        ${k}: ${v}
        <button onclick="setFilter('${k}','${v}')">×</button>
      </span>`).join('')}
  </div>`;
}

// ══════════════════════════════════════════
//  VOICE — ENHANCED
// ══════════════════════════════════════════
// ══════════════════════════════════════════
//  GERENCIAR CATEGORIAS FINANCEIRAS
// ══════════════════════════════════════════

function renderManageCats() {
  document.getElementById('cats-manage-list').innerHTML = finCategories.map((c,i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border-soft)">
      <span style="flex:1;font-size:13px;color:var(--text)">${escHtml(c.label)}</span>
      <span style="font-size:10px;padding:2px 7px;border-radius:4px;background:var(--bg);color:var(--text-dim);border:1px solid var(--border-soft)">${c.type}</span>
      <button class="btn btn-ghost btn-sm" onclick="editFinCatInline(${i}, this)">✏️</button>
      <button class="btn btn-danger btn-sm" onclick="deleteFinCategory(${i})">✕</button>
    </div>`).join('') || '<p style="color:var(--text-dim);font-size:12px">Nenhuma categoria.</p>';
}

function editFinCatInline(idx, btn) {
  const c = finCategories[idx];
  const newLabel = prompt('Novo nome:', c.label);
  if (newLabel && newLabel.trim()) {
    finCategories[idx].label = newLabel.trim();
    finCategories[idx].id    = newLabel.trim();
    renderManageCats();
    updateFinCategorySelects();
  }
}

function addFinCategory() {
  const label = document.getElementById('new-cat-label').value.trim();
  const type  = document.getElementById('new-cat-type').value;
  if (!label) { showToast('⚠️ Informe o nome'); return; }
  finCategories.push({id: label, label, type});
  document.getElementById('new-cat-label').value = '';
  renderManageCats();
  updateFinCategorySelects();
  lsSave();
  showToast(`✅ Categoria "${label}" adicionada`);
}

function deleteFinCategory(idx) {
  lsSave();
  const c = finCategories[idx];
  if (confirm(`Remover categoria "${c.label}"?`)) {
    finCategories.splice(idx, 1);
    renderManageCats();
    updateFinCategorySelects();
  }
}


function getPayMethods() {
  var builtin = [
    'Boleto','Cartão C6','Cartão Santander','Cartão Zaffari',
    'Crédito','DDA','Débito','Dinheiro','Outro','PIX','TED','Transferência'
  ];
  var all = {};
  builtin.forEach(function(m){ all[m] = true; });
  customPayMethods.forEach(function(m){ all[m] = true; });
  return Object.keys(all).sort(function(a,b){
    return a.localeCompare(b,'pt-BR',{sensitivity:'base'});
  });
}

function updateFinMethodSelects() {
  var methods = getPayMethods();
  document.querySelectorAll('#fin-method, #edit-fin-method, .fin-method-select').forEach(function(sel) {
    var cur = sel.value;
    sel.innerHTML = methods.map(function(m) {
      return '<option value="' + m + '"' + (m===cur?' selected':'') + '>' + m + '</option>';
    }).join('') + '<option value="__add__">+ Adicionar forma...</option>';
    sel.onchange = function() {
      if (this.value === '__add__') {
        var nova = prompt('Nome da nova forma de pagamento:');
        if (nova && nova.trim()) {
          nova = nova.trim();
          if (!customPayMethods.includes(nova)) {
            customPayMethods.push(nova);
            localStorage.setItem('painel_pay_methods', JSON.stringify(customPayMethods));
          }
          updateFinMethodSelects();
          this.value = nova;
        } else {
          this.value = cur || 'PIX';
        }
      }
    };
  });
}

function updateFinCategorySelects() {
  const sel = document.getElementById('fin-category');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = finCategories.map(c =>
    `<option value="${escHtml(c.id)}"${c.id===cur?' selected':''}>${escHtml(c.label)}</option>`
  ).join('');
}

// ══════════════════════════════════════════
//  GERENCIAR COLUNAS KANBAN
// ══════════════════════════════════════════

function renderManageCols() {
  document.getElementById('cols-manage-list').innerHTML = kanbanCols.map((c,i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border-soft)">
      <div style="width:10px;height:10px;border-radius:50%;background:${c.dotColor};flex-shrink:0"></div>
      <span style="flex:1;font-size:13px;color:var(--text)">${escHtml(c.name)}</span>
      <input type="color" value="${c.dotColor}" onchange="kanbanCols[${i}].dotColor=this.value" style="width:28px;height:28px;border:1px solid var(--border);border-radius:4px;background:var(--card);cursor:pointer">
      <button class="btn btn-ghost btn-sm" onclick="renameKanbanCol(${i})">✏️</button>
      ${kanbanCols.length > 1 ? `<button class="btn btn-danger btn-sm" onclick="deleteKanbanCol(${i})">✕</button>` : ''}
    </div>`).join('');
}

function renameKanbanCol(idx) {
  const newName = prompt('Novo nome da coluna:', kanbanCols[idx].name);
  if (newName && newName.trim()) {
    kanbanCols[idx].name = newName.trim();
    renderManageCols();
    updateTaskColSelect();
  }
}

function addKanbanCol() {
  const name  = document.getElementById('new-col-name').value.trim();
  const color = document.getElementById('new-col-color').value;
  if (!name) { showToast('⚠️ Informe o nome da coluna'); return; }
  const id = 'col_' + (nextColId++);
  kanbanCols.push({id, name, dotColor: color});
  document.getElementById('new-col-name').value = '';
  renderManageCols();
  updateTaskColSelect();
  lsSave();
  showToast(`✅ Coluna "${name}" criada`);
}

function deleteKanbanCol(idx) {
  const c = kanbanCols[idx];
  const hasTasks = tasks.some(t => t.col === c.id);
  if (hasTasks) {
    lsSave();
  showToast(`⚠️ Mova as tarefas de "${c.name}" antes de remover`);
    return;
  }
  if (confirm(`Remover coluna "${c.name}"?`)) {
    kanbanCols.splice(idx, 1);
    renderManageCols();
    updateTaskColSelect();
  }
}

function updateTaskColSelect() {
  const sel = document.getElementById('task-col');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = kanbanCols.map(c =>
    `<option value="${c.id}"${c.id===cur?' selected':''}>${escHtml(c.name)}</option>`
  ).join('');
}

// ══════════════════════════════════════════
//  GERENCIAR LISTAS
// ══════════════════════════════════════════
function openManageLists() {
  renderManageListsModal();
  openModal('modal-manage-lists');
}

const listIconBgs = [
  'rgba(124,58,237,0.15)','rgba(6,182,212,0.15)',
  'rgba(245,158,11,0.15)','rgba(16,185,129,0.15)',
  'rgba(239,68,68,0.15)','rgba(59,130,246,0.15)',
];
const listIconColors = [
  'var(--violet-light)','var(--cyan)',
  'var(--amber)','var(--green)',
  'var(--red)','var(--blue)',
];

function renderManageListsModal() {
  document.getElementById('lists-manage-list').innerHTML = lists.map((l,i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border-soft)">
      <span style="font-size:16px">${l.icon}</span>
      <span style="flex:1;font-size:13px;color:var(--text)">${escHtml(l.name)}</span>
      <span style="font-size:10px;color:var(--text-dim)">${l.items.length} itens</span>
      <button class="btn btn-ghost btn-sm" onclick="renameList(${i})">✏️</button>
      ${lists.length > 1 ? `<button class="btn btn-danger btn-sm" onclick="deleteList(${i})">✕</button>` : ''}
    </div>`).join('');
}

function renameList(idx) {
  const newName = prompt('Novo nome da lista:', lists[idx].name);
  if (newName && newName.trim()) {
    const newIcon = prompt('Emoji (atual: ' + lists[idx].icon + '):', lists[idx].icon);
    lists[idx].name = newName.trim();
    if (newIcon && newIcon.trim()) lists[idx].icon = newIcon.trim();
    lsSave();
    scheduleSave();
    renderManageListsModal();
    renderLists();
    updateListDestSelect();
    showToast('✏️ Lista renomeada');
  }
}

function addList() {
  const name = document.getElementById('new-list-name').value.trim();
  const icon = document.getElementById('new-list-icon').value.trim() || '📝';
  if (!name) { showToast('⚠️ Informe o nome'); return; }
  const idx = lists.length % listIconBgs.length;
  lists.push({
    id: 'list_' + (nextListId++), name, icon,
    iconBg: listIconBgs[idx], iconColor: listIconColors[idx],
    items: []
  });
  document.getElementById('new-list-name').value = '';
  document.getElementById('new-list-icon').value = '';
  renderManageListsModal();
  updateListDestSelect();
  lsSave();
  showToast(`✅ Lista "${name}" criada`);
}

function deleteList(idx) {
  lsSave();
  if (confirm(`Remover lista "${lists[idx].name}" e todos os seus itens?`)) {
    lists.splice(idx, 1);
    renderManageListsModal();
    updateListDestSelect();
  }
}

function updateListDestSelect() {
  const sel = document.getElementById('list-dest-select');
  if (!sel) return;
  sel.innerHTML = lists.map(l => `<option value="${l.id}">${l.icon} ${escHtml(l.name)}</option>`).join('');
}

// ══════════════════════════════════════════
//  TAREFAS NA AGENDA — helper
// ══════════════════════════════════════════
function getTasksForDate(dateKey) {
  return tasks.filter(t => t.due === dateKey && t.col !== 'done');
}

// ══════════════════════════════════════════
//  EDIÇÃO — BACKLOG
// ══════════════════════════════════════════
function editBacklog(id) {
  const item = backlog.find(i=>i.id===id);
  if (!item) return;
  const el = document.getElementById('bit-'+id);
  if (!el) return;
  const wrap = el.closest('.backlog-item');
  // Replace text span with inline input
  el.outerHTML = `<input id="bedit-${id}" class="form-input" style="flex:1;font-size:13px;padding:5px 8px"
    value="${escHtml(item.text)}"
    onkeydown="saveBacklogEdit(event,${id})"
    onblur="cancelBacklogEdit(${id})">`;
  const inp = document.getElementById('bedit-'+id);
  if (inp) { inp.focus(); inp.select(); }
}

function saveBacklogEdit(e, id) {
  if (e.key === 'Escape') { cancelBacklogEdit(id); return; }
  if (e.key !== 'Enter') return;
  const inp = document.getElementById('bedit-'+id);
  const val = inp ? inp.value.trim() : '';
  if (val) {
    const item = backlog.find(i=>i.id===id);
    if (item) item.text = val;
  }
  lsSave();
  renderBacklog();
}

function cancelBacklogEdit(id) {
  // only re-render if still in edit mode
  if (document.getElementById('bedit-'+id)) renderBacklog();
}

// ══════════════════════════════════════════
//  EDIÇÃO — FINANCEIRO
// ══════════════════════════════════════════
function editFinance(id) {
  const f = finances.find(x=>x.id===id);
  if (!f) return;
  window._currentEditFinId = id; // expõe para openFinParceladoFromEdit
  // Mostra botão Parcelar no modal
  var btnParc = document.getElementById('btn-fin-parcelar');
  if (btnParc) btnParc.style.display = 'inline-flex';
  document.getElementById('fin-origin-id').value = '';
  document.getElementById('fin-desc').value    = f.desc;
  document.getElementById('fin-value').value   = f.value;
  document.getElementById('fin-date').value    = f.date;
  updateFinMethodSelects(); // popula o select com todas as formas ANTES de setar o valor
  document.getElementById('fin-method').value  = f.method;
  document.getElementById('fin-source').value  = f.source||'';
  document.getElementById('fin-obs').value     = f.obs||'';
  document.getElementById('fin-type').value = f.type || 'saida';
  updateFinCategorySelects();
  updateFinType(); // adapta labels/visibilidade dos botões de status
  finSetStatus(f.status || 'pago'); // carrega status do lançamento
  document.getElementById('fin-category').value = f.category || '';
  // Carrega tags existentes
  var tw = document.getElementById('fin-tag-wrap');
  if (tw) {
    tw.querySelectorAll('.fin-tag-chip').forEach(function(ch){ ch.remove(); });
    (f.tags || []).forEach(function(t){ finAddTagChip(t); });
  }
  document.querySelector('#modal-fin .modal-title').textContent = 'Editar Lançamento';
  const saveBtn = document.querySelector('#modal-fin .btn-primary');
  saveBtn.textContent = 'Salvar alterações';
  saveBtn.onclick = () => {
    // Confirma tag digitada mas não fixada ainda
    var inp = document.getElementById('fin-tag-inp');
    if (inp && inp.value.trim()) { finAddTagChip(inp.value.trim()); inp.value = ''; }
    f.desc     = document.getElementById('fin-desc').value.trim() || f.desc;
    f.value    = parseFloat(document.getElementById('fin-value').value) || f.value;
    f.date     = document.getElementById('fin-date').value;
    f.method   = document.getElementById('fin-method').value;
    f.category = document.getElementById('fin-category').value;
    f.source   = document.getElementById('fin-source').value.trim();
    f.obs      = document.getElementById('fin-obs').value.trim();
    f.type     = document.getElementById('fin-type').value;
    f.tags     = finGetTags();
    f.status   = document.getElementById('fin-status') ? document.getElementById('fin-status').value : (f.status || 'pago');
    if (f.type === 'saida') applyCartaoDueDate(f);
    closeModal('modal-fin');
    resetFinModal();
    lsSave();
    scheduleSave();
    renderFinance();
    if (finRelOpen) finRelRender();
    showToast('✏️ Lançamento atualizado');
  };
  openModal('modal-fin');
  setTimeout(finShowRecentTags, 100);
}

function deleteFinance(id) {
  if (!confirm('Remover este lançamento?')) return;
  finances = finances.filter(f=>f.id!==id);
  lsSave();
  renderFinance();
  showToast('🗑️ Lançamento removido');
}

function resetTaskModal() {
  document.querySelector('#modal-task .modal-title').textContent = 'Nova Tarefa';
  const btn = document.querySelector('#modal-task .btn-primary');
  btn.textContent = 'Criar Tarefa';
  btn.onclick = saveTask;
  const delBtn = document.getElementById('task-delete-btn');
  if (delBtn) delBtn.style.display = 'none';
}

function resetFinModal() {
  document.querySelector('#modal-fin .modal-title').textContent = 'Novo Lançamento';
  const btn = document.querySelector('#modal-fin .btn-primary');
  btn.textContent = 'Registrar';
  btn.onclick = saveFinance;
  // Reset status para pago
  finSetStatus('pago');
  // Limpa tags
  var wrap = document.getElementById('fin-tag-wrap');
  if (wrap) {
    wrap.querySelectorAll('.fin-tag-chip').forEach(function(ch){ ch.remove(); });
    var inp = document.getElementById('fin-tag-inp');
    if (inp) inp.value = '';
  }
  var recent = document.getElementById('fin-tag-recent');
  if (recent) recent.style.display = 'none';
}


// ══════════════════════════════════════════
//  EDIÇÃO — LISTA ITENS
// ══════════════════════════════════════════
function editListItem(listId, itemId) {
  const list = lists.find(l=>l.id===listId);
  if (!list) return;
  const item = list.items.find(i=>i.id===itemId);
  if (!item) return;

  // Populate modal
  document.getElementById('li-edit-list-id').value  = listId;
  document.getElementById('li-edit-item-id').value  = itemId;
  document.getElementById('li-edit-text').value     = item.text;
  document.getElementById('li-edit-done').checked   = item.done;

  // Build tag options
  const tags = list.tags || [];
  const tagSel = document.getElementById('li-edit-tag');
  tagSel.innerHTML = '<option value="">— sem tag —</option>'
    + tags.map(t => `<option value="${escHtml(t)}"${item.tag===t?' selected':''}>${escHtml(t)}</option>`).join('')
    + (item.tag && !tags.includes(item.tag) ? `<option value="${escHtml(item.tag)}" selected>${escHtml(item.tag)}</option>` : '');
  tagSel.value = item.tag || '';

  openModal('modal-list-item-edit');
}

function saveListItemEdit() {
  const listId = document.getElementById('li-edit-list-id').value;
  const itemId = parseInt(document.getElementById('li-edit-item-id').value);
  const text   = document.getElementById('li-edit-text').value.trim();
  const tag    = document.getElementById('li-edit-tag').value;
  const done   = document.getElementById('li-edit-done').checked;

  if (!text) { showToast('⚠️ Informe o texto do item'); return; }
  const list = lists.find(l=>l.id===listId);
  if (!list) return;
  const item = list.items.find(i=>i.id===itemId);
  if (!item) return;
  item.text = text;
  item.tag  = tag;
  item.done = done;
  closeModal('modal-list-item-edit');
  renderLists();
  lsSave();
  scheduleSave();
  showToast('✏️ Item atualizado');
}

function deleteListItem(listId, itemId) {
  lsSave();
  const list = lists.find(l=>l.id===listId);
  if (!list) return;
  list.items = list.items.filter(i=>i.id!==itemId);
  renderLists();
}
function moveListItem(listId, itemId, dir) {
  const list = lists.find(l => l.id === listId);
  if (!list) return;
  const idx = list.items.findIndex(i => i.id === itemId);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= list.items.length) return;
  const tmp = list.items[idx];
  list.items[idx] = list.items[newIdx];
  list.items[newIdx] = tmp;
  lsSave(); scheduleSave();
  renderLists();
}


// ══════════════════════════════════════════
//  EDIÇÃO — EVENTOS
// ══════════════════════════════════════════
function editEvent(id) {
  const ev = events.find(e=>e.id===id);
  if (!ev) return;
  document.getElementById('event-origin-id').value  = '';
  document.getElementById('event-title').value      = ev.title;
  document.getElementById('event-date').value       = ev.date;
  document.getElementById('event-time').value       = ev.time||'';
  document.getElementById('event-duration').value   = ev.duration||60;
  document.getElementById('event-location').value   = ev.location||'';
  document.getElementById('event-recur').value      = ev.recur||'nunca';
  document.querySelector('#modal-event .modal-title').textContent = 'Editar Evento';
  const saveBtn = document.querySelector('#modal-event .btn-primary');
  saveBtn.textContent = 'Salvar alterações';
  saveBtn.onclick = () => {
    const title = document.getElementById('event-title').value.trim();
    if (!title) { showToast('⚠️ Informe o título'); return; }
    ev.title    = title;
    ev.date     = document.getElementById('event-date').value;
    ev.time     = document.getElementById('event-time').value;
    ev.duration = parseInt(document.getElementById('event-duration').value);
    ev.location = document.getElementById('event-location').value.trim();
    ev.recur    = document.getElementById('event-recur').value;
    closeModal('modal-event');
    resetEventModal();
    renderCalendar();
    showToast('✏️ Evento atualizado');
  };
  openModal('modal-event');
}

function deleteEvent(id) {
  if (!confirm('Remover este evento?')) return;
  events = events.filter(e=>e.id!==id);
  renderCalendar();
  lsSave();
  showToast('🗑️ Evento removido');
}

function resetEventModal() {
  document.querySelector('#modal-event .modal-title').textContent = 'Novo Evento';
  const btn = document.querySelector('#modal-event .btn-primary');
  btn.textContent = 'Criar Evento';
  btn.onclick = saveEvent;
}

// ══════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════
function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escJs(s)  { return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function pad(n)    { return String(n).padStart(2,'0'); }
function fmtDate(d){ if(!d)return'—'; const str = (typeof d === 'object' && d.date) ? d.date : d; if(typeof str !== 'string') return '—'; const [y,m,dd]=str.split('-'); return `${dd}/${m}`; }
function fmtMoney(v){ return 'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function dateToLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function todayLocal() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function addDays(dateStr,n){
  var parts = dateStr.split('-');
  var d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2])+n);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}


// ══════════════════════════════════════════
//  GOOGLE CALENDAR INTEGRATION
// ══════════════════════════════════════════
const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.modify';
const GCAL_DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

let gcalState = {
  connected: false,
  clientId: localStorage.getItem('gcal_client_id') || '',
  token: null,
  googleEvents: [],
  calendars: [],
  tokenClient: null,
  gapiReady: false,
  gisReady: false,
};
let gcalHidden = JSON.parse(localStorage.getItem('gcal_hidden') || '[]');
function gcalIsHidden(calId) { return gcalHidden.includes(calId); }
function gcalToggleCal(calId) {
  if (gcalHidden.includes(calId)) gcalHidden = gcalHidden.filter(function(id){return id!==calId;});
  else gcalHidden.push(calId);
  localStorage.setItem('gcal_hidden', JSON.stringify(gcalHidden));
  renderGcalFilters();
  if (gcalState.connected) gcalFetchEvents();
  else renderCalendar();
}

// Auto-restore saved client ID
(function() {
  const saved = localStorage.getItem('gcal_client_id');
  if (saved) {
    gcalState.clientId = saved;
    const inp = document.getElementById('gcal-client-id');
    if (inp) inp.value = saved;
  }
})();

function gcalSetStatus(state, text) {
  const el = document.getElementById('gcal-status');
  const cfg = document.getElementById('gcal-config');
  const act = document.getElementById('gcal-connected-actions');
  if (!el) return;
  el.className = 'gcal-status ' + state;
  if (state === 'loading') {
    el.innerHTML = '<span class="gcal-spinner"></span>' + text;
  } else {
    el.innerHTML = '<span class="gcal-dot"></span>' + text;
  }
  if (state === 'connected') {
    cfg.style.display = 'none';
    act.style.display = 'flex';
  } else {
    cfg.style.display = 'flex';
    act.style.display = 'none';
  }
}

function gcalLoadScripts(clientId, callback) {
  // Load GAPI
  if (!document.getElementById('gapi-script')) {
    const s = document.createElement('script');
    s.id = 'gapi-script';
    s.src = 'https://apis.google.com/js/api.js';
    s.onload = () => {
      gapi.load('client', async () => {
        await gapi.client.init({
          discoveryDocs: [GCAL_DISCOVERY, 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
        });
        gcalState.gapiReady = true;
        if (gcalState.gisReady) callback();
        // Auto-reconnect if clientId was saved
        if (gcalState.gisReady && gcalState.clientId && !gcalState.connected) { setTimeout(gcalConnect, 200); }
      });
    };
    document.head.appendChild(s);
  } else if (gcalState.gapiReady) {
    // already loaded
  }

  // Load GIS
  if (!document.getElementById('gis-script')) {
    const s = document.createElement('script');
    s.id = 'gis-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => {
      gcalState.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GCAL_SCOPES,
        callback: (resp) => {
          if (resp.error) {
            gcalSetStatus('disconnected', 'Google Calendar');
            showToast('Erro ao autenticar: ' + resp.error);
            return;
          }
          gcalState.token = resp.access_token;
          gapi.client.setToken({access_token: resp.access_token});
          gcalState.connected = true;
          localStorage.setItem('gcal_client_id', gcalState.clientId);
          gcalSetStatus('connected', 'Google Calendar conectado');
          showToast('✅ Google Calendar conectado!');
          gcalFetchEvents();
        },
      });
      gcalState.gisReady = true;
      if (gcalState.gapiReady) callback();
    };
    document.head.appendChild(s);
  }
}

function renderGcalFilters() {
  var el = document.getElementById('gcal-filters');
  if (!el || !gcalState.calendars.length) { if(el) el.style.display='none'; return; }
  el.style.display = 'flex';
  el.innerHTML = gcalState.calendars.map(function(cal) {
    var hidden = gcalIsHidden(cal.id);
    var name = cal.name.length > 20 ? cal.name.slice(0,18)+'...' : cal.name;
    return '<button onclick="gcalToggleCal(\'' + cal.id.replace(/'/g,"\\'") + '\')" '
      + 'style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;'
      + 'font-size:10px;font-weight:600;border:1px solid ' + (hidden?'var(--border)':cal.color) + ';'
      + 'background:' + (hidden?'transparent':cal.color+'20') + ';'
      + 'color:' + (hidden?'var(--text-dim)':cal.color) + ';'
      + 'cursor:pointer;font-family:inherit;transition:background-color .12s,color .12s,border-color .12s,opacity .12s,transform .12s;opacity:' + (hidden?'0.5':'1') + '" '
      + 'title="' + (hidden?'Mostrar':'Ocultar') + ' ' + cal.name.replace(/"/g,'&quot;') + '">'
      + '<span style="width:8px;height:8px;border-radius:50%;background:' + cal.color + ';flex-shrink:0;opacity:' + (hidden?'0.3':'1') + '"></span>'
      + name
      + '</button>';
  }).join('');
}

function gcalConnect() {
  const clientId = document.getElementById('gcal-client-id')?.value.trim() || gcalState.clientId;
  if (!clientId) { showToast('⚠️ Cole o Client ID primeiro'); return; }
  gcalState.clientId = clientId;
  // Save clientId for auto-reconnect
  localStorage.setItem('gcal_client_id', clientId);
  gcalSetStatus('loading', 'Carregando…');

  gcalLoadScripts(clientId, () => {
    // Request token — use 'select_account' for manual connect, '' for silent
    gcalState.tokenClient.requestAccessToken({prompt: 'consent'});
  });
}

function gcalAutoConnect() {
  // Silent reconnect on page load — no consent prompt
  const clientId = gcalState.clientId;
  if (!clientId) return;
  gcalSetStatus('loading', 'Reconectando…');

  gcalLoadScripts(clientId, () => {
    // Try silent token refresh — won't show any UI if session is still active
    // If token expired (>1h), this will fail silently and user sees "Desconectado"
    try {
      gcalState.tokenClient.requestAccessToken({
        prompt: '',
        callback: (tokenResponse) => {
          if (tokenResponse.error) {
            // Token expired — reset status, show reconnect option
            gcalSetStatus('disconnected', 'Desconectado');
            gcalState.connected = false;
            // Show sync banner so user knows they need to reconnect
            const banner = document.getElementById('sync-banner');
            if (banner) banner.classList.remove('hidden');
          }
        }
      });
    } catch(e) {
      gcalSetStatus('disconnected', 'Desconectado');
    }
  });
}

function gcalDisconnect() {
  if (gcalState.token) {
    google.accounts.oauth2.revoke(gcalState.token, () => {});
  }
  gcalState.connected = false;
  gcalState.token = null;
  gcalState.googleEvents = [];
  localStorage.removeItem('gcal_client_id');
  gcalSetStatus('disconnected', 'Google Calendar');
  document.getElementById('gcal-client-id').value = '';
  renderCalendar();
  showToast('Desconectado do Google Calendar');
}

function gcalSync() {
  if (!gcalState.connected) return;
  gcalSetStatus('loading', 'Sincronizando…');
  gcalFetchEvents();
}

async function gcalFetchEvents() {
  try {
    // Step 1: get all calendars
    const calListResp = await gapi.client.calendar.calendarList.list();
    const calendars = calListResp.result.items || [];

    // Step 2: fetch events from each calendar
    const tMin = new Date(calYear, calMonth - 1, 1).toISOString();
    const tMax = new Date(calYear, calMonth + 2, 1).toISOString();
    const allEvents = [];

    gcalState.calendars = calendars.map(function(cal){return {id:cal.id, name:cal.summary||'', color:cal.backgroundColor||'var(--blue)'};});

    for (const cal of calendars) {
      if (gcalIsHidden(cal.id)) continue; // pula calendários ocultos
      try {
        const resp = await gapi.client.calendar.events.list({
          calendarId: cal.id,
          timeMin: tMin,
          timeMax: tMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250,
        });

        const items = resp.result.items || [];
        const calColor = cal.backgroundColor || 'var(--blue)';

        items.forEach(ev => {
          const start = ev.start.dateTime || ev.start.date;
          const end   = ev.end.dateTime   || ev.end.date;
          const date  = start.split('T')[0];
          const time  = start.includes('T') ? start.split('T')[1].slice(0,5) : '';
          const isAllDay = !start.includes('T');
          const durationMs = isAllDay ? 0 : (new Date(end) - new Date(start));
          const duration = isAllDay ? 0 : Math.round(durationMs / 60000);
          allEvents.push({
            id: 'g_' + ev.id,
            googleId: ev.id,
            calendarId: cal.id,
            title: ev.summary || '(sem título)',
            date,
            time,
            duration: duration,
            location: ev.location || '',
            recur: 'nunca',
            color: calColor,
            fromGoogle: true,
            htmlLink: ev.htmlLink,
            calendarName: cal.summary || '',
          });
        });
      } catch(calErr) {
        // Skip calendars that fail (e.g. read-only issues)
      }
    }

    gcalState.googleEvents = allEvents;
    renderGcalFilters();
    gcalSetStatus('connected', 'Google Calendar conectado (' + allEvents.length + ' eventos)');
    renderCalendar();
    showToast('↻ ' + allEvents.length + ' eventos de ' + calendars.length + ' calendários');
  } catch(e) {
    gcalSetStatus('connected', 'Google Calendar conectado');
    showToast('Erro ao buscar eventos: ' + (e.message || e));
  }
}

async function gcalCreateEvent(eventData) {
  if (!gcalState.connected) return null;
  try {
    const start = eventData.time
      ? { dateTime: eventData.date + 'T' + eventData.time + ':00', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      : { date: eventData.date };
    const endMs = eventData.time
      ? new Date(eventData.date + 'T' + eventData.time + ':00').getTime() + (eventData.duration || 60) * 60000
      : null;
    const end = endMs
      ? { dateTime: new Date(endMs).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      : { date: eventData.date };

    const resp = await gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: {
        summary: eventData.title,
        location: eventData.location || '',
        start,
        end,
      }
    });
    showToast('📅 Evento criado no Google Calendar');
    gcalFetchEvents(); // refresh
    return resp.result;
  } catch(e) {
    showToast('Erro ao criar no Google: ' + (e.message || e));
    return null;
  }
}

async function gcalDeleteEvent(googleId) {
  if (!gcalState.connected || !googleId) return;
  try {
    await gapi.client.calendar.events.delete({
      calendarId: 'primary',
      eventId: googleId,
    });
    gcalState.googleEvents = gcalState.googleEvents.filter(e => e.googleId !== googleId);
    lsSave();
  renderCalendar();
    showToast('🗑️ Evento removido do Google Calendar');
  } catch(e) {
    showToast('Erro ao remover: ' + (e.message || e));
  }
}

async function gcalUpdateEvent(googleId, eventData) {
  if (!gcalState.connected || !googleId) return;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const start = eventData.time
      ? { dateTime: eventData.date + 'T' + eventData.time + ':00', timeZone: tz }
      : { date: eventData.date };
    const endMs = eventData.time
      ? new Date(eventData.date + 'T' + eventData.time + ':00').getTime() + (eventData.duration || 60) * 60000
      : null;
    const end = endMs
      ? { dateTime: new Date(endMs).toISOString(), timeZone: tz }
      : { date: eventData.date };

    await gapi.client.calendar.events.update({
      calendarId: 'primary',
      eventId: googleId,
      resource: { summary: eventData.title, location: eventData.location || '', start, end }
    });
    showToast('✏️ Evento atualizado no Google Calendar');
    gcalFetchEvents();
  } catch(e) {
    showToast('Erro ao atualizar: ' + (e.message || e));
  }
}


// ══════════════════════════════════════════
//  GMAIL INTEGRATION
// ══════════════════════════════════════════
let gmailAutoTimer = null;
let gmailAutoOn = false;
let gmailProcessedIds = new Set(JSON.parse(localStorage.getItem('gmail_processed') || '[]'));

function gmailSaveProcessed() {
  localStorage.setItem('gmail_processed', JSON.stringify([...gmailProcessedIds].slice(-500)));
}

function gmailUpdateStatus() {
  const statusEl = document.getElementById('gmail-status');
  const infoEl   = document.getElementById('gmail-info');
  if (!statusEl) return;
  if (!gcalState.connected) {
    statusEl.textContent = 'Desconectado';
    statusEl.style.cssText = 'font-size:11px;color:var(--text-dim);padding:3px 8px;border-radius:20px;border:1px solid var(--border)';
    if (infoEl) infoEl.textContent = 'Conecte o Google Calendar primeiro';
  } else {
    statusEl.textContent = 'Conectado';
    statusEl.style.cssText = 'font-size:11px;color:var(--green);padding:3px 8px;border-radius:20px;border:1px solid var(--green);background:rgba(16,185,129,0.1)';
    if (infoEl) infoEl.textContent = '';
  }
}

async function gmailFetch() {
  if (!gcalState.connected) {
    showToast('⚠️ Conecte o Google Calendar primeiro — usa o mesmo login');
    return;
  }

  const label = (document.getElementById('gmail-label-input').value.trim() || 'painel').toLowerCase();
  const btn   = document.getElementById('gmail-fetch-btn');
  const info  = document.getElementById('gmail-info');

  btn.textContent = '⏳ Buscando…';
  btn.disabled = true;
  if (info) info.textContent = 'Buscando…';

  try {
    // Step 1: find label ID
    const labelsResp = await gapi.client.gmail.users.labels.list({ userId: 'me' });
    const labels = labelsResp.result.labels || [];
    const labelObj = labels.find(l => l.name.toLowerCase() === label);

    if (!labelObj) {
      showToast('⚠️ Label "' + label + '" não encontrada no Gmail. Crie-a primeiro.');
      if (info) info.textContent = 'Label não encontrada';
      return;
    }

    // Step 2: list messages with that label, unread or not already processed
    const msgsResp = await gapi.client.gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelObj.id],
      maxResults: 20,
    });

    const messages = msgsResp.result.messages || [];
    if (!messages.length) {
      showToast('📩 Nenhum e-mail encontrado na label "' + label + '"');
      if (info) info.textContent = 'Nenhum e-mail na label';
      return;
    }

    // Step 3: fetch details for new ones only
    let added = 0;
    for (const msg of messages) {
      if (gmailProcessedIds.has(msg.id)) continue;

      const detail = await gapi.client.gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      });

      const headers = detail.result.payload.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '(sem assunto)';
      const from    = headers.find(h => h.name === 'From')?.value || '';
      const date    = headers.find(h => h.name === 'Date')?.value || '';

      // Clean from field — extract just the name or email
      const fromClean = from.replace(/<.*>/, '').trim() || from;

      // Add to backlog
      backlog.unshift({
        id: nextBacklogId++,
        text: subject,
        time: 'Gmail',
        tags: ['gmail'],
        priority: 'normal',
        meta: { from: fromClean, date, msgId: msg.id, label },
        fromGmail: true,
      });

      gmailProcessedIds.add(msg.id);
      added++;
    }

    gmailSaveProcessed();
    renderBacklog();

    if (added > 0) {
      showToast('📩 ' + added + ' e-mail(s) importado(s) para o Backlog');
      if (info) info.textContent = added + ' importados — ' + new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
    } else {
      showToast('📩 Nenhum e-mail novo na label "' + label + '"');
      if (info) info.textContent = 'Nenhum novo — ' + new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
    }

  } catch(e) {
    showToast('Erro ao buscar Gmail: ' + (e.message || JSON.stringify(e)));
    if (info) info.textContent = 'Erro: ' + (e.message || e);
  } finally {
    btn.textContent = '📩 Buscar e-mails';
    btn.disabled = false;
  }
}

function gmailToggleAuto() {
  const btn = document.getElementById('gmail-auto-btn');
  if (gmailAutoOn) {
    clearInterval(gmailAutoTimer);
    gmailAutoTimer = null;
    gmailAutoOn = false;
    if (btn) btn.textContent = '⏱ Auto: OFF';
    showToast('⏱ Busca automática desativada');
  } else {
    gmailAutoOn = true;
    if (btn) btn.textContent = '⏱ Auto: ON';
    gmailFetch(); // fetch immediately
    gmailAutoTimer = setInterval(gmailFetch, 5 * 60 * 1000); // every 5 min
    showToast('⏱ Busca automática ativada — a cada 5 min');
  }
}

// Update gmail status whenever gcal connection changes
const _origGcalSetStatus = gcalSetStatus;
gcalSetStatus = function(state, text) {
  _origGcalSetStatus(state, text);
  if (state === 'connected') {
    setTimeout(gmailUpdateStatus, 100);
  } else if (state === 'disconnected') {
    if (gmailAutoOn) gmailToggleAuto(); // stop auto if disconnected
    setTimeout(gmailUpdateStatus, 100);
  }
};


// ══════════════════════════════════════════
//  NOTAS (Keep-style)
// ══════════════════════════════════════════
const NOTE_COLORS = {
  default: {bg:'var(--card)', border:'var(--border-soft)', accent:'transparent'},
  blue:    {bg:'var(--card)', border:'var(--border-soft)', accent:'#3B82F6'},
  amber:   {bg:'var(--card)', border:'var(--border-soft)', accent:'#F59E0B'},
  green:   {bg:'var(--card)', border:'var(--border-soft)', accent:'#10B981'},
  rose:    {bg:'var(--card)', border:'var(--border-soft)', accent:'#F43F5E'},
  violet:  {bg:'var(--card)', border:'var(--border-soft)', accent:'#8B5CF6'},
};

let notes = [];
let nextNoteId = 10;

let noteFolders = [];
let notesActiveFolder = 'todas';
let currentNoteId = null;
let newNoteColor = 'default';
let newNoteChecklist = [];
let newNoteImage = null;
let modalNoteColor = 'default';
let modalNotePin = false;
let modalNoteChecklist = [];
let modalNoteImage = null;

// ── Render ──
function renderNotes() {
  const q = (document.getElementById('notes-search')?.value || '').toLowerCase();

  // Folders bar
  const foldersEl = document.getElementById('notes-folders');
  if (foldersEl) {
    foldersEl.innerHTML =
      ['todas', ...noteFolders].map(f =>
        `<button class="folder-chip${notesActiveFolder===f?' active':''}" onclick="setNotesFolder('${f}')">${f==='todas'?'Todas':f}</button>`
      ).join('');
  }

  // Filter
  let filtered = notes.filter(n => {
    if (notesActiveFolder !== 'todas' && n.folder !== notesActiveFolder) return false;
    if (q) {
      const hay = (n.title+' '+n.body+' '+(n.tags||[]).join(' ')+' '+(n.checklist||[]).map(i=>i.text).join(' ')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const pinned   = filtered.filter(n => n.pinned);
  const unpinned = filtered.filter(n => !n.pinned);

  const container = document.getElementById('notes-container');
  if (!container) return;

  let html = '';

  if (pinned.length) {
    html += '<div class="notes-section-label">📌 Fixadas</div>';
    html += '<div class="notes-masonry">' + pinned.map(function(n){ try { return renderNoteCard(n); } catch(e) { console.error("Erro ao renderizar nota id=" + (n&&n.id), e); return ''; } }).join('') + '</div>';
  }
  if (unpinned.length) {
    if (pinned.length) html += '<div class="notes-section-label" style="margin-top:16px">Outras</div>';
    html += '<div class="notes-masonry">' + unpinned.map(function(n){ try { return renderNoteCard(n); } catch(e) { console.error("Erro ao renderizar nota id=" + (n&&n.id), e); return ''; } }).join('') + '</div>';
  }
  if (!filtered.length) {
    html = '<p style="color:var(--text-dim);font-size:13px;padding:24px 0;text-align:center">Nenhuma nota encontrada.</p>';
  }

  container.innerHTML = html;

  // Re-attach checklist checkbox listeners
  container.querySelectorAll('.note-check').forEach(cb => {
    cb.addEventListener('change', e => {
      e.stopPropagation();
      const nid = parseInt(cb.dataset.nid);
      const idx = parseInt(cb.dataset.idx);
      const note = notes.find(n => n.id === nid);
      if (note && note.checklist[idx]) {
        note.checklist[idx].done = cb.checked;
        renderNotes();
      }
    });
  });
}

function renderNoteCard(n) {
  // Fallbacks defensivos para todos os campos
  var nid       = n.id       || 0;
  var title     = n.title    || '';
  var body      = n.body     || '';
  var color     = n.color    || 'default';
  var tags      = Array.isArray(n.tags)      ? n.tags      : [];
  var checklist = Array.isArray(n.checklist) ? n.checklist : [];
  var folder    = n.folder   || '';
  var pinned    = !!n.pinned;
  var link      = n.link     || '';

  var clr = NOTE_COLORS[color] || NOTE_COLORS.default;

  // Tags
  var tagsHtml = tags.map(function(t) {
    return '<span class="note-tag" onclick="event.stopPropagation();filterNoteTag(\'' + escHtml(t) + '\')">#' + escHtml(t) + '</span>';
  }).join('');

  // Checklist
  var checkHtml = '';
  if (checklist.length) {
    checkHtml = '<ul class="note-checklist" style="margin-bottom:6px">';
    checklist.slice(0, 5).forEach(function(item, i) {
      var done = (item && item.done) ? 'done' : '';
      var chk  = (item && item.done) ? ' checked' : '';
      var txt  = (item && item.text) ? escHtml(item.text) : '';
      checkHtml += '<li class="' + done + '"><input type="checkbox" class="note-check" data-nid="' + nid + '" data-idx="' + i + '"' + chk + '><span>' + txt + '</span></li>';
    });
    if (checklist.length > 5) checkHtml += '<li style="color:var(--text-dim);font-size:11px">+' + (checklist.length - 5) + ' mais\u2026</li>';
    checkHtml += '</ul>';
  }

  // Imagem — só https://, sem template literal aninhado, sem base64
  var imgSrc = (n.image && typeof n.image === 'string' && n.image.includes('http')) ? n.image : null;
  var imgHtml = imgSrc
    ? '<div class="note-card-img-wrap"><img src="' + imgSrc + '" class="note-image" style="width:100%;object-fit:cover;max-height:180px" loading="lazy"></div>'
    : '';

  // Body
  var bodyHtml = body ? '<div class="note-body">' + escHtml(body) + '</div>' : '';

  // Link
  var linkHtml = '';
  if (link) {
    try {
      var domain = link.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
      linkHtml = '<a href="' + link + '" target="_blank" rel="noopener noreferrer" class="note-link" onclick="event.stopPropagation()">&#128279; ' + escHtml(domain) + '</a>';
    } catch(_) {}
  }

  // Folder
  var folderHtml = folder ? '<span class="note-folder">&#128193; ' + escHtml(folder) + '</span>' : '';

  // Borda esquerda
  var borderLeft = (clr.accent && clr.accent !== 'transparent')
    ? '4px solid ' + clr.accent
    : '1px solid var(--border-soft)';

  return '<div class="note-card' + (pinned ? ' pinned' : '') + '"'
    + ' style="background:' + clr.bg + ';border-color:' + clr.border + ';border-left:' + borderLeft + '"'
    + ' onclick="openNoteModal(' + nid + ')">'
    + imgHtml
    + '<div class="note-card-content">'
    + '<div class="note-card-header">'
    + '<div class="note-title">' + escHtml(title) + '</div>'
    + '<button class="note-pin" onclick="event.stopPropagation();toggleNotePin(' + nid + ')" title="' + (pinned ? 'Desafixar' : 'Fixar') + '" style="opacity:' + (pinned ? '1' : '0.35') + '">\uD83D\uDCCC</button>'
    + '</div>'
    + checkHtml
    + bodyHtml
    + linkHtml
    + '<div class="note-footer">' + tagsHtml + folderHtml + '</div>'
    + '<div class="note-actions">'
    + '<button class="note-action-btn" onclick="event.stopPropagation();sendToBacklog(\'note\',' + nid + ')" title="\u21A9 Backlog" style="color:var(--violet-light)">\u21A9</button>'
    + '<button class="note-action-btn" onclick="event.stopPropagation();duplicateNote(' + nid + ')" title="Duplicar" style="color:var(--muted)">\u29C9</button>'
    + '<button class="note-action-btn" onclick="event.stopPropagation();deleteNote(' + nid + ')" title="Excluir" style="color:var(--red)">\u2715</button>'
    + '</div>'
    + '</div>'
    + '</div>';
}

function setNotesFolder(f) {
  notesActiveFolder = f;
  renderNotes();
}

function filterNoteTag(tag) {
  const inp = document.getElementById('notes-search');
  if (inp) { inp.value = tag; renderNotes(); }
}

// ── Pin ──
function toggleNotePin(id) {
  lsSave();
  scheduleSave();
  const n = notes.find(x => x.id === id);
  if (n) { n.pinned = !n.pinned; renderNotes(); }
}

function toggleModalPin() {
  modalNotePin = !modalNotePin;
  const btn = document.getElementById('mnote-pin-btn');
  if (btn) btn.style.opacity = modalNotePin ? '1' : '0.4';
}

// ── Delete / Duplicate ──
function deleteNote(id) {
  if (!confirm('Excluir esta nota?')) return;
  notes = notes.filter(n => n.id !== id);
  lsSave();
  scheduleSave();
  renderNotes();
  showToast('🗑️ Nota excluída');
}

function deleteCurrentNote() {
  if (currentNoteId === null) return;
  deleteNote(currentNoteId);
  closeNoteModal();
}

function duplicateNote(id) {
  lsSave();
  const n = notes.find(x => x.id === id);
  if (!n) return;
  notes.unshift({...n, id: nextNoteId++, title: n.title + ' (cópia)', pinned: false, created: Date.now()});
  renderNotes();
  showToast('⧉ Nota duplicada');
}

// ── Color ──
function selectNoteColor(color, btn) {
  newNoteColor = color;
  document.querySelectorAll('#note-new-card .color-dot').forEach(d => d.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function selectModalColor(color, btn) {
  modalNoteColor = color;
  document.querySelectorAll('#modal-note-inner .color-dot').forEach(d => d.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const nc = NOTE_COLORS[color] || NOTE_COLORS.default;
  const inner = document.getElementById('modal-note-inner');
  if (inner) {
    // Fundo neutro sempre; linha lateral como preview
    inner.style.background = nc.bg;
    inner.style.borderLeft = nc.accent !== 'transparent'
      ? '4px solid ' + nc.accent
      : '';
  }
}

// ── Checklist ──
function addChecklistItem() {
  newNoteChecklist.push({text:'', done:false});
  focusNewNote(); // garante que tudo está visível
  renderNewNoteChecklist(newNoteChecklist.length - 1);
}

function renderNewNoteChecklist(focusIdx) {
  const el = document.getElementById('note-new-checklist');
  if (!el) return;
  el.innerHTML = newNoteChecklist.map((item, i) =>
    `<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px"
          onclick="event.stopPropagation()"
          onmousedown="event.stopPropagation()">
      <input type="checkbox" ${item.done?'checked':''} style="accent-color:var(--violet);flex-shrink:0;width:16px;height:16px;cursor:pointer"
        onclick="event.stopPropagation()"
        onchange="event.stopPropagation();newNoteChecklist[${i}].done=this.checked">
      <input class="form-input ncl-inp" data-idx="${i}"
        style="flex:1;font-size:12px;padding:5px 8px"
        value="${escHtml(item.text)}"
        placeholder="Item…"
        onclick="event.stopPropagation()"
        onmousedown="event.stopPropagation()"
        onfocus="event.stopPropagation()"
        onkeydown="event.stopPropagation();
          if(event.key==='Enter'){event.preventDefault();addChecklistItem();return;}
          if(event.key==='Backspace'&&this.value===''){event.preventDefault();newNoteChecklist.splice(${i},1);renderNewNoteChecklist(Math.max(0,${i}-1));}">
      <button
        onclick="event.stopPropagation();newNoteChecklist.splice(${i},1);renderNewNoteChecklist(Math.max(0,${i}-1))"
        onmousedown="event.stopPropagation()"
        style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;flex-shrink:0;padding:2px 4px">✕</button>
    </div>`
  ).join('');
  // Atualiza array via eventos delegados — sem re-render ao digitar
  el.querySelectorAll('.ncl-inp').forEach(function(inp) {
    inp.addEventListener('input', function(e) {
      e.stopPropagation();
      var i = parseInt(this.dataset.idx);
      if (newNoteChecklist[i] !== undefined) newNoteChecklist[i].text = this.value;
    });
    inp.addEventListener('click',      function(e){ e.stopPropagation(); });
    inp.addEventListener('mousedown',  function(e){ e.stopPropagation(); });
    inp.addEventListener('focus',      function(e){ e.stopPropagation(); });
  });
  // Restaura foco no item correto após re-render estrutural
  if (focusIdx !== undefined) {
    var inputs = el.querySelectorAll('.ncl-inp');
    if (inputs[focusIdx]) {
      inputs[focusIdx].focus();
      var len = inputs[focusIdx].value.length;
      try { inputs[focusIdx].setSelectionRange(len, len); } catch(e) {}
    }
  }
}

function addModalChecklistItem() {
  modalNoteChecklist.push({text:'', done:false});
  renderModalChecklist();
}

function renderModalChecklist() {
  const el = document.getElementById('mnote-checklist-area');
  if (!el) return;
  el.innerHTML = modalNoteChecklist.map((item, i) =>
    `<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
      <input type="checkbox" ${item.done?'checked':''} onchange="modalNoteChecklist[${i}].done=this.checked" style="accent-color:var(--violet)">
      <input class="form-input" style="flex:1;font-size:12px;padding:4px 7px" value="${escHtml(item.text)}"
        placeholder="Item…" oninput="modalNoteChecklist[${i}].text=this.value"
        onkeydown="if(event.key==='Enter'){event.preventDefault();addModalChecklistItem()}">
      <button onclick="modalNoteChecklist.splice(${i},1);renderModalChecklist()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px">✕</button>
    </div>`
  ).join('');
}

// ── Images ──
function loadNoteImage(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = async function() {
      const MAX = 900;
      let w = img.width, h = img.height;
      if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      else if (h > MAX)     { w = Math.round(w * MAX / h); h = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const base64 = canvas.toDataURL('image/jpeg', 0.8);

      // Preview imediato
      newNoteImage = base64;
      const preview = document.getElementById('note-new-img-preview');
      if (preview) preview.innerHTML =
        '<div style="position:relative;display:inline-block">' +
        '<img src="' + base64 + '" style="max-height:120px;border-radius:6px;max-width:100%;display:block">' +
        '<div id="note-img-upload-badge" style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.65);color:#fff;font-size:10px;padding:2px 7px;border-radius:20px">☁️ Enviando…</div>' +
        '</div>';

      showToast('🖼 Imagem carregada — enviando para nuvem…');
      var url = await uploadImageToStorage(base64, 'notes_images');
      var badge = document.getElementById('note-img-upload-badge');
      if (url) {
        newNoteImage = url;
        if (preview) preview.innerHTML = '<img src="' + url + '" style="max-height:120px;border-radius:6px;max-width:100%;display:block">';
        showToast('✅ Imagem na nuvem!');
      } else {
        if (badge) { badge.textContent = '📱 Local'; }
        const kb = Math.round(base64.length * 0.75 / 1024);
        showToast('🖼 Imagem local (' + kb + 'KB)');
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function loadModalImage(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = async function() {
      const MAX = 900;
      let w = img.width, h = img.height;
      if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      else if (h > MAX)     { w = Math.round(w * MAX / h); h = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const base64 = canvas.toDataURL('image/jpeg', 0.8);

      modalNoteImage = base64;
      const area = document.getElementById('mnote-img-area');
      if (area) area.innerHTML =
        '<div style="position:relative;display:inline-block">' +
        '<img id="modal-note-img-preview" src="' + base64 + '" style="max-height:160px;border-radius:6px;max-width:100%;display:block">' +
        '<div id="modal-img-badge" style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.65);color:#fff;font-size:10px;padding:2px 7px;border-radius:20px">☁️ Enviando…</div>' +
        '</div>';

      showToast('🖼 Imagem carregada — enviando para nuvem…');
      var url = await uploadImageToStorage(base64, 'notes_images');
      var badge = document.getElementById('modal-img-badge');
      if (url) {
        modalNoteImage = url;
        var prevImg = document.getElementById('modal-note-img-preview');
        if (prevImg) prevImg.src = url;
        if (badge) badge.remove();
        showToast('✅ Imagem na nuvem!');
      } else {
        if (badge) badge.textContent = '📱 Local';
        const kb = Math.round(base64.length * 0.75 / 1024);
        showToast('🖼 Imagem local (' + kb + 'KB)');
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── Quick-add ──
function focusNewNote() {
  var body     = document.getElementById('note-new-body');
  var checklist= document.getElementById('note-new-checklist');
  var actions  = document.getElementById('note-new-actions');
  if (body)     body.style.display = 'block';
  if (checklist)checklist.style.display = 'block';
  if (actions)  actions.style.display = 'flex';
  var title = document.getElementById('note-new-title');
  if (title && document.activeElement !== title) title.focus();
}

function saveNewNote() {
  const title = document.getElementById('note-new-title').value.trim();
  const body  = document.getElementById('note-new-body').value.trim();
  const tag   = document.getElementById('note-new-tag').value.trim();
  const folder= document.getElementById('note-new-folder').value;
  if (!title && !body && !newNoteChecklist.length && !newNoteImage) { cancelNewNote(); return; }
  notes.unshift({
    id: nextNoteId++,
    title, body,
    color: newNoteColor,
    tags: tag ? tag.split(/[,\s]+/).filter(Boolean).map(t=>t.replace(/^#/,'')) : [],
    folder: folder || '',
    pinned: false,
    checklist: [...newNoteChecklist],
    image: newNoteImage || null,
    link: '',
    created: Date.now(),
  });
  cancelNewNote();
  renderNotes();
  lsSave();
  scheduleSave();           // ← sincroniza com o Firebase
  showToast('📝 Nota salva');
}

function cancelNewNote() {
  var body      = document.getElementById('note-new-body');
  var checklist = document.getElementById('note-new-checklist');
  var actions   = document.getElementById('note-new-actions');
  var tag       = document.getElementById('note-new-tag');
  var title     = document.getElementById('note-new-title');
  var preview   = document.getElementById('note-new-img-preview');
  if (title)    title.value = '';
  if (body)     { body.value = ''; body.style.display = 'none'; }
  if (checklist){ checklist.innerHTML = ''; checklist.style.display = 'none'; }
  if (actions)  actions.style.display = 'none';
  if (tag)      tag.value = '';
  if (preview)  preview.innerHTML = '';
  newNoteChecklist = [];
  newNoteImage = null;
  newNoteColor = 'default';
  document.querySelectorAll('#note-new-card .color-dot').forEach(d => d.classList.remove('active'));
  document.getElementById('ndot-default')?.classList.add('active');
}

// ── Modal ──
function openNoteModal(id) {
  currentNoteId = id;
  modalNoteChecklist = [];
  modalNoteImage = null;
  modalNoteColor = 'default';
  modalNotePin = false;

  // Populate folder select
  const fsel = document.getElementById('mnote-folder');
  if (fsel) fsel.innerHTML = ['', ...noteFolders].map(f => `<option value="${escHtml(f)}">${f||'Sem pasta'}</option>`).join('');

  const delBtn = document.getElementById('mnote-delete-btn');

  if (id !== null) {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    document.getElementById('mnote-title').value = n.title || '';
    document.getElementById('mnote-body').value  = n.body  || '';
  const lnkEl = document.getElementById('mnote-link'); if (lnkEl) lnkEl.value = n.link || '';
    document.getElementById('mnote-tag').value   = (n.tags||[]).map(t=>'#'+t).join(', ');
    if (fsel) fsel.value = n.folder || '';
    modalNotePin = n.pinned;
    modalNoteColor = n.color || 'default';
    modalNoteChecklist = JSON.parse(JSON.stringify(n.checklist || []));
    modalNoteImage = n.image || null;
    if (delBtn) delBtn.style.display = 'inline-flex';
  } else {
    document.getElementById('mnote-title').value = '';
    document.getElementById('mnote-body').value  = '';
    document.getElementById('mnote-tag').value   = '';
    if (fsel) fsel.value = '';
    if (delBtn) delBtn.style.display = 'none';
  }

  // Apply color
  const nc = NOTE_COLORS[modalNoteColor] || NOTE_COLORS.default;
  const inner = document.getElementById('modal-note-inner');
  if (inner) {
    inner.style.background = nc.bg;
    inner.style.borderLeft = nc.accent !== 'transparent' ? '4px solid ' + nc.accent : '';
  }
  document.querySelectorAll('#modal-note-inner .color-dot').forEach(d => d.classList.remove('active'));
  const activeDot = document.querySelector(`#modal-note-inner .color-dot[onclick*="${modalNoteColor}"]`);
  if (activeDot) activeDot.classList.add('active');
  else document.getElementById('mdot-default')?.classList.add('active');

  // Pin
  const pinBtn = document.getElementById('mnote-pin-btn');
  if (pinBtn) pinBtn.style.opacity = modalNotePin ? '1' : '0.4';

  // Checklist
  renderModalChecklist();

  // Image
  const imgArea = document.getElementById('mnote-img-area');
  if (imgArea) imgArea.innerHTML = modalNoteImage ? `<img src="${modalNoteImage}" style="max-height:160px;border-radius:6px;max-width:100%;display:block">` : '';

  openModal('modal-note');
}

function closeNoteModal() {
  closeModal('modal-note');
  currentNoteId = null;
  const inner = document.getElementById('modal-note-inner');
  if (inner) { inner.style.background = ''; inner.style.borderLeft = ''; }
}

function saveNoteModal() {
  const title  = document.getElementById('mnote-title').value.trim();
  const body   = document.getElementById('mnote-body').value.trim();
  const tagRaw = document.getElementById('mnote-tag').value.trim();
  const folder = document.getElementById('mnote-folder').value;
  const tags   = tagRaw ? tagRaw.split(/[,\s]+/).filter(Boolean).map(t=>t.replace(/^#/,'')) : [];
  const link   = document.getElementById('mnote-link').value.trim();

  const wasNew = (currentNoteId === null);
  if (currentNoteId !== null) {
    // Edit existing
    const n = notes.find(x => x.id === currentNoteId);
    if (n) {
      n.title = title; n.body = body; n.tags = tags; n.folder = folder;
      n.pinned = modalNotePin; n.color = modalNoteColor;
      n.checklist = JSON.parse(JSON.stringify(modalNoteChecklist));
      n.image = modalNoteImage || null;   // preserva URL do Storage ou base64
      n.link = link;
      n.updatedAt = Date.now();
    }
  } else {
    // New
    notes.unshift({
      id: nextNoteId++, title, body, tags, folder, link,
      pinned: modalNotePin, color: modalNoteColor,
      checklist: JSON.parse(JSON.stringify(modalNoteChecklist)),
      image: modalNoteImage || null,      // URL do Storage ou base64 ou null
      created: Date.now(),
    });
  }

  closeNoteModal();
  renderNotes();
  lsSave();          // salva localmente com os dados já atualizados
  scheduleSave();    // envia para o Firebase com os dados já atualizados
  showToast(wasNew ? '📝 Nota criada' : '✏️ Nota atualizada');
}

// ── Folders management ──
function openManageFolders() {
  renderFoldersModal();
  openModal('modal-folders');
}

function renderFoldersModal() {
  const el = document.getElementById('folders-list');
  if (!el) return;
  el.innerHTML = noteFolders.map((f, i) =>
    `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border-soft)">
      <span style="flex:1;font-size:13px;color:var(--text)">📁 ${escHtml(f)}</span>
      <span style="font-size:10px;color:var(--text-dim)">${notes.filter(n=>n.folder===f).length} notas</span>
      <button class="btn btn-ghost btn-sm" onclick="renameFolder(${i})">✏️</button>
      <button class="btn btn-danger btn-sm" onclick="deleteFolder(${i})">✕</button>
    </div>`
  ).join('') || '<p style="color:var(--text-dim);font-size:12px">Nenhuma pasta.</p>';
}

function addFolder() {
  const name = document.getElementById('new-folder-name').value.trim();
  if (!name) return;
  if (!noteFolders.includes(name)) noteFolders.push(name);
  document.getElementById('new-folder-name').value = '';
  renderFoldersModal();
  lsSave();
  showToast('📁 Pasta "' + name + '" criada');
}

function renameFolder(idx) {
  const newName = prompt('Novo nome:', noteFolders[idx]);
  if (!newName || !newName.trim()) return;
  const old = noteFolders[idx];
  noteFolders[idx] = newName.trim();
  notes.forEach(n => { if (n.folder === old) n.folder = newName.trim(); });
  renderFoldersModal();
}

function deleteFolder(idx) {
  lsSave();
  const f = noteFolders[idx];
  if (!confirm('Remover pasta "' + f + '"? As notas ficam sem pasta.')) return;
  notes.forEach(n => { if (n.folder === f) n.folder = ''; });
  noteFolders.splice(idx, 1);
  renderFoldersModal();
}

// ── Populate folder selects when switching to notes ──
function populateNoteFolderSelects() {
  ['note-new-folder', 'mnote-folder'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = ['', ...noteFolders].map(f => `<option value="${escHtml(f)}">${f||'Sem pasta'}</option>`).join('');
    sel.value = cur;
  });
}

// call on view switch
const _origSwitchView = switchView;
switchView = function(name, btn) {
  _origSwitchView(name, btn);
  if (name === 'notes') populateNoteFolderSelects();
};


// ══════════════════════════════════════════
//  ESTUDOS — SEFAZ/RS · FGV
// ══════════════════════════════════════════
const DISCIPLINAS = [
  'Direito Tributário',
  'Legislação Tributária RS',
  'Direito Constitucional',
  'Direito Administrativo',
  'Contabilidade Geral',
  'Matemática Financeira',
  'Raciocínio Lógico',
  'Português',
  'Informática',
];

const META_DIARIA_H = 3;
const REVISAO_DIAS = [1, 7, 15, 30];

// ── State ──
let studyBacklog = [];

let atividades = [];
let nextAtivId = 10;

let sessoes = [];

let questaoSessoes = [];

let revisoesPendentes = [];

let selectedDia = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; // 0=
let semanaWeekOffset = 0; // 0=current week, 1=next, -1=prevSeg..6=Dom
let editAtivId = null;

// Timer state






// ── Populate selects ──
function populateEstudosSelects() {
  // Merge DISCIPLINAS with curriculo matérias
  const allDisc = [...new Set([...DISCIPLINAS, ...curriculo.map(m=>m.nome)])];
  ['ativ-disciplina','q-disciplina','__removed__'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = allDisc.map(d => `<option value="${escHtml(d)}">${escHtml(d)}</option>`).join('');
    if (cur) sel.value = cur;
  });
}

// ── Main render ──
function renderEstudos() {
  // Aplica o modo (foco/completo) salvo e renderiza
  setTimeout(aplicarEstudosModo, 0);
}

// ── Meta ring ──
function updateMetaRing() {
  const today = todayLocal();
  const hojeMin = sessoes.filter(s => s.data === today).reduce((acc,s) => acc + s.durMin, 0);
  const hojeH = hojeMin / 60;
  const pct = Math.min(1, hojeH / META_DIARIA_H);
  const circ = 2 * Math.PI * 30;
  const offset = circ * (1 - pct);
  const ring = document.getElementById('meta-ring-circle');
  if (ring) {
    ring.style.strokeDashoffset = offset;
    ring.style.stroke = pct >= 1 ? 'var(--amber)' : 'var(--green)';
  }
  const val = document.getElementById('meta-ring-val');
  if (val) val.textContent = hojeH >= 1 ? hojeH.toFixed(1)+'h' : hojeMin+'min';
  const lbl = document.getElementById('timer-hoje-label');
  if (lbl) lbl.textContent = 'Hoje: ' + Math.floor(hojeH) + 'h ' + (hojeMin % 60) + 'min';
}

// ── Streak ──
function updateStreak() {
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = dateToLocal(d);
    const studied = sessoes.some(s => s.data === key);
    if (!studied && key !== todayLocal()) break;
    if (studied) streak++;
    d.setDate(d.getDate() - 1);
    if (streak > 365) break;
  }
  const el = document.getElementById('streak-val');
  if (el) el.textContent = streak;
}

// ── Semana progress ──
function updateSemanaProgress() {
  const total = atividades.length;
  const done  = atividades.filter(a => a.done).length;
  const pct   = total ? (done / total * 100) : 0;
  const bar = document.getElementById('semana-progress-bar');
  const lbl = document.getElementById('semana-progress-label');
  if (bar) bar.style.width = pct.toFixed(0) + '%';
  if (lbl) lbl.textContent = done + '/' + total + ' atividades';
}

// ── Semana dias ──
function semanaNav(direction) {
  if (direction === 0) {
    semanaWeekOffset = 0;
    selectedDia = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  } else {
    semanaWeekOffset += direction;
  }
  renderSemana();
  renderAtividades();
}

function renderSemana() {
  const dias = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const todayDow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const el = document.getElementById('semana-dias');
  if (!el) return;

  // Build date for each day of selected week (with offset)
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - todayDow + (semanaWeekOffset * 7));
  weekStart.setHours(0,0,0,0);

  const weekDates = dias.map((d, i) => {
    const dt = new Date(weekStart);
    dt.setDate(dt.getDate() + i);
    return dateToLocal(dt); // YYYY-MM-DD
  });

  el.innerHTML = dias.map((d, i) => {
    const dateStr = weekDates[i];
    const dayNum = parseInt(dateStr.split('-')[2]);
    // Count atividades for this date OR for this weekday (legacy)
    const count = atividades.filter(a => (a.data === dateStr) || (!a.data && a.dia === i)).length;
    const doneCnt = atividades.filter(a => ((a.data === dateStr) || (!a.data && a.dia === i)) && a.done).length;
    const cls = ['dia-pill', i === selectedDia ? 'active' : '', (semanaWeekOffset === 0 && i === todayDow) ? 'today' : ''].filter(Boolean).join(' ');
    return `<div class="${cls}" onclick="selectDia(${i})" data-date="${dateStr}">
      <div>${d}</div>
      <div style="font-size:9px;opacity:0.6;margin-top:1px">${dayNum}</div>
      ${count ? `<div style="font-size:8px;margin-top:1px;color:inherit">${doneCnt}/${count}</div>` : ''}
    </div>`;
  }).join('');

  const lbl = document.getElementById('semana-label');
  if (lbl) {
    lbl.textContent = fmtDate(weekDates[0]) + ' – ' + fmtDate(weekDates[6]);
  }

  // Store week dates globally for renderAtividades
  window._semanaWeekDates = weekDates;
}

function selectDia(i) {
  selectedDia = i;
  renderSemana();
  renderAtividades();
}

// ── Atividades ──
function renderAtividades() {
  const weekDates = window._semanaWeekDates || [];
  const selectedDate = weekDates[selectedDia] || '';
  // Match by real date (new) OR by weekday (legacy)
  const list = atividades.filter(a =>
    (a.data && a.data === selectedDate) ||
    (!a.data && a.dia === selectedDia)
  );
  const el = document.getElementById('atividades-list');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<p style="color:var(--text-dim);font-size:12px;padding:8px 0">Nenhuma atividade neste dia.</p>';
    return;
  }
  el.innerHTML = list.map(a => `
    <div class="atividade-item${a.done?' done':''}" onclick="toggleAtividade(${a.id})">
      <div class="ativ-check">${a.done?'✓':''}</div>
      <div class="ativ-info">
        <div class="ativ-title">${escHtml(a.desc)}</div>
        <div class="ativ-meta">
          <span class="ativ-tipo ${a.tipo}">${a.tipo}</span>
          <span class="ativ-time">~${a.tempo}min</span>
          <span style="color:var(--text-dim)">${escHtml(a.disciplina)}</span>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:10px;flex-shrink:0"
        onclick="event.stopPropagation();openAtividadeModal(${a.id})">✏️</button>
    </div>
  `).join('');
}

function toggleAtividade(id) {
  lsSave();
  scheduleSave();
  const a = atividades.find(x => x.id === id);
  if (!a) return;
  a.done = !a.done;
  if (a.done) showToast('✅ Atividade concluída!');
  renderAtividades();
  updateSemanaProgress();
  updateStreak();
}

// ── Modal atividade ──
function openAtividadeModal(id) {
  editAtivId = id || null;
  populateEstudosSelects();
  const delBtn = document.getElementById('ativ-delete-btn');
  const title  = document.getElementById('modal-ativ-title');

  if (id) {
    const a = atividades.find(x => x.id === id);
    if (!a) return;
    document.getElementById('ativ-desc').value = a.desc;
    document.getElementById('ativ-disciplina').value = a.disciplina;
    document.getElementById('ativ-tipo').value = a.tipo;
    document.getElementById('ativ-dia').value = a.dia;
    document.getElementById('ativ-tempo').value = a.tempo;
    if (delBtn) delBtn.style.display = 'inline-flex';
    if (title) title.textContent = 'Editar Atividade';
  } else {
    document.getElementById('ativ-desc').value = '';
    document.getElementById('ativ-dia').value = selectedDia;
    document.getElementById('ativ-tempo').value = 60;
    if (delBtn) delBtn.style.display = 'none';
    if (title) title.textContent = 'Nova Atividade';
  }
  openModal('modal-atividade');
}

function saveAtividade() {
  lsSave();
  scheduleSave();
  const desc  = document.getElementById('ativ-desc').value.trim();
  const disc  = document.getElementById('ativ-disciplina').value;
  const tipo  = document.getElementById('ativ-tipo').value;
  const dia   = parseInt(document.getElementById('ativ-dia').value);
  const tempo = parseInt(document.getElementById('ativ-tempo').value) || 60;
  if (!desc) { showToast('⚠️ Informe a descrição'); return; }

  if (editAtivId) {
    const a = atividades.find(x => x.id === editAtivId);
    if (a) { a.desc=desc; a.disciplina=disc; a.tipo=tipo; a.dia=dia; a.tempo=tempo; }
  } else {
    atividades.push({id: nextAtivId++, desc, disciplina:disc, tipo, dia, tempo, done:false});
  }
  closeModal('modal-atividade');
  renderEstudos();
  showToast(editAtivId ? '✏️ Atividade atualizada' : '✅ Atividade adicionada');
  editAtivId = null;
}

function deleteAtividade() {
  lsSave();
  if (!editAtivId) return;
  if (!confirm('Excluir esta atividade?')) return;
  atividades = atividades.filter(a => a.id !== editAtivId);
  closeModal('modal-atividade');
  renderEstudos();
  editAtivId = null;
}

// ── Timer ──










// ── Sessões ──
function renderSessoes() {
  const el = document.getElementById('sessoes-list');
  if (!el) return;

  // Combine: studyBacklog concluidos + timer sessions not linked to studyBacklog
  const studySessoes = studyBacklog.filter(x => x.status === 'concluido')
    .sort((a,b) => (b.concluidoEm||'').localeCompare(a.concluidoEm||''));

  // Timer sessoes not linked to any studyBacklog item
  const linkedDates = studySessoes.map(x => x.concluidoEm).filter(Boolean);
  const timerSessoes = sessoes.filter(s => !s.data || !linkedDates.includes(s.data))
    .sort((a,b) => (b.data||'').localeCompare(a.data||''));

  if (!studySessoes.length && !timerSessoes.length) {
    el.innerHTML = '<p style="color:var(--text-dim);font-size:12px">Nenhuma sessão registrada ainda.</p>';
    return;
  }

  let html = '';

  // Study sessions (rich view)
  studySessoes.forEach(item => {
    const acertoColor = item.acerto != null
      ? (item.acerto >= 70 ? 'var(--green)' : item.acerto >= 50 ? 'var(--amber)' : 'var(--red)')
      : 'var(--text-dim)';
    html += `<div style="padding:10px 0;border-bottom:1px solid var(--border-soft)">
      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:5px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text)">${escHtml(item.materia)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${item.topicos.map(t => escHtml(t)).join(' · ')}</div>
        </div>
        <span style="font-size:10px;color:var(--text-dim);flex-shrink:0">${item.concluidoEm||''}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${item.tempoConcluido ? `<span style="font-size:11px;color:var(--cyan);background:rgba(6,182,212,0.1);padding:2px 7px;border-radius:4px">⏱ ${item.tempoConcluido}min</span>` : ''}
        ${item.questoesConcluidas ? `<span style="font-size:11px;color:var(--text-muted)">📝 ${item.questoesConcluidas} questões</span>` : ''}
        ${item.acerto != null ? `<span style="font-size:11px;font-weight:700;color:${acertoColor}">🎯 ${item.acerto}%</span>` : ''}
        <div style="margin-left:auto;display:flex;gap:4px">
          <button onclick="editarConclusao(${item.id})" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:12px;padding:2px 5px" title="Editar">✏️</button>
          <button onclick="reabrirEstudo(${item.id})" style="background:none;border:none;color:var(--amber);cursor:pointer;font-size:11px;padding:2px 5px" title="Reabrir">↩ Reabrir</button>
        </div>
      </div>
    </div>`;
  });

  // Timer sessions (simple view)
  if (timerSessoes.length) {
    if (studySessoes.length) html += `<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin:10px 0 4px">Cronômetro</div>`;
    timerSessoes.slice(0,8).forEach(s => {
      const mins = s.durMin != null ? s.durMin : (s.duracao ? Math.round(s.duracao/60) : 0);
      html += `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-soft)">
        <div style="flex:1">
          <div style="font-size:12px;color:var(--text);font-weight:500">${escHtml(s.disciplina||'Geral')}</div>
          <div style="font-size:10px;color:var(--text-dim)">${s.data||''}</div>
        </div>
        <span style="font-size:12px;font-family:'JetBrains Mono',monospace;color:var(--cyan)">${mins}min</span>
        <button onclick="editSessao(${s.id})" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:12px;padding:2px 4px" title="Editar">✏️</button>
        <button onclick="deleteSessao(${s.id})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px;padding:2px 4px" title="Excluir">✕</button>
      </div>`;
    });
  }

  el.innerHTML = html;
}


function renderHorasDisc() {
  const el = document.getElementById('horas-disc-list');
  if (!el) return;
  if (!sessoes.length) {
    el.innerHTML = '<p style="color:var(--text-dim);font-size:12px">Inicie sessões de estudo.</p>';
    return;
  }
  const map = {};
  sessoes.forEach(s => { const min = s.durMin != null ? s.durMin : (s.duracao ? Math.round(s.duracao/60) : (s.fim && s.inicio ? Math.round((s.fim-s.inicio)/60000) : 0)); map[s.disciplina] = (map[s.disciplina]||0) + min; });
  const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]);
  const maxMin = sorted[0]?.[1] || 1;
  const colors = ['var(--violet)','var(--cyan)','var(--green)','var(--amber)','var(--blue)','var(--red)'];
  el.innerHTML = sorted.map(([disc,min],i) => `
    <div class="horas-row">
      <div class="disc-name" title="${escHtml(disc)}">${escHtml(disc)}</div>
      <div class="disc-bar-bg">
        <div class="disc-bar-fill" style="width:${(min/maxMin*100).toFixed(0)}%;background:${colors[i%colors.length]}"></div>
      </div>
      <div class="disc-pct">${min>=60?Math.floor(min/60)+'h'+(min%60?String(min%60).padStart(2,'0'):''):min+'m'}</div>
    </div>
  `).join('');
}

// ── Questões ──
function openQuestaoModal() {
  populateEstudosSelects();
  document.getElementById('q-total').value = 10;
  document.getElementById('q-acertos').value = 7;
  document.getElementById('q-fonte').value = '';
  document.getElementById('q-tema').value = '';
  openModal('modal-questao');
}

function saveQuestao() {
  const editId = parseInt(document.getElementById('q-edit-id')?.value) || 0;
  const disc   = document.getElementById('q-disciplina').value;
  const total  = parseInt(document.getElementById('q-total').value) || 0;
  const certas = parseInt(document.getElementById('q-acertos').value) || 0;
  const fonte  = document.getElementById('q-fonte').value.trim();
  const tema   = document.getElementById('q-tema').value.trim();
  const revisao = document.getElementById('q-revisao').value === '1';
  const acerto  = total > 0 ? Math.round((certas/total)*100) : 0;
  const today   = todayLocal();

  if (!disc || total < 1) { showToast('⚠️ Preencha disciplina e questões'); return; }

  if (editId) {
    // Edit existing
    const q = questaoSessoes.find(x => x.id === editId);
    if (q) { q.total = total; q.acertos = certas; q.acerto = acerto; q.fonte = fonte; q.tema = tema; }
    document.getElementById('q-edit-id').value = '';
    document.getElementById('q-delete-btn').style.display = 'none';
    showToast('✏️ Sessão atualizada');
  } else {
    questaoSessoes.push({
      id: nextQId++, disciplina: disc, total, acertos: certas, acerto,
      fonte, tema, data: today,
    });
    if (revisao) {
      const base = new Date(today+'T12:00:00');
      [1,7,15,30].forEach(d => {
        const dt = new Date(base); dt.setDate(dt.getDate()+d);
        revisoesPendentes.push({ id:nextRevId++, data:dateToLocal(dt), tema: disc+(tema?' — '+tema:''), etapa:d });
      });
      showToast('✅ Registrado + revisões agendadas');
    } else {
      showToast('✅ Sessão registrada');
    }
  }
  lsSave();
  scheduleSave();
  closeModal('modal-questao');
  renderDesempenho();
  renderRevisoes();
}



// ══ CURRÍCULO ══
let curriculo = [];

let curNextId = 20;
let curTopicosStatus = {"17_2": "estudado", "4_8": "estudado", "17_19": "estudado", "11_5": "estudado", "11_14": "estudado", "8_9": "estudado", "11_21": "estudado", "17_18": "estudado", "4_3": "estudado", "6_10": "estudado", "7_11": "estudado", "10_5": "estudado", "12_6": "estudado", "16_50": "estudado", "8_71": "pendente", "8_95": "pendente", "16_52": "estudado", "7_17": "pendente", "18_29": "pendente", "12_49": "estudado", "4_0": "estudado", "7_12": "estudado", "8_20": "estudado", "12_42": "estudado", "18_1": "estudado", "13_3": "estudado", "11_4": "estudado", "11_8": "estudado", "11_13": "estudado", "8_91": "pendente", "8_14": "estudado", "8_30": "pendente", "16_45": "estudado", "12_26": "estudado", "6_23": "estudado", "4_22": "estudado", "9_4": "estudado", "7_36": "estudado", "1_6": "estudado", "7_1": "estudado", "8_26": "estudado", "3_40": "estudado", "8_35": "pendente", "17_1": "estudado", "6_69": "estudado", "13_12": "estudado", "18_73": "estudado", "18_49": "estudado", "8_87": "pendente", "18_47": "estudado", "18_80": "estudado", "4_4": "estudado", "8_96": "estudado", "4_16": "estudado", "4_26": "estudado", "6_71": "estudado", "16_43": "estudado", "8_37": "pendente", "8_90": "pendente", "6_44": "pendente", "6_21": "estudado", "8_2": "estudado", "10_4": "estudado", "13_13": "estudado", "12_34": "estudado", "7_19": "estudado", "3_5": "estudado", "8_68": "pendente", "3_0": "estudado", "7_8": "estudado", "8_82": "pendente", "7_50": "estudado", "6_47": "estudado", "7_4": "estudado", "18_10": "estudado", "8_27": "pendente", "8_58": "pendente", "8_83": "pendente", "16_49": "estudado", "8_31": "pendente", "1_4": "estudado", "3_10": "estudado", "12_2": "estudado", "8_25": "estudado", "11_6": "estudado", "8_29": "pendente", "8_49": "pendente", "7_16": "estudado", "9_13": "estudado", "6_8": "estudado", "8_11": "estudado", "3_1": "estudado", "8_36": "pendente", "7_18": "estudado", "12_27": "estudado", "17_3": "estudado", "8_21": "estudado", "6_43": "pendente", "8_4": "estudado", "4_1": "estudado", "8_8": "estudado", "8_16": "estudado", "7_14": "estudado", "18_5": "estudado", "1_22": "pendente", "8_89": "pendente", "8_67": "pendente", "8_53": "pendente", "11_25": "estudado", "8_59": "pendente", "8_54": "pendente", "18_12": "estudado", "18_28": "pendente", "9_2": "estudado", "10_2": "estudado", "9_58": "estudado", "7_51": "pendente", "8_18": "estudado", "8_48": "pendente", "11_10": "estudado", "8_0": "estudado", "8_60": "pendente", "4_14": "estudado", "18_13": "estudado", "18_56": "estudado", "8_12": "estudado", "11_16": "estudado", "9_1": "estudado", "8_44": "pendente", "10_7": "estudado", "8_62": "pendente", "18_71": "estudado", "3_18": "estudado", "12_39": "estudado", "3_21": "estudado", "18_81": "estudado", "18_75": "estudado", "4_21": "estudado", "3_2": "estudado", "8_22": "pendente", "12_0": "estudado", "11_19": "estudado", "12_4": "estudado", "18_78": "estudado", "6_28": "estudado", "6_26": "estudado", "11_9": "estudado", "18_30": "estudado", "13_14": "estudado", "3_4": "estudado", "1_21": "pendente", "8_45": "pendente", "9_6": "estudado", "11_15": "estudado", "8_24": "estudado", "12_33": "estudado", "6_11": "estudado", "7_54": "pendente", "7_53": "pendente", "12_35": "estudado", "16_17": "estudado", "8_34": "pendente", "18_31": "pendente", "11_23": "estudado", "8_19": "estudado", "8_56": "pendente", "8_61": "pendente", "8_92": "pendente", "12_1": "estudado", "10_0": "estudado", "9_3": "estudado", "16_16": "estudado", "12_3": "estudado", "8_32": "pendente", "8_57": "pendente", "18_77": "estudado", "8_85": "pendente", "8_69": "pendente", "1_7": "estudado", "11_12": "estudado", "10_3": "estudado", "8_1": "estudado", "6_42": "estudado", "8_84": "pendente", "18_26": "estudado", "3_22": "estudado", "7_10": "estudado", "4_20": "estudado", "8_64": "pendente", "8_47": "pendente", "8_75": "pendente", "8_78": "pendente", "11_20": "estudado", "18_76": "estudado", "1_1": "estudado", "17_23": "estudado", "8_74": "pendente", "6_3": "estudado", "6_50": "estudado", "7_6": "estudado", "13_0": "estudado", "8_33": "pendente", "8_81": "pendente", "11_24": "estudado", "8_79": "pendente", "18_74": "estudado", "11_18": "estudado", "18_3": "estudado", "18_79": "estudado", "7_7": "estudado", "9_9": "estudado", "18_48": "estudado", "16_42": "estudado", "16_14": "estudado", "7_9": "estudado", "4_18": "estudado", "18_7": "estudado", "8_65": "pendente", "6_51": "estudado", "8_5": "pendente", "8_63": "pendente", "8_42": "pendente", "12_36": "estudado", "9_10": "estudado", "9_15": "estudado", "18_4": "estudado", "8_77": "pendente", "6_52": "estudado", "8_52": "pendente", "8_97": "estudado", "8_70": "pendente", "16_41": "estudado", "8_46": "pendente", "11_11": "estudado", "11_17": "estudado", "8_50": "pendente", "7_0": "pendente", "6_68": "estudado", "7_52": "pendente", "9_57": "estudado", "16_19": "estudado", "11_22": "estudado", "9_16": "estudado", "3_39": "pendente", "8_38": "pendente", "1_20": "pendente", "9_5": "estudado", "7_5": "estudado", "8_66": "pendente", "17_20": "estudado", "6_25": "estudado", "7_55": "pendente", "17_21": "estudado", "16_39": "estudado", "8_80": "pendente", "8_94": "pendente", "8_73": "pendente", "1_8": "estudado", "11_58": "estudado", "8_6": "estudado", "16_40": "estudado", "18_6": "estudado", "1_2": "estudado", "8_17": "estudado", "12_5": "estudado", "16_34": "estudado", "8_55": "pendente", "4_10": "estudado", "12_7": "estudado", "6_70": "estudado", "13_4": "estudado", "8_28": "pendente", "17_4": "estudado", "8_86": "pendente", "12_41": "estudado", "18_72": "estudado", "17_22": "estudado", "8_3": "pendente", "7_2": "estudado", "8_88": "pendente", "9_18": "estudado", "8_39": "pendente", "17_0": "estudado", "8_76": "pendente", "8_40": "pendente", "8_93": "pendente", "8_10": "estudado", "8_51": "pendente", "3_6": "estudado", "10_1": "estudado", "9_11": "estudado", "4_17": "estudado", "11_7": "estudado", "18_11": "estudado", "6_6": "estudado", "13_2": "estudado", "8_72": "pendente", "16_44": "estudado", "10_6": "estudado", "3_3": "estudado", "1_23": "pendente", "12_40": "estudado", "8_23": "estudado", "8_7": "estudado", "8_43": "pendente", "6_29": "estudado", "9_12": "estudado", "3_7": "pendente", "8_15": "estudado", "8_13": "estudado", "8_41": "pendente"}; // "matId_topicoIdx" → "pendente"|"andamento"|"estudado"
let curTopicosData = {"7_12": {"acerto": 64, "date": "2026-06-26", "tempo": 0, "historico": [{"acerto": 64, "date": "2026-06-26", "tempo": 0}]}, "4_0": {"historico": [{"date": "2026-02-01", "tempo": 0, "acerto": 100}], "date": "2026-02-01", "tempo": 0, "acerto": 100}, "12_49": {"acerto": 88, "historico": [{"date": "2026-06-28", "tempo": 0, "acerto": 88}], "tempo": 0, "date": "2026-06-28"}, "18_29": {"date": "2026-06-18", "historico": [{"acerto": 79, "tempo": 28, "date": "2026-06-18"}, {"date": "2026-06-18", "tempo": 28, "acerto": null}], "tempo": 28, "acerto": null}, "16_52": {"tempo": 0, "historico": [{"acerto": 62, "date": "2026-02-22", "tempo": 0}], "date": "2026-02-22", "acerto": 62}, "4_22": {"acerto": 78, "tempo": 0, "date": "2026-02-23", "historico": [{"tempo": 0, "date": "2026-02-23", "acerto": 78}]}, "9_4": {"acerto": 80, "historico": [{"acerto": 80, "date": "2026-03-24", "tempo": 0}], "tempo": 0, "date": "2026-03-24"}, "12_26": {"acerto": 50, "tempo": 0, "historico": [{"acerto": 50, "tempo": 0, "date": "2026-03-06"}], "date": "2026-03-06"}, "6_23": {"acerto": 100, "date": "2026-02-20", "tempo": 0, "historico": [{"acerto": 100, "tempo": 0, "date": "2026-02-20"}]}, "16_45": {"acerto": 100, "historico": [{"acerto": 100, "tempo": 0, "date": "2026-04-14"}], "tempo": 0, "date": "2026-04-14"}, "8_14": {"historico": [{"acerto": 100, "tempo": 0, "date": "2026-03-15"}], "tempo": 0, "date": "2026-03-15", "acerto": 100}, "8_30": "2026-06-25", "8_91": "2026-06-25", "11_13": {"acerto": 100, "tempo": 0, "historico": [{"acerto": 100, "date": "2026-03-05", "tempo": 0}], "date": "2026-03-05"}, "11_8": {"acerto": 100, "date": "2026-02-02", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-02-02", "acerto": 100}]}, "11_4": {"acerto": 100, "date": "2026-02-02", "historico": [{"tempo": 0, "date": "2026-02-02", "acerto": 100}], "tempo": 0}, "13_3": {"acerto": 82, "tempo": 0, "date": "2026-04-05", "historico": [{"acerto": 82, "date": "2026-04-05", "tempo": 0}]}, "18_1": {"date": "2026-02-22", "tempo": 0, "historico": [{"acerto": 100, "date": "2026-02-22", "tempo": 0}], "acerto": 100}, "12_42": {"date": "2026-05-08", "tempo": 0, "historico": [{"acerto": 86, "tempo": 0, "date": "2026-05-08"}], "acerto": 86}, "8_20": {"historico": [{"acerto": null, "tempo": 0, "date": "2026-03-24"}, {"tempo": 0, "date": "2026-03-24", "acerto": 33}], "date": "2026-03-24", "tempo": 0, "acerto": 33}, "4_3": {"acerto": 83, "tempo": 0, "historico": [{"date": "2026-02-11", "tempo": 0, "acerto": 83}], "date": "2026-02-11"}, "17_18": {"acerto": 100, "historico": [{"acerto": 100, "date": "2026-02-02", "tempo": 0}], "date": "2026-02-02", "tempo": 0}, "8_9": {"acerto": 87, "historico": [{"acerto": 93, "tempo": 0, "date": "2026-02-18"}, {"date": "2026-03-15", "tempo": 0, "acerto": 87}], "date": "2026-03-15", "tempo": 0}, "11_21": {"acerto": 75, "date": "2026-04-30", "tempo": 0, "historico": [{"acerto": 75, "date": "2026-04-30", "tempo": 0}]}, "11_14": {"acerto": 50, "historico": [{"acerto": 50, "tempo": 0, "date": "2026-03-05"}], "tempo": 0, "date": "2026-03-05"}, "17_19": {"date": "2026-03-08", "tempo": 0, "historico": [{"date": "2026-03-08", "tempo": 0, "acerto": 75}], "acerto": 75}, "11_5": {"acerto": 50, "date": "2026-02-02", "tempo": 0, "historico": [{"acerto": 50, "tempo": 0, "date": "2026-02-02"}]}, "4_8": {"historico": [{"tempo": 0, "date": "2026-02-01", "acerto": 78}], "date": "2026-02-01", "tempo": 0, "acerto": 78}, "17_2": {"acerto": 86, "date": "2026-02-02", "historico": [{"acerto": 86, "tempo": 0, "date": "2026-02-02"}], "tempo": 0}, "8_95": "2026-06-25", "8_71": "2026-06-25", "12_6": {"date": "2026-04-05", "historico": [{"acerto": 100, "tempo": 0, "date": "2026-04-05"}], "tempo": 0, "acerto": 100}, "16_50": {"acerto": 90, "historico": [{"acerto": 90, "tempo": 0, "date": "2026-03-09"}], "date": "2026-03-09", "tempo": 0}, "10_5": {"acerto": 60, "tempo": 0, "date": "2026-03-31", "historico": [{"acerto": 60, "date": "2026-03-31", "tempo": 0}]}, "7_11": {"acerto": 33, "tempo": 0, "historico": [{"acerto": 33, "date": "2026-04-16", "tempo": 0}], "date": "2026-04-16"}, "6_10": {"tempo": 0, "date": "2026-03-01", "historico": [{"acerto": 100, "tempo": 0, "date": "2026-03-01"}], "acerto": 100}, "8_27": "2026-06-25", "7_4": {"acerto": 67, "historico": [{"acerto": 67, "tempo": 0, "date": "2026-02-27"}, {"date": "2026-02-27", "tempo": 0, "acerto": null}, {"acerto": 67, "tempo": 0, "date": "2026-02-27"}], "tempo": 0, "date": "2026-02-27"}, "18_10": {"acerto": 100, "date": "2026-01-27", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-01-27", "acerto": 100}]}, "6_47": {"historico": [{"acerto": 100, "date": "2026-03-20", "tempo": 0}], "tempo": 0, "date": "2026-03-20", "acerto": 100}, "7_50": {"acerto": 100, "historico": [{"acerto": 100, "date": "2026-02-08", "tempo": 0}], "date": "2026-02-08", "tempo": 0}, "8_82": "2026-06-25", "3_0": {"date": "2026-02-02", "historico": [{"tempo": 0, "date": "2026-02-02", "acerto": 100}], "tempo": 0, "acerto": 100}, "7_8": {"acerto": 0, "historico": [{"acerto": 100, "date": "2026-02-27", "tempo": 0}, {"acerto": null, "tempo": 0, "date": "2026-02-27"}, {"acerto": 0, "tempo": 0, "date": "2026-02-27"}], "tempo": 0, "date": "2026-02-27"}, "7_19": {"acerto": 100, "historico": [{"acerto": 100, "date": "2026-04-16", "tempo": 0}], "date": "2026-04-16", "tempo": 0}, "3_5": {"acerto": 75, "tempo": 0, "historico": [{"acerto": 75, "date": "2026-02-02", "tempo": 0}], "date": "2026-02-02"}, "8_68": "2026-06-25", "13_13": {"historico": [{"date": "2026-03-02", "tempo": 0, "acerto": 89}, {"acerto": 87, "tempo": 0, "date": "2026-04-28"}], "tempo": 0, "date": "2026-04-28", "acerto": 87}, "12_34": {"date": "2026-02-16", "historico": [{"acerto": 82, "tempo": 0, "date": "2026-02-16"}], "tempo": 0, "acerto": 82}, "10_4": {"acerto": 83, "tempo": 0, "historico": [{"acerto": 83, "date": "2026-02-28", "tempo": 0}], "date": "2026-02-28"}, "6_8": {"date": "2026-03-20", "historico": [{"acerto": 76, "tempo": 0, "date": "2026-03-20"}], "tempo": 0, "acerto": 76}, "8_11": {"acerto": 0, "date": "2026-03-15", "historico": [{"acerto": 0, "tempo": 0, "date": "2026-03-15"}], "tempo": 0}, "7_16": {"historico": [{"tempo": 0, "date": "2026-06-25", "acerto": 71}, {"date": "2026-06-25", "tempo": 0, "acerto": 82}, {"acerto": null, "tempo": 0, "date": "2026-06-25"}, {"tempo": 0, "date": "2026-06-25", "acerto": 82}], "date": "2026-06-25", "tempo": 0, "acerto": 82}, "9_13": {"acerto": 100, "tempo": 0, "date": "2025-11-17", "historico": [{"acerto": 100, "date": "2025-11-17", "tempo": 0}]}, "8_49": "2026-06-25", "8_29": "2026-06-25", "11_6": {"acerto": 75, "date": "2026-02-02", "tempo": 0, "historico": [{"acerto": 75, "date": "2026-02-02", "tempo": 0}]}, "8_25": {"acerto": 100, "date": "2026-04-07", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-04-07", "acerto": 100}]}, "3_10": {"acerto": 96, "tempo": 0, "date": "2026-04-07", "historico": [{"tempo": 0, "date": "2026-04-07", "acerto": 96}]}, "12_2": {"acerto": 100, "historico": [{"tempo": 0, "date": "2026-02-14", "acerto": 100}], "tempo": 0, "date": "2026-02-14"}, "1_4": {"tempo": 0, "historico": [{"date": "2026-02-14", "tempo": 0, "acerto": 92}], "date": "2026-02-14", "acerto": 92}, "8_31": "2026-06-25", "16_49": {"historico": [{"date": "2026-02-01", "tempo": 0, "acerto": 68}], "date": "2026-02-01", "tempo": 0, "acerto": 68}, "8_83": "2026-06-25", "8_58": "2026-06-25", "8_87": "2026-06-25", "18_49": {"date": "2026-02-07", "tempo": 0, "historico": [{"acerto": 100, "date": "2026-02-07", "tempo": 0}], "acerto": 100}, "18_73": {"acerto": 85, "date": "2026-01-27", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-01-27", "acerto": 85}]}, "13_12": {"acerto": 67, "date": "2026-03-02", "tempo": 0, "historico": [{"acerto": 67, "date": "2026-03-02", "tempo": 0}]}, "6_69": {"date": "2026-03-01", "historico": [{"tempo": 0, "date": "2026-03-01", "acerto": 67}], "tempo": 0, "acerto": 67}, "17_1": {"acerto": 100, "historico": [{"tempo": 0, "date": "2026-02-02", "acerto": 100}], "date": "2026-02-02", "tempo": 0}, "8_35": "2026-06-25", "7_1": {"historico": [{"acerto": 100, "date": "2026-02-27", "tempo": 0}, {"tempo": 0, "date": "2026-02-27", "acerto": null}, {"acerto": 100, "tempo": 0, "date": "2026-02-19"}], "date": "2026-02-19", "tempo": 0, "acerto": 100}, "3_40": {"tempo": 0, "historico": [{"date": "2026-02-22", "tempo": 0, "acerto": 100}], "date": "2026-02-22", "acerto": 100}, "8_26": {"acerto": 50, "tempo": 0, "date": "2026-04-07", "historico": [{"acerto": 50, "date": "2026-04-07", "tempo": 0}]}, "1_6": {"tempo": 0, "date": "2026-05-13", "historico": [{"acerto": 75, "tempo": 0, "date": "2026-05-13"}], "acerto": 75}, "7_36": {"tempo": 0, "date": "2026-03-19", "historico": [{"tempo": 0, "date": "2026-03-19", "acerto": 100}], "acerto": 100}, "8_2": {"acerto": 75, "tempo": 0, "historico": [{"acerto": 75, "date": "2026-02-04", "tempo": 0}], "date": "2026-02-04"}, "8_90": "2026-06-25", "6_44": {"acerto": null, "date": "2026-06-25", "tempo": 20, "historico": [{"tempo": 20, "date": "2026-06-25", "acerto": 85}, {"tempo": 20, "date": "2026-06-25", "acerto": null}]}, "6_21": {"date": "2026-06-26", "tempo": 0, "historico": [{"acerto": 100, "tempo": 0, "date": "2026-06-26"}], "acerto": 100}, "8_37": "2026-06-25", "16_43": {"acerto": 60, "tempo": 0, "historico": [{"acerto": 60, "date": "2026-04-14", "tempo": 0}], "date": "2026-04-14"}, "6_71": {"acerto": 80, "tempo": 0, "date": "2026-06-24", "historico": [{"acerto": 80, "date": "2026-06-24", "tempo": 0}]}, "4_26": {"acerto": 75, "tempo": 0, "date": "2026-03-13", "historico": [{"acerto": 75, "tempo": 0, "date": "2026-03-13"}]}, "4_16": {"date": "2026-02-11", "tempo": 0, "historico": [{"acerto": 100, "date": "2026-02-11", "tempo": 0}], "acerto": 100}, "8_96": "2026-06-26", "4_4": {"date": "2026-02-01", "historico": [{"acerto": 79, "tempo": 0, "date": "2026-02-01"}], "tempo": 0, "acerto": 79}, "18_80": {"acerto": 89, "date": "2026-03-15", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-03-15", "acerto": 89}]}, "18_47": {"acerto": 88, "date": "2026-02-07", "tempo": 0, "historico": [{"date": "2026-02-07", "tempo": 0, "acerto": 88}]}, "8_44": "2026-06-25", "9_1": {"acerto": 75, "date": "2026-02-12", "historico": [{"acerto": 75, "tempo": 0, "date": "2026-02-12"}], "tempo": 0}, "11_16": {"acerto": 83, "date": "2026-04-07", "tempo": 0, "historico": [{"acerto": 83, "tempo": 0, "date": "2026-04-07"}]}, "8_12": {"acerto": 33, "date": "2026-03-15", "tempo": 0, "historico": [{"acerto": 33, "date": "2026-03-15", "tempo": 0}]}, "18_56": {"acerto": 82, "tempo": 0, "historico": [{"acerto": 82, "date": "2026-04-22", "tempo": 0}], "date": "2026-04-22"}, "4_14": {"acerto": 100, "historico": [{"acerto": 100, "tempo": 0, "date": "2026-02-11"}], "date": "2026-02-11", "tempo": 0}, "18_13": {"historico": [{"date": "2026-01-27", "tempo": 0, "acerto": 88}], "tempo": 0, "date": "2026-01-27", "acerto": 88}, "8_60": "2026-06-25", "8_0": {"acerto": 71, "historico": [{"date": "2026-02-04", "tempo": 0, "acerto": 71}], "date": "2026-02-04", "tempo": 0}, "7_51": {"historico": [{"acerto": 100, "tempo": 0, "date": "2026-02-08"}], "date": "2026-02-08", "tempo": 0, "acerto": 100}, "8_48": "2026-06-25", "8_18": {"historico": [{"date": "2026-03-24", "tempo": 0, "acerto": 75}], "date": "2026-03-24", "tempo": 0, "acerto": 75}, "11_10": {"historico": [{"acerto": 86, "tempo": 0, "date": "2026-02-18"}], "date": "2026-02-18", "tempo": 0, "acerto": 86}, "3_18": {"tempo": 0, "date": "2026-03-17", "historico": [{"acerto": 82, "tempo": 0, "date": "2026-03-17"}], "acerto": 82}, "18_71": "2026-06-27", "8_62": "2026-06-25", "10_7": {"date": "2026-04-19", "historico": [{"acerto": 69, "date": "2026-04-19", "tempo": 0}], "tempo": 0, "acerto": 69}, "8_53": "2026-06-25", "11_25": {"historico": [{"acerto": 71, "date": "2026-04-30", "tempo": 0}], "tempo": 0, "date": "2026-04-30", "acerto": 71}, "8_89": "2026-06-25", "8_67": "2026-06-25", "1_22": {"date": "2026-06-26", "historico": [{"acerto": 81, "tempo": 0, "date": "2026-06-26"}], "tempo": 0, "acerto": 81}, "18_5": {"acerto": 74, "date": "2026-04-08", "tempo": 0, "historico": [{"date": "2026-04-08", "tempo": 0, "acerto": 74}]}, "7_14": {"historico": [{"tempo": 0, "date": "2026-04-16", "acerto": 80}], "date": "2026-04-16", "tempo": 0, "acerto": 80}, "8_16": {"acerto": 64, "historico": [{"date": "2026-03-24", "tempo": 0, "acerto": 64}], "date": "2026-03-24", "tempo": 0}, "8_8": {"acerto": 50, "tempo": 0, "date": "2026-02-18", "historico": [{"tempo": 0, "date": "2026-02-18", "acerto": 50}]}, "4_1": {"acerto": 100, "tempo": 0, "historico": [{"acerto": 100, "tempo": 0, "date": "2026-02-01"}], "date": "2026-02-01"}, "8_4": {"acerto": 80, "historico": [{"acerto": 80, "date": "2026-02-04", "tempo": 0}], "date": "2026-02-04", "tempo": 0}, "6_43": {"acerto": null, "date": "2026-06-25", "historico": [{"acerto": 85, "date": "2026-06-25", "tempo": 20}, {"acerto": null, "tempo": 20, "date": "2026-06-25"}], "tempo": 20}, "8_21": {"acerto": 100, "historico": [{"acerto": 100, "date": "2026-03-24", "tempo": 0}], "date": "2026-03-24", "tempo": 0}, "17_3": {"tempo": 0, "date": "2026-02-02", "historico": [{"acerto": 100, "tempo": 0, "date": "2026-02-02"}], "acerto": 100}, "12_27": {"historico": [{"acerto": 100, "tempo": 0, "date": "2026-03-06"}], "tempo": 0, "date": "2026-03-06", "acerto": 100}, "7_18": {"historico": [{"tempo": 0, "date": "2026-06-25", "acerto": 71}, {"date": "2026-06-25", "tempo": 0, "acerto": null}, {"tempo": 0, "date": "2026-06-23", "acerto": 71}], "date": "2026-06-23", "tempo": 0, "acerto": 71}, "8_36": "2026-06-25", "3_1": {"date": "2026-02-02", "tempo": 0, "historico": [{"date": "2026-02-02", "tempo": 0, "acerto": 50}], "acerto": 50}, "9_58": {"acerto": 60, "date": "2026-03-24", "historico": [{"acerto": 60, "tempo": 0, "date": "2026-03-24"}], "tempo": 0}, "10_2": {"acerto": 100, "historico": [{"tempo": 0, "date": "2026-02-28", "acerto": 100}], "date": "2026-02-28", "tempo": 0}, "18_28": {"acerto": null, "date": "2026-06-18", "historico": [{"acerto": 79, "tempo": 28, "date": "2026-06-18"}, {"acerto": null, "date": "2026-06-18", "tempo": 28}], "tempo": 28}, "9_2": {"acerto": 78, "tempo": 0, "date": "2026-02-12", "historico": [{"acerto": 78, "date": "2026-02-12", "tempo": 0}]}, "8_54": "2026-06-25", "18_12": {"historico": [{"acerto": 80, "date": "2026-02-22", "tempo": 0}], "tempo": 0, "date": "2026-02-22", "acerto": 80}, "8_59": "2026-06-25", "8_24": {"date": "2026-04-07", "historico": [{"acerto": 75, "tempo": 0, "date": "2026-04-07"}], "tempo": 0, "acerto": 75}, "11_15": {"acerto": 60, "historico": [{"date": "2026-04-07", "tempo": 0, "acerto": 60}], "date": "2026-04-07", "tempo": 0}, "9_6": {"acerto": 70, "tempo": 0, "date": "2026-03-24", "historico": [{"acerto": 70, "date": "2026-03-24", "tempo": 0}]}, "8_45": "2026-06-25", "1_21": {"historico": [{"date": "2026-03-06", "tempo": 0, "acerto": 100}], "date": "2026-03-06", "tempo": 0, "acerto": 100}, "3_4": {"historico": [{"acerto": null, "tempo": 0, "date": "2026-02-02"}, {"tempo": 0, "date": "2026-02-02", "acerto": 100}], "date": "2026-02-02", "tempo": 0, "acerto": 100}, "8_19": {"tempo": 0, "date": "2026-03-24", "historico": [{"acerto": 33, "date": "2026-03-24", "tempo": 0}], "acerto": 33}, "18_31": {"acerto": null, "date": "2026-06-18", "historico": [{"acerto": 79, "date": "2026-06-18", "tempo": 28}, {"acerto": null, "date": "2026-06-18", "tempo": 28}], "tempo": 28}, "11_23": {"acerto": 100, "date": "2026-04-30", "historico": [{"acerto": 100, "date": "2026-04-30", "tempo": 0}], "tempo": 0}, "8_34": "2026-06-25", "16_17": {"acerto": 100, "tempo": 0, "date": "2026-03-09", "historico": [{"tempo": 0, "date": "2026-03-09", "acerto": 100}]}, "12_35": {"acerto": 81, "date": "2026-02-16", "historico": [{"acerto": 81, "date": "2026-02-16", "tempo": 0}], "tempo": 0}, "7_53": {"acerto": 100, "tempo": 0, "date": "2026-02-08", "historico": [{"acerto": 100, "date": "2026-06-26", "tempo": 0}, {"acerto": 100, "tempo": 0, "date": "2026-02-08"}]}, "6_11": {"acerto": 100, "historico": [{"date": "2026-03-01", "tempo": 0, "acerto": 100}], "date": "2026-03-01", "tempo": 0}, "7_54": {"date": "2026-06-26", "historico": [{"acerto": 100, "date": "2026-06-26", "tempo": 0}], "tempo": 0, "acerto": 100}, "12_33": {"acerto": 100, "date": "2026-02-16", "historico": [{"acerto": 100, "date": "2026-02-16", "tempo": 0}], "tempo": 0}, "18_78": {"acerto": 92, "tempo": 0, "historico": [{"date": "2026-03-20", "tempo": 0, "acerto": 92}], "date": "2026-03-20"}, "12_4": {"tempo": 0, "historico": [{"date": "2026-04-05", "tempo": 0, "acerto": 79}], "date": "2026-04-05", "acerto": 79}, "12_0": {"tempo": 0, "date": "2026-02-14", "historico": [{"acerto": 100, "date": "2026-02-14", "tempo": 0}], "acerto": 100}, "11_19": {"acerto": 100, "historico": [{"acerto": 100, "tempo": 0, "date": "2026-04-30"}], "tempo": 0, "date": "2026-04-30"}, "8_22": "2026-06-25", "3_2": {"date": "2026-02-02", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-02-02", "acerto": 83}], "acerto": 83}, "4_21": {"historico": [{"acerto": 78, "tempo": 0, "date": "2026-03-03"}], "date": "2026-03-03", "tempo": 0, "acerto": 78}, "18_75": {"acerto": 75, "date": "2026-02-07", "historico": [{"acerto": 75, "date": "2026-02-07", "tempo": 0}], "tempo": 0}, "18_81": {"acerto": 81, "tempo": 0, "historico": [{"tempo": 0, "date": "2026-06-04", "acerto": 81}], "date": "2026-06-04"}, "3_21": {"acerto": 100, "date": "2026-02-22", "historico": [{"date": "2026-02-22", "tempo": 0, "acerto": 100}], "tempo": 0}, "12_39": {"historico": [{"acerto": 50, "tempo": 0, "date": "2026-05-08"}], "date": "2026-05-08", "tempo": 0, "acerto": 50}, "13_14": {"date": "2026-03-02", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-03-02", "acerto": 50}], "acerto": 50}, "18_30": {"acerto": 75, "historico": [{"date": "2026-04-14", "tempo": 0, "acerto": 100}, {"date": "2026-04-18", "tempo": 0, "acerto": 75}], "tempo": 0, "date": "2026-04-18"}, "11_9": {"historico": [{"date": "2026-02-18", "tempo": 0, "acerto": 100}], "date": "2026-02-18", "tempo": 0, "acerto": 100}, "6_26": {"date": "2026-02-20", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-02-20", "acerto": 75}], "acerto": 75}, "6_28": {"acerto": 78, "tempo": 0, "historico": [{"date": "2026-02-20", "tempo": 0, "acerto": 78}], "date": "2026-02-20"}, "8_64": "2026-06-25", "4_20": {"acerto": 67, "date": "2026-04-23", "historico": [{"date": "2026-04-23", "tempo": 0, "acerto": 67}], "tempo": 0}, "7_10": {"date": "2026-03-19", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-03-19", "acerto": 100}], "acerto": 100}, "3_22": {"acerto": 89, "tempo": 0, "historico": [{"date": "2026-02-22", "tempo": 0, "acerto": 89}], "date": "2026-02-22"}, "18_26": {"tempo": 0, "historico": [{"acerto": 88, "date": "2026-04-14", "tempo": 0}, {"date": "2026-04-18", "tempo": 0, "acerto": 80}], "date": "2026-04-18", "acerto": 80}, "8_84": "2026-06-25", "6_42": {"date": "2026-06-24", "historico": [{"acerto": 85, "tempo": 20, "date": "2026-06-25"}, {"date": "2026-06-25", "tempo": 20, "acerto": null}, {"acerto": 100, "date": "2026-06-24", "tempo": 20}], "tempo": 20, "acerto": 100}, "8_74": "2026-06-25", "17_23": {"acerto": 75, "historico": [{"date": "2026-05-15", "tempo": 0, "acerto": 75}], "date": "2026-05-15", "tempo": 0}, "18_76": {"date": "2026-02-19", "tempo": 0, "historico": [{"acerto": 81, "tempo": 0, "date": "2026-02-19"}], "acerto": 81}, "1_1": {"acerto": 90, "tempo": 0, "date": "2026-03-06", "historico": [{"date": "2026-03-06", "tempo": 0, "acerto": 90}]}, "11_20": {"historico": [{"acerto": 100, "date": "2026-04-30", "tempo": 0}], "tempo": 0, "date": "2026-04-30", "acerto": 100}, "8_78": "2026-06-25", "8_75": "2026-06-25", "8_47": "2026-06-25", "8_57": "2026-06-25", "8_32": "2026-06-25", "12_3": {"tempo": 0, "historico": [{"date": "2026-03-01", "tempo": 0, "acerto": 96}], "date": "2026-03-01", "acerto": 96}, "16_16": {"acerto": 67, "historico": [{"date": "2026-03-09", "tempo": 0, "acerto": 67}], "tempo": 0, "date": "2026-03-09"}, "10_0": {"acerto": 100, "date": "2026-03-31", "historico": [{"acerto": 100, "tempo": 0, "date": "2026-03-31"}], "tempo": 0}, "9_3": {"historico": [{"acerto": 100, "tempo": 0, "date": "2026-03-24"}], "tempo": 0, "date": "2026-03-24", "acerto": 100}, "12_1": {"acerto": 100, "date": "2026-02-14", "historico": [{"date": "2026-02-14", "tempo": 0, "acerto": 100}], "tempo": 0}, "8_92": "2026-06-25", "8_61": "2026-06-25", "8_56": "2026-06-25", "10_3": {"acerto": 82, "date": "2026-02-28", "tempo": 0, "historico": [{"acerto": 82, "date": "2026-02-28", "tempo": 0}]}, "8_1": {"historico": [{"acerto": 88, "date": "2026-02-04", "tempo": 0}], "date": "2026-02-04", "tempo": 0, "acerto": 88}, "11_12": {"historico": [{"tempo": 0, "date": "2026-03-05", "acerto": 100}], "tempo": 0, "date": "2026-03-05", "acerto": 100}, "1_7": {"tempo": 0, "historico": [{"acerto": 50, "date": "2026-05-13", "tempo": 0}], "date": "2026-05-13", "acerto": 50}, "8_85": "2026-06-25", "8_69": "2026-06-25", "18_77": {"acerto": 71, "historico": [{"acerto": 71, "tempo": 0, "date": "2026-03-20"}], "date": "2026-03-20", "tempo": 0}, "9_15": {"acerto": 33, "historico": [{"tempo": 0, "date": "2025-11-17", "acerto": 33}], "tempo": 0, "date": "2025-11-17"}, "18_4": {"acerto": 20, "tempo": 0, "historico": [{"acerto": 20, "tempo": 0, "date": "2026-03-17"}], "date": "2026-03-17"}, "12_36": {"tempo": 0, "date": "2026-03-10", "historico": [{"tempo": 0, "date": "2026-03-10", "acerto": 47}], "acerto": 47}, "9_10": {"tempo": 0, "historico": [{"acerto": 92, "tempo": 0, "date": "2026-04-14"}], "date": "2026-04-14", "acerto": 92}, "8_42": "2026-06-25", "8_63": "2026-06-25", "8_5": "2026-06-25", "6_51": {"historico": [{"acerto": 100, "date": "2026-03-31", "tempo": 0}], "tempo": 0, "date": "2026-03-31", "acerto": 100}, "8_65": "2026-06-25", "7_0": "2026-06-25", "8_50": "2026-06-25", "6_68": {"acerto": 100, "date": "2026-02-04", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-02-04", "acerto": 100}]}, "11_17": {"acerto": 100, "tempo": 0, "date": "2026-04-07", "historico": [{"tempo": 0, "date": "2026-04-07", "acerto": 100}]}, "8_46": "2026-06-25", "11_11": {"acerto": 100, "tempo": 0, "date": "2026-06-27", "historico": [{"acerto": 100, "tempo": 0, "date": "2026-06-27"}]}, "16_41": {"acerto": 100, "tempo": 0, "date": "2026-04-14", "historico": [{"acerto": 100, "date": "2026-04-14", "tempo": 0}]}, "8_70": "2026-06-25", "8_97": {"acerto": 68, "date": "2026-06-23", "historico": [{"acerto": 68, "tempo": 0, "date": "2026-06-23"}], "tempo": 0}, "8_52": "2026-06-25", "6_52": {"date": "2026-03-31", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-03-31", "acerto": null}], "acerto": null}, "8_77": "2026-06-25", "18_74": {"acerto": 100, "tempo": 0, "historico": [{"tempo": 0, "date": "2026-01-27", "acerto": 100}], "date": "2026-01-27"}, "8_79": "2026-06-25", "11_24": {"acerto": 100, "tempo": 0, "date": "2026-04-30", "historico": [{"date": "2026-04-30", "tempo": 0, "acerto": 100}]}, "8_81": "2026-06-25", "8_33": "2026-06-25", "13_0": {"date": "2026-02-16", "historico": [{"tempo": 0, "date": "2026-02-16", "acerto": 100}], "tempo": 0, "acerto": 100}, "7_6": {"tempo": 0, "historico": [{"acerto": 100, "date": "2026-02-27", "tempo": 0}, {"date": "2026-02-27", "tempo": 0, "acerto": null}, {"acerto": 100, "tempo": 0, "date": "2026-02-27"}], "date": "2026-02-27", "acerto": 100}, "6_50": {"tempo": 0, "date": "2026-03-31", "historico": [{"tempo": 0, "date": "2026-03-31", "acerto": 75}], "acerto": 75}, "6_3": {"date": "2026-06-26", "historico": [{"acerto": 75, "tempo": 0, "date": "2026-06-26"}], "tempo": 0, "acerto": 75}, "18_7": {"date": "2026-02-22", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-02-22", "acerto": 80}], "acerto": 80}, "4_18": {"acerto": 64, "historico": [{"tempo": 0, "date": "2026-04-23", "acerto": 64}], "date": "2026-04-23", "tempo": 0}, "7_9": {"acerto": 94, "date": "2026-03-19", "historico": [{"date": "2026-03-19", "tempo": 35, "acerto": 94}], "tempo": 35}, "16_14": {"date": "2026-03-09", "historico": [{"acerto": 25, "date": "2026-03-09", "tempo": 0}], "tempo": 0, "acerto": 25}, "18_48": {"date": "2026-02-07", "historico": [{"acerto": 83, "date": "2026-02-07", "tempo": 0}], "tempo": 0, "acerto": 83}, "16_42": {"date": "2026-04-14", "historico": [{"date": "2026-04-14", "tempo": 0, "acerto": 33}], "tempo": 0, "acerto": 33}, "9_9": {"acerto": 56, "historico": [{"date": "2026-04-14", "tempo": 0, "acerto": 56}], "tempo": 0, "date": "2026-04-14"}, "7_7": {"acerto": 86, "tempo": 0, "date": "2026-04-14", "historico": [{"date": "2026-02-27", "tempo": 0, "acerto": 86}, {"acerto": null, "date": "2026-02-27", "tempo": 0}, {"date": "2026-02-27", "tempo": 0, "acerto": 86}, {"acerto": 86, "date": "2026-04-14", "tempo": 0}]}, "18_79": {"acerto": 94, "date": "2026-03-15", "tempo": 0, "historico": [{"date": "2026-03-15", "tempo": 0, "acerto": 94}]}, "18_3": {"acerto": 71, "date": "2026-03-17", "tempo": 0, "historico": [{"date": "2026-03-17", "tempo": 0, "acerto": 71}]}, "11_18": {"acerto": 80, "historico": [{"tempo": 0, "date": "2026-04-07", "acerto": 80}], "date": "2026-04-07", "tempo": 0}, "13_4": {"acerto": 100, "date": "2026-02-16", "tempo": 0, "historico": [{"acerto": 100, "tempo": 0, "date": "2026-02-16"}]}, "12_7": {"date": "2026-04-05", "historico": [{"date": "2026-04-05", "tempo": 0, "acerto": 100}], "tempo": 0, "acerto": 100}, "6_70": {"historico": [{"acerto": 100, "tempo": 0, "date": "2026-06-24"}], "tempo": 0, "date": "2026-06-24", "acerto": 100}, "4_10": {"date": "2026-03-13", "tempo": 0, "historico": [{"acerto": 81, "date": "2026-03-13", "tempo": 0}], "acerto": 81}, "16_34": {"historico": [{"acerto": 73, "tempo": 0, "date": "2026-04-14"}], "date": "2026-04-14", "tempo": 0, "acerto": 73}, "8_55": "2026-06-25", "12_5": {"historico": [{"tempo": 0, "date": "2026-04-05", "acerto": 100}], "tempo": 0, "date": "2026-04-05", "acerto": 100}, "8_17": {"acerto": 0, "tempo": 0, "historico": [{"date": "2026-03-24", "tempo": 0, "acerto": 0}], "date": "2026-03-24"}, "1_2": {"historico": [{"acerto": 85, "tempo": 0, "date": "2026-02-14"}], "tempo": 0, "date": "2026-02-14", "acerto": 85}, "16_40": {"acerto": 75, "date": "2026-03-09", "tempo": 0, "historico": [{"date": "2026-03-09", "tempo": 0, "acerto": 75}]}, "18_6": {"historico": [{"date": "2026-02-22", "tempo": 0, "acerto": 89}, {"date": "2026-03-17", "tempo": 0, "acerto": 60}], "tempo": 0, "date": "2026-03-17", "acerto": 60}, "17_0": {"acerto": 100, "date": "2026-02-02", "historico": [{"acerto": 100, "date": "2026-02-02", "tempo": 0}], "tempo": 0}, "9_18": {"acerto": 50, "tempo": 0, "historico": [{"acerto": 50, "tempo": 0, "date": "2025-11-17"}], "date": "2025-11-17"}, "8_39": "2026-06-25", "8_88": "2026-06-25", "7_2": {"acerto": 50, "tempo": 0, "date": "2026-02-27", "historico": [{"acerto": 50, "tempo": 0, "date": "2026-02-27"}, {"acerto": null, "tempo": 0, "date": "2026-02-27"}, {"acerto": 50, "tempo": 0, "date": "2026-02-27"}]}, "8_3": "2026-06-25", "17_22": {"acerto": 50, "date": "2026-05-15", "tempo": 0, "historico": [{"date": "2026-05-15", "tempo": 0, "acerto": 50}]}, "12_41": {"acerto": 67, "date": "2026-05-08", "historico": [{"acerto": 67, "tempo": 0, "date": "2026-05-08"}], "tempo": 0}, "18_72": {"tempo": 60, "historico": [{"acerto": 70, "tempo": 60, "date": "2026-06-25"}, {"acerto": 70, "tempo": 60, "date": "2026-01-27"}], "date": "2026-01-27", "acerto": 70}, "8_86": "2026-06-25", "17_4": {"historico": [{"acerto": 88, "date": "2026-02-02", "tempo": 0}], "date": "2026-02-02", "tempo": 0, "acerto": 88}, "8_28": "2026-06-25", "17_21": {"tempo": 0, "historico": [{"acerto": 100, "tempo": 0, "date": "2026-05-15"}, {"date": "2026-05-15", "tempo": 0, "acerto": 86}], "date": "2026-05-15", "acerto": 86}, "7_55": {"acerto": 94, "historico": [{"date": "2026-02-08", "tempo": 0, "acerto": 94}], "date": "2026-02-08", "tempo": 0}, "17_20": {"acerto": 80, "tempo": 0, "date": "2026-04-14", "historico": [{"date": "2026-04-14", "tempo": 0, "acerto": 80}]}, "6_25": {"acerto": 60, "tempo": 0, "historico": [{"acerto": 60, "date": "2026-02-20", "tempo": 0}], "date": "2026-02-20"}, "8_66": "2026-06-25", "7_5": {"acerto": 100, "tempo": 0, "historico": [{"acerto": 100, "tempo": 0, "date": "2026-02-27"}, {"date": "2026-02-27", "tempo": 0, "acerto": null}, {"date": "2026-02-27", "tempo": 0, "acerto": 100}], "date": "2026-02-27"}, "9_5": {"acerto": 86, "historico": [{"tempo": 0, "date": "2026-03-24", "acerto": 86}], "tempo": 0, "date": "2026-03-24"}, "1_20": {"tempo": 0, "date": "2026-02-14", "historico": [{"date": "2026-02-14", "tempo": 0, "acerto": 75}], "acerto": 75}, "8_38": "2026-06-25", "11_22": {"acerto": 0, "tempo": 0, "historico": [{"tempo": 0, "date": "2026-04-30", "acerto": 0}], "date": "2026-04-30"}, "9_16": {"historico": [{"acerto": 100, "tempo": 0, "date": "2025-11-17"}], "date": "2025-11-17", "tempo": 0, "acerto": 100}, "16_19": {"date": "2026-03-09", "tempo": 0, "historico": [{"acerto": 67, "date": "2026-03-09", "tempo": 0}], "acerto": 67}, "9_57": {"acerto": 33, "date": "2026-02-12", "tempo": 0, "historico": [{"acerto": 33, "tempo": 0, "date": "2026-02-12"}]}, "7_52": {"acerto": 50, "historico": [{"date": "2026-02-08", "tempo": 0, "acerto": 50}], "date": "2026-02-08", "tempo": 0}, "8_6": {"acerto": 100, "historico": [{"tempo": 0, "date": "2026-02-18", "acerto": 100}], "date": "2026-02-18", "tempo": 0}, "11_58": {"acerto": 100, "tempo": 0, "historico": [{"tempo": 0, "date": "2026-02-02", "acerto": 70}, {"tempo": 0, "date": "2026-02-18", "acerto": 83}, {"acerto": 100, "tempo": 0, "date": "2026-04-07"}, {"date": "2026-04-30", "tempo": 0, "acerto": 100}], "date": "2026-04-30"}, "1_8": {"acerto": 50, "tempo": 0, "historico": [{"tempo": 0, "date": "2026-05-13", "acerto": 50}], "date": "2026-05-13"}, "8_73": "2026-06-25", "8_80": "2026-06-25", "8_94": "2026-06-25", "16_39": {"date": "2026-02-22", "historico": [{"acerto": 92, "date": "2026-02-22", "tempo": 0}], "tempo": 0, "acerto": 92}, "1_23": {"acerto": 100, "historico": [{"date": "2026-03-30", "tempo": 0, "acerto": 100}], "date": "2026-03-30", "tempo": 0}, "3_3": {"acerto": 100, "historico": [{"tempo": 0, "date": "2026-02-02", "acerto": 100}], "date": "2026-02-02", "tempo": 0}, "10_6": {"historico": [{"acerto": 93, "date": "2026-03-31", "tempo": 0}], "date": "2026-03-31", "tempo": 0, "acerto": 93}, "16_44": {"historico": [{"date": "2026-04-14", "tempo": 0, "acerto": 0}], "tempo": 0, "date": "2026-04-14", "acerto": 0}, "8_72": "2026-06-25", "13_2": {"date": "2026-02-16", "historico": [{"date": "2026-02-16", "tempo": 0, "acerto": 83}], "tempo": 0, "acerto": 83}, "6_6": {"acerto": 77, "date": "2026-03-01", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-03-01", "acerto": 77}]}, "18_11": {"historico": [{"acerto": 0, "tempo": 0, "date": "2026-01-27"}], "date": "2026-01-27", "tempo": 0, "acerto": 0}, "11_7": {"date": "2026-02-02", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-02-02", "acerto": 88}], "acerto": 88}, "8_41": "2026-06-25", "8_13": {"date": "2026-03-15", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-03-15", "acerto": 100}], "acerto": 100}, "8_15": {"tempo": 0, "historico": [{"acerto": 100, "tempo": 0, "date": "2026-03-15"}], "date": "2026-03-15", "acerto": 100}, "3_7": {"date": "2026-06-25", "historico": [{"acerto": 86, "tempo": 60, "date": "2026-06-25"}, {"tempo": 60, "date": "2026-06-25", "acerto": null}, {"tempo": 60, "date": "2026-06-25", "acerto": null}, {"acerto": null, "tempo": 60, "date": "2026-06-25"}, {"date": "2026-06-25", "tempo": 60, "acerto": null}, {"acerto": null, "tempo": 60, "date": "2026-06-25"}], "tempo": 60, "acerto": null}, "9_12": {"historico": [{"date": "2025-11-17", "tempo": 0, "acerto": 60}], "date": "2025-11-17", "tempo": 0, "acerto": 60}, "6_29": {"acerto": 100, "date": "2026-02-20", "tempo": 0, "historico": [{"tempo": 0, "date": "2026-02-20", "acerto": 100}]}, "8_43": "2026-06-25", "8_7": {"acerto": 57, "date": "2026-02-18", "historico": [{"tempo": 0, "date": "2026-02-18", "acerto": 57}], "tempo": 0}, "8_23": {"acerto": 100, "date": "2026-04-07", "historico": [{"acerto": 100, "tempo": 0, "date": "2026-04-07"}], "tempo": 0}, "12_40": {"tempo": 0, "historico": [{"date": "2026-05-08", "tempo": 0, "acerto": 67}], "date": "2026-05-08", "acerto": 67}, "8_10": {"acerto": 100, "historico": [{"acerto": 100, "tempo": 0, "date": "2026-03-15"}], "tempo": 0, "date": "2026-03-15"}, "8_93": "2026-06-25", "8_40": "2026-06-25", "8_76": "2026-06-25", "4_17": {"tempo": 0, "date": "2026-04-23", "historico": [{"acerto": 64, "date": "2026-04-23", "tempo": 0}], "acerto": 64}, "9_11": {"tempo": 0, "historico": [{"acerto": 100, "tempo": 0, "date": "2025-11-17"}], "date": "2025-11-17", "acerto": 100}, "10_1": {"acerto": 91, "historico": [{"acerto": 91, "date": "2026-02-14", "tempo": 0}], "date": "2026-02-14", "tempo": 0}, "3_6": {"acerto": 91, "historico": [{"acerto": 91, "date": "2026-03-17", "tempo": 0}], "tempo": 0, "date": "2026-03-17"}, "8_51": "2026-06-25"}; // "matId_topicoIdx" → "YYYY-MM-DD"
let curSelectedMatId = 1;
let curFilter = 'todos';
let curEditTopicoIdx = null;
let estudosActiveTab = 'painel';

// ── Tabs ──
function switchEstudosTab(tab, btn) {
  estudosActiveTab = tab;
  document.querySelectorAll('.estudos-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const container = document.getElementById('estudos-tab-content');
  if (!container) return;

  if (tab === 'foco') {
    renderFocoTab();
  } else if (tab === 'painel') {
    container.innerHTML = buildEstudosPainelHTML();
    renderEstudosPainel();
  } else if (tab === 'desempenho') {
    container.innerHTML = buildDesempenhoHTML();
    renderDesempenho();
  } else if (tab === 'consistencia') {
    container.innerHTML = '<div id="consist-root"></div>';
    renderConsistencia();
  } else if (tab === 'kanban-estudo') {
    container.innerHTML = '<div id="kbe-root" style="height:100%;min-height:0"></div>';
    renderKanbanEstudo();
  }
}

// ── Helpers ──
function curGetStatus(mid, idx) {
  return curTopicosStatus[mid+'_'+idx] || 'pendente';
}
function curNextStatus(s) {
  return s==='pendente' ? 'andamento' : s==='andamento' ? 'estudado' : 'pendente';
}
function curToggle(mid, idx) {
  // curToggle now only cycles pendente <-> andamento (NOT to estudado via click)
  // Studied status is ONLY set via 📖 register or ✓ button
  const cur = curGetStatus(mid, idx);
  if (cur === 'pendente') {
    curTopicosStatus[mid+'_'+idx] = 'andamento';
  } else if (cur === 'andamento') {
    curTopicosStatus[mid+'_'+idx] = 'pendente';
  }
  // 'estudado' → no change via toggle
  lsSave();
  scheduleSave();
  if (estudosActiveTab === 'desempenho') {
    renderDesempenho();
    return;
  }
  const searchInp = document.getElementById('cur-search');
  if (searchInp && searchInp.value && searchInp.value.length >= 2) {
    curDoSearch(searchInp.value);
    renderCurriculoSidebar();
    renderCurriculoHeader();
    renderCurriculoGeral();
  } else {
    renderEstudosCur();
  }
}

function curSetStatus(mid, idx, status) {
  curTopicosStatus[mid+'_'+idx] = status;
  // Only set date if no historico exists (don't overwrite registered sessions)
  if (status === 'estudado') {
    var existing = curTopicosData[mid+'_'+idx];
    if (!existing || typeof existing === 'string') {
      curTopicosData[mid+'_'+idx] = todayLocal();
    }
    // If object with historico, keep it as is
  }
  // NEVER clear data when changing status — only deleteHistoricoSession can do that
  lsSave();
  scheduleSave();
  renderEstudosCur();
}
function curMatStats(mat) {
  const total    = mat.topicos.length;
  const estudado = mat.topicos.filter((_,i) => curGetStatus(mat.id,i) === 'estudado').length;
  const andamento= mat.topicos.filter((_,i) => curGetStatus(mat.id,i) === 'andamento').length;
  const pendente = total - estudado - andamento;
  const pct = total ? Math.round(estudado/total*100) : 0;
  return {total, estudado, andamento, pendente, pct};
}



// ── Render ──











function buildEstudosPainelHTML() {
  return `
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
    <div class="meta-ring-wrap" style="margin-bottom:0">
      <div class="meta-ring">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="30" fill="none" stroke="var(--border)" stroke-width="6"/>
          <circle id="meta-ring-circle" cx="36" cy="36" r="30" fill="none" stroke="var(--green)" stroke-width="6"
            stroke-dasharray="188.5" stroke-dashoffset="188.5" stroke-linecap="round" style="transition:stroke-dashoffset 0.5s ease"/>
        </svg>
        <div class="meta-ring-label">
          <span class="meta-ring-val" id="meta-ring-val">0h</span>
          <span class="meta-ring-sub">de 3h</span>
        </div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">Meta diária</div>
        <div class="streak-badge">🔥 <span id="streak-val">0</span> dias seguidos</div>
      </div>
    </div>
    <div style="flex:1;min-width:200px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:11px;color:var(--text-muted)">Progresso semanal</span>
        <span style="font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--text-muted)" id="semana-progress-label">0/0 atividades</span>
      </div>
      <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden">
        <div id="semana-progress-bar" style="height:100%;background:linear-gradient(90deg,var(--violet),var(--cyan));border-radius:4px;width:0%;transition:width 0.5s ease"></div>
      </div>
    </div>
    <button class="btn btn-primary btn-sm" onclick="openAtividadeModal()">+ Atividade</button>
  </div>

  <div class="estudos-painel-grid">

    <!-- COLUNA PRINCIPAL (esquerda) -->
    <div style="display:flex;flex-direction:column;gap:14px">

      <div class="estudos-card">
        <div class="estudos-card-header">
          <span class="estudos-card-title">📚 Backlog de Metas</span>
          <button class="btn btn-primary btn-sm" onclick="openAddEstudoBacklog()">+ Adicionar</button>
        </div>
        <div class="estudos-card-body" id="estudos-backlog-list">
          <p style="color:var(--text-dim);font-size:12px">Nenhum item. Clique em "+ Adicionar".</p>
        </div>
      </div>

      <div class="estudos-card">
        <div class="estudos-card-header">
          <span class="estudos-card-title">📋 Semana de Estudos</span>
          <div style="display:flex;align-items:center;gap:4px">
            <button class="btn btn-ghost btn-sm" style="padding:2px 8px" onclick="semanaNav(-1)">‹</button>
            <span style="font-size:11px;color:var(--text-dim);min-width:90px;text-align:center" id="semana-label"></span>
            <button class="btn btn-ghost btn-sm" style="padding:2px 8px" onclick="semanaNav(1)">›</button>
            <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:10px;color:var(--text-dim)" onclick="semanaNav(0)">Hoje</button>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="openAtividadeModal()">+ Add</button>
        </div>
        <div class="estudos-card-body">
          <div class="semana-dias" id="semana-dias"></div>
          <div id="atividades-list"></div>
        </div>
      </div>

      <div class="estudos-card">
        <div class="estudos-card-header">
          <span class="estudos-card-title">📊 Sessões registradas</span>
        </div>
        <div class="estudos-card-body" id="sessoes-list">
          <p style="color:var(--text-dim);font-size:12px">Nenhuma sessão ainda.</p>
        </div>
      </div>

    </div>

    <!-- COLUNA LATERAL (direita, 300px) -->
    <div style="display:flex;flex-direction:column;gap:14px">

      <div class="estudos-card">
        <div class="estudos-card-header">
          <span class="estudos-card-title">⏱ Cronômetro</span>
        </div>
        <div class="estudos-card-body" style="text-align:center;padding:14px 12px">
          <div style="display:flex;justify-content:center;gap:4px;margin-bottom:12px">
            <button class="btn btn-ghost btn-sm" id="timer-mode-livre" onclick="timerSetMode('livre')" style="font-size:11px;padding:3px 10px;border-radius:12px">Livre</button>
            <button class="btn btn-ghost btn-sm" id="timer-mode-pomodoro" onclick="timerSetMode('pomodoro')" style="font-size:11px;padding:3px 10px;border-radius:12px">Pomodoro</button>
          </div>
          <div class="timer-display" id="timer-display" style="font-size:36px">00:00</div>
          <div id="timer-phase-label" style="font-size:11px;color:var(--text-dim);margin:4px 0 10px"></div>
          <div id="timer-pomodoro-info" style="display:none;margin-bottom:8px">
            <div style="display:flex;justify-content:center;gap:6px" id="timer-pomo-dots"></div>
            <div style="font-size:10px;color:var(--text-dim);margin-top:4px" id="timer-pomo-count"></div>
          </div>
          <div class="timer-btns">
            <button class="timer-btn start" id="timer-start-btn" onclick="timerStart()">▶ Iniciar</button>
            <button class="timer-btn pause" id="timer-pause-btn" onclick="timerPause()" style="display:none">⏸ Pausar</button>
            <button class="timer-btn stop" id="timer-stop-btn" onclick="timerStop()" style="display:none">⏹ Parar</button>
          </div>
        </div>
      </div>

      <div class="estudos-card">
        <div class="estudos-card-header">
          <span class="estudos-card-title">🔁 Revisões pendentes</span>
          <span class="count-pill" id="revisoes-count">0</span>
        </div>
        <div class="estudos-card-body" id="revisoes-list">
          <p style="color:var(--text-dim);font-size:12px">Nenhuma revisão.</p>
        </div>
      </div>

      <div class="estudos-card">
        <div class="estudos-card-header">
          <span class="estudos-card-title">🎯 Desempenho</span>
          <button class="btn btn-ghost btn-sm" onclick="openQuestaoModal()">+ Questões</button>
        </div>
        <div class="estudos-card-body" id="desempenho-list">
          <p style="color:var(--text-dim);font-size:12px">Registre questões.</p>
        </div>
      </div>

      <div class="estudos-card">
        <div class="estudos-card-header">
          <span class="estudos-card-title">⏰ Horas por disciplina</span>
        </div>
        <div class="estudos-card-body" id="horas-disc-list">
          <p style="color:var(--text-dim);font-size:12px">Inicie sessões.</p>
        </div>
      </div>

    </div>
  </div>`;
}



function renderEstudosPainel() {
  populateEstudosSelects();
  renderSemana();
  renderEstudosBacklog();
  renderAtividades();
  renderDesempenho();
  renderHorasDisc();
  renderRevisoes();
  renderSessoes();
  updateMetaRing();
  updateStreak();
  updateSemanaProgress();
  if (timerInterval) {
    const sb = document.getElementById('timer-start-btn');
    const pb = document.getElementById('timer-pause-btn');
    const tb = document.getElementById('timer-stop-btn');
    if (sb) sb.style.display = 'none';
    if (pb) pb.style.display = 'inline-block';
    if (tb) tb.style.display = 'inline-block';
  }
}











// ══ CURRICULO CRUD — FUNÇÕES RESTAURADAS ══


function deleteMateriaAtual() {
  const mat = curriculo.find(m => m.id === curSelectedMatId);
  if (!mat) return;
  if (!confirm('Excluir matéria "' + mat.nome + '" e todos os seus tópicos?')) return;
  curriculo = curriculo.filter(m => m.id !== curSelectedMatId);
  curSelectedMatId = curriculo[0]?.id || null;
  closeModal('modal-materia');
  lsSave();
  renderEstudosCur();
  showToast('🗑️ Matéria excluída');
}

function saveTopico() {
  const nome = document.getElementById('top-nome').value.trim();
  const status = document.getElementById('top-status').value;
  if (!nome) { showToast('⚠️ Informe o nome do tópico'); return; }
  const mat = curriculo.find(m => m.id === curSelectedMatId);
  if (!mat) return;
  if (curEditTopicoIdx !== null) {
    mat.topicos[curEditTopicoIdx] = nome;
    curTopicosStatus[mat.id + '_' + curEditTopicoIdx] = status;
    if (status === 'estudado') curTopicosData[mat.id + '_' + curEditTopicoIdx] = todayLocal();
    showToast('✏️ Tópico atualizado');
  } else {
    const newIdx = mat.topicos.length;
    mat.topicos.push(nome);
    curTopicosStatus[mat.id + '_' + newIdx] = status;
    if (status === 'estudado') curTopicosData[mat.id + '_' + newIdx] = todayLocal();
    showToast('✅ Tópico adicionado');
  }
  closeModal('modal-topico');
  lsSave();
  // Salva imediatamente no Firebase sem debounce para não perder na recarga
  if (cloudTimer) clearTimeout(cloudTimer);
  fbCloudSave();
  renderEstudosCur();
  curEditTopicoIdx = null;
}


function deleteTopicoAtual() {
  if (curEditTopicoIdx === null) return;
  deleteTopico(curSelectedMatId, curEditTopicoIdx);
  closeModal('modal-topico');
  curEditTopicoIdx = null;
}


function openTagsModal(listId) {
  currentTagListId = listId;
  const list = lists.find(l => l.id === listId);
  if (!list) return;
  if (!list.tags) list.tags = [];
  document.getElementById('tags-modal-title').textContent = '🏷️ Tags — ' + list.name;
  renderTagsList();
  openModal('modal-tags');
}



// ══════════════════════════════════════════
//  PERSISTÊNCIA — localStorage + JSONBin
// ══════════════════════════════════════════
let cloudTimer  = null;

// ── Firebase state ──
let _fbApp = null;
let _fbDb  = null;
let _fbStorage = null; // Firebase Storage instance

function fbLoadConfig() {
  try { return JSON.parse(localStorage.getItem('fb_config') || 'null'); } catch(e) { return null; }
}
function fbSaveConfig(cfg) { localStorage.setItem('fb_config', JSON.stringify(cfg)); }
function fbIsConfigured() { const c = fbLoadConfig(); return !!(c && c.projectId); }

async function fbInit() {
  if (_fbDb) return true;
  const cfg = fbLoadConfig();
  if (!cfg || !cfg.projectId) return false;
  try {
    try { _fbApp = firebase.app('flow'); } catch(e) { _fbApp = firebase.initializeApp(cfg, 'flow'); }
    _fbDb = firebase.firestore(_fbApp);
    // Inicializa Storage se storageBucket disponível
    if (cfg.storageBucket) {
      try { _fbStorage = firebase.storage(_fbApp); } catch(e) { console.warn('Storage init:', e); }
    }
    return true;
  } catch(e) { console.error('fbInit:', e); return false; }
}

function fbDocRef() { return _fbDb.collection('flow_painel').doc('dados'); }

function lsSave() {
  try {
    localStorage.setItem('painel_dados_v1', JSON.stringify({
      savedAt: new Date().toISOString(),
      events, nextEventId,
      studyBacklog, nextStudyBlogId,
      backlog, nextBacklogId,
      tasks, nextTaskId,
      kanbanCols, nextColId,
      finances, nextFinId, finCategories, customPayMethods, recorrentes, orcamentos, cartoesCredito,
      lists, nextListId, nextListItemId,
      notes, nextNoteId, noteFolders,
      curriculo,
      kbeState,
      curTopicosStatus, curTopicosData,
      atividades, nextAtivId,
      sessoes, nextSessaoId,
      questaoSessoes, nextQId,
      revisoesPendentes, nextRevId,
      parcelamentos, nextParcId, economias, nextEcoId,
      jogoXP, jogoMoedas, jogoStreak, jogoLastDay,
    }));
  } catch(e) { console.warn('lsSave:', e); }
}

// Salva fotos do backlog separadamente (fora do JSON principal)
// saveBacklogPhotos: removida — foto inclusa diretamente no item

// loadBacklogPhotos: removida — foto inclusa diretamente no item

function lsLoad() {
  try {
    var raw = localStorage.getItem('painel_dados_v1');
    if (!raw) return false;
    var d = JSON.parse(raw);
    if (d.studyBacklog) {
      studyBacklog = d.studyBacklog.map(function(x) {
        // Migrate old items that don't have ID arrays
        if (!x.sessaoIds) x.sessaoIds = [];
        if (!x.questaoIds) x.questaoIds = [];
        if (!x.revisaoIds) x.revisaoIds = [];
        return x;
      });
      nextStudyBlogId = d.nextStudyBlogId || nextStudyBlogId;
    }
    if (d.lockHash) {
      var localHash = lockGetHash();
      if (!localHash) { lockSetHash(d.lockHash); }
    }
    if (d.lockEmail && !lockGetEmail()) { lockSetEmail(d.lockEmail); }
    if (d.lockEjs && !lockGetEjs()) { lockSetEjs(d.lockEjs); }
    if (d.events)           { events = d.events; nextEventId = d.nextEventId || nextEventId; }
    if (d.backlog) {
      backlog = d.backlog; nextBacklogId = d.nextBacklogId || nextBacklogId;
      // fotos incluídas diretamente nos itens
    }
    if (d.tasks)            { tasks = d.tasks; nextTaskId = d.nextTaskId || nextTaskId; }
    if (d.kanbanCols)       { kanbanCols = d.kanbanCols; nextColId = d.nextColId || nextColId; }
    if (d.finances)         { finances = d.finances; nextFinId = d.nextFinId || nextFinId; }
    if (d.customPayMethods) { customPayMethods = d.customPayMethods; localStorage.setItem('painel_pay_methods', JSON.stringify(customPayMethods)); }
    if (d.recorrentes)     { recorrentes = d.recorrentes; saveRecorrentes(); }
    if (d.orcamentos)     { orcamentos = d.orcamentos; saveOrcamentos(); }
    if (d.cartoesCredito) { cartoesCredito = d.cartoesCredito; saveCartoes(); }
    if (d.finCategories)    { finCategories = d.finCategories; }
    if (d.lists)            { lists = d.lists; nextListId = d.nextListId || nextListId; nextListItemId = d.nextListItemId || nextListItemId; }
    if (d.notes)            { notes = d.notes; nextNoteId = d.nextNoteId || nextNoteId; }
    if (d.noteFolders)      { noteFolders = d.noteFolders; }
    if (d.curriculo && d.curriculo.length) { curriculo = d.curriculo; }
    if (d.kbeState) { kbeState = d.kbeState; }
    if (d.curTopicosStatus) { curTopicosStatus = d.curTopicosStatus; }
    if (d.curTopicosData)   { curTopicosData = d.curTopicosData; }
    if (d.atividades)       { atividades = d.atividades; nextAtivId = d.nextAtivId || nextAtivId; }
    if (d.sessoes)          { sessoes = d.sessoes; nextSessaoId = d.nextSessaoId || nextSessaoId; }
    if (d.questaoSessoes)   { questaoSessoes = d.questaoSessoes; nextQId = d.nextQId || nextQId; }
    if (d.revisoesPendentes){ revisoesPendentes = d.revisoesPendentes; nextRevId = d.nextRevId || nextRevId; }
    if (d.parcelamentos)    { parcelamentos = d.parcelamentos; nextParcId = d.nextParcId || nextParcId; }
    if (d.economias)        { economias = d.economias; nextEcoId = d.nextEcoId || nextEcoId; }
    if (typeof d.jogoXP !== 'undefined')     jogoXP     = d.jogoXP;
    if (typeof d.jogoMoedas !== 'undefined') jogoMoedas = d.jogoMoedas;
    if (typeof d.jogoStreak !== 'undefined') jogoStreak = d.jogoStreak;
    if (d.jogoLastDay)      jogoLastDay = d.jogoLastDay;
    return true;
  } catch(e) { return false; }
  setTimeout(checkFinancesEmpty, 3000);
}

function scheduleSave() {
  lsSave();
  if (!fbIsConfigured()) return;
  if (cloudTimer) clearTimeout(cloudTimer);
  cloudSetBtn('busy', 'Salvando…');
  cloudTimer = setTimeout(fbCloudSave, 2000);
}

// ── JSONBin ──
function cloudSetBtn(state, text) {
  var btn = document.getElementById('cloud-btn');
  var span = document.getElementById('cloud-text');
  if (btn) btn.className = 'cloud-btn ' + state;
  if (span) span.textContent = text;
}

function openCloudModal() {
  const cfg = fbLoadConfig();
  if (cfg && cfg.projectId) {
    document.getElementById('cloud-connected').style.display = 'block';
    document.getElementById('cloud-setup').style.display = 'none';
    document.getElementById('cloud-footer').style.display = 'none';
    var pidEl = document.getElementById('cloud-project-id');
    if (pidEl) pidEl.textContent = cfg.projectId;
  } else {
    document.getElementById('cloud-connected').style.display = 'none';
    document.getElementById('cloud-setup').style.display = 'block';
    document.getElementById('cloud-footer').style.display = 'flex';
  }
  openModal('modal-cloud');
}

async function cloudConnect() {
  var raw = document.getElementById('cloud-key-json') ? document.getElementById('cloud-key-json').value.trim() : '';
  if (!raw) { showToast('⚠️ Cole a configuração do Firebase'); return; }
  try {
    var cfg = JSON.parse(raw);
    if (!cfg.projectId || !cfg.apiKey) { showToast('⚠️ JSON inválido — verifique os campos'); return; }
    fbSaveConfig(cfg);
    _fbApp = null; _fbDb = null;
    const ok = await fbInit();
    if (!ok) { showToast('❌ Falha ao conectar ao Firebase'); return; }
    cloudSetBtn('ok', '✓ Firebase');
    closeModal('modal-cloud');
    showToast('✅ Firebase conectado!');
    fbCloudSave();
  } catch(e) { showToast('❌ JSON inválido: ' + e.message); }
}

async function fbCloudSave() {
  if (!fbIsConfigured()) return;
  cloudSetBtn('busy', 'Salvando…');
  try {
    const ok = await fbInit();
    if (!ok) throw new Error('Firebase não inicializado');
    const notesClean = (typeof notes !== 'undefined' ? notes : []).map(function(n) {
      if (!n.image) return n;
      // URL do Storage: envia direto (curta, cross-device)
      if (n.image.startsWith('http')) return n;
      // Base64 local: envia até 200KB (evita estourar o doc do Firestore ~1MB)
      if (n.image.length < 200000) return n;
      // Base64 muito grande: omite do Firestore (fica só no localStorage)
      return Object.assign({}, n, {image: '__local__'});
    });
    const payload = {
      savedAt: new Date().toISOString(),
      events: typeof events!=='undefined'?events:[], nextEventId: typeof nextEventId!=='undefined'?nextEventId:300,
      backlog: (typeof backlog!=='undefined'?backlog:[]), nextBacklogId: typeof nextBacklogId!=='undefined'?nextBacklogId:8,
      tasks: typeof tasks!=='undefined'?tasks:[], nextTaskId: typeof nextTaskId!=='undefined'?nextTaskId:200,
      kanbanCols: typeof kanbanCols!=='undefined'?kanbanCols:[], nextColId: typeof nextColId!=='undefined'?nextColId:10,
      finances: typeof finances!=='undefined'?finances:[],
      customPayMethods: typeof customPayMethods!=='undefined'?customPayMethods:[],
      recorrentes: typeof recorrentes!=='undefined'?recorrentes:[],
      orcamentos: typeof orcamentos!=='undefined'?orcamentos:[],
      cartoesCredito: typeof cartoesCredito!=='undefined'?cartoesCredito:[], nextFinId: typeof nextFinId!=='undefined'?nextFinId:400,
      finCategories: typeof finCategories!=='undefined'?finCategories:[],
      lists: typeof lists!=='undefined'?lists:[], nextListId: typeof nextListId!=='undefined'?nextListId:10,
      nextListItemId: typeof nextListItemId!=='undefined'?nextListItemId:100,
      notes: notesClean, nextNoteId: typeof nextNoteId!=='undefined'?nextNoteId:10,
      noteFolders: typeof noteFolders!=='undefined'?noteFolders:[],
      curriculo: curriculo || [],
      kbeState: kbeState || {},
      curTopicosStatus: typeof curTopicosStatus!=='undefined'?curTopicosStatus:{},
      curTopicosData: typeof curTopicosData!=='undefined'?curTopicosData:{},
      atividades: typeof atividades!=='undefined'?atividades:[], nextAtivId: typeof nextAtivId!=='undefined'?nextAtivId:10,
      sessoes: typeof sessoes!=='undefined'?sessoes:[], nextSessaoId: typeof nextSessaoId!=='undefined'?nextSessaoId:1,
      questaoSessoes: typeof questaoSessoes!=='undefined'?questaoSessoes:[], nextQId: typeof nextQId!=='undefined'?nextQId:1,
      revisoesPendentes: typeof revisoesPendentes!=='undefined'?revisoesPendentes:[], nextRevId: typeof nextRevId!=='undefined'?nextRevId:1,
      studyBacklog: typeof studyBacklog!=='undefined'?studyBacklog:[], nextStudyBlogId: typeof nextStudyBlogId!=='undefined'?nextStudyBlogId:1,
      parcelamentos: typeof parcelamentos!=='undefined'?parcelamentos:[], nextParcId: typeof nextParcId!=='undefined'?nextParcId:1,
      economias: typeof economias!=='undefined'?economias:[], nextEcoId: typeof nextEcoId!=='undefined'?nextEcoId:1,
      jogoXP: typeof jogoXP!=='undefined'?jogoXP:0, jogoMoedas: typeof jogoMoedas!=='undefined'?jogoMoedas:0,
      jogoStreak: typeof jogoStreak!=='undefined'?jogoStreak:0, jogoLastDay: typeof jogoLastDay!=='undefined'?jogoLastDay:'',
    };
    await fbDocRef().set(payload);
    const time = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    cloudSetBtn('ok', '✓ ' + time);
    var lbl = document.getElementById('cloud-last-sync');
    if (lbl) lbl.textContent = 'Último sync: ' + time;
  } catch(e) {
    cloudSetBtn('off', '⚠️ Erro');
    console.error('fbCloudSave:', e);
    showToast('❌ Erro ao salvar: ' + e.message);
  }
}

function cloudSave() { return fbCloudSave(); }


function cloudDiag(msg) {
  var el = document.getElementById('cloud-diag-log');
  if (!el) return;
  var line = document.createElement('div');
  line.style.cssText = 'padding:3px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:11px;font-family:monospace;color:var(--text)';
  var time = new Date().toLocaleTimeString('pt-BR');
  line.textContent = '[' + time + '] ' + msg;
  el.insertBefore(line, el.firstChild);
  // Keep max 10 lines
  while (el.children.length > 10) el.removeChild(el.lastChild);
  // Show panel
  var wrap = document.getElementById('cloud-diag-wrap');
  if (wrap) wrap.style.display = 'block';
}

function cloudDiagClear() {
  var el = document.getElementById('cloud-diag-log');
  if (el) el.innerHTML = '';
  var wrap = document.getElementById('cloud-diag-wrap');
  if (wrap) wrap.style.display = 'none';
}

async function cloudLoad(forceLoad) {
  if (!cloudKey || !cloudBinId) { cloudDiag('❌ JSONBin não configurado'); return; }
  cloudSetBtn('busy', 'Carregando…');
  cloudDiag('⏳ Conectando ao JSONBin...');
  try {
    var resp = await fetch('https://api.jsonbin.io/v3/b/' + cloudBinId + '/latest', {
      headers: { 'X-Master-Key': cloudKey },
    });
    cloudDiag('📡 Resposta HTTP: ' + resp.status);
    var json = await resp.json();
    var d = json.record || json;

    if (!d || d.init) {
      cloudDiag('☁️ Bin vazio — salvando dados locais na nuvem');
      cloudSave();
      showToast('☁️ Primeiro uso — dados salvos na nuvem');
      return;
    }

    cloudDiag('✅ Dados recebidos. savedAt: ' + (d.savedAt || 'sem data'));

    var driveTime = d.savedAt ? new Date(d.savedAt).getTime() : 0;
    var localRaw = localStorage.getItem('painel_dados_v1');
    var localTime = 0;
    if (localRaw) { try { localTime = new Date(JSON.parse(localRaw).savedAt).getTime(); } catch(e) {} }

    cloudDiag('🕐 Nuvem: ' + (driveTime ? new Date(driveTime).toLocaleString('pt-BR') : 'sem data') +
              ' | Local: ' + (localTime ? new Date(localTime).toLocaleString('pt-BR') : 'vazio'));

    // Só usa local se for MAIS RECENTE e não for forceLoad
    if (!forceLoad && driveTime > 0 && driveTime <= localTime && localRaw) {
      cloudDiag('ℹ️ Local mais recente — nuvem atualizada com dados locais');
      cloudSave();
      cloudSetBtn('ok', '✓ Nuvem');
      return;
    }

    if (d.events)           { events = d.events; nextEventId = d.nextEventId || nextEventId; }
    if (d.backlog)          { backlog = d.backlog; nextBacklogId = d.nextBacklogId || nextBacklogId; }
    if (d.tasks)            { tasks = d.tasks; nextTaskId = d.nextTaskId || nextTaskId; }
    if (d.kanbanCols)       { kanbanCols = d.kanbanCols; nextColId = d.nextColId || nextColId; }
    if (d.finances)         { finances = d.finances; nextFinId = d.nextFinId || nextFinId; }
    if (d.customPayMethods) { customPayMethods = d.customPayMethods; localStorage.setItem('painel_pay_methods', JSON.stringify(customPayMethods)); }
    if (d.recorrentes)     { recorrentes = d.recorrentes; saveRecorrentes(); }
    if (d.orcamentos)     { orcamentos = d.orcamentos; saveOrcamentos(); }
    if (d.cartoesCredito) { cartoesCredito = d.cartoesCredito; saveCartoes(); }
    if (d.finCategories)    { finCategories = d.finCategories; }
    if (d.lists)            { lists = d.lists; nextListId = d.nextListId || nextListId; nextListItemId = d.nextListItemId || nextListItemId; }
    if (d.notes)            { notes = d.notes; nextNoteId = d.nextNoteId || nextNoteId; }
    if (d.noteFolders)      { noteFolders = d.noteFolders; }
    if (d.curriculo && d.curriculo.length) { curriculo = d.curriculo; }
    if (d.kbeState) { kbeState = d.kbeState; }
    if (d.curTopicosStatus) { curTopicosStatus = d.curTopicosStatus; }
    if (d.curTopicosData)   { curTopicosData = d.curTopicosData; }
    if (d.atividades)       { atividades = d.atividades; nextAtivId = d.nextAtivId || nextAtivId; }
    if (d.sessoes)          { sessoes = d.sessoes; nextSessaoId = d.nextSessaoId || nextSessaoId; }
    if (d.questaoSessoes)   { questaoSessoes = d.questaoSessoes; nextQId = d.nextQId || nextQId; }
    if (d.revisoesPendentes){ revisoesPendentes = d.revisoesPendentes; nextRevId = d.nextRevId || nextRevId; }
    if (d.studyBacklog)    { studyBacklog = d.studyBacklog; nextStudyBlogId = d.nextStudyBlogId || nextStudyBlogId; }

    lsSave();
    renderBacklog();
    renderKanban();
    renderCalendar();
    renderFinance();
    renderLists();
    renderNotes();
    if (typeof renderEstudosPainel === 'function') renderEstudosPainel();
    if (typeof renderEstudos === 'function') renderEstudos();
    cloudSetBtn('ok', '✓ Nuvem');
    var count = (d.backlog||[]).length + (d.tasks||[]).length + (d.finances||[]).length + (d.studyBacklog||[]).length;
    cloudDiag('✅ Carregado! ' + count + ' itens no total. Nuvem: ' + (d.savedAt ? new Date(d.savedAt).toLocaleString('pt-BR') : '?'));
    showToast('☁️ Dados carregados da nuvem');
  } catch(err) {
    cloudSetBtn('off', '⚠️ Erro');
    cloudDiag('❌ Erro: ' + err.message);
    console.error('cloudLoad:', err);
  }
}

async function fbCloudLoad(forceLoad) {
  if (!fbIsConfigured()) { cloudDiag("Firebase nao configurado"); return; }
  cloudSetBtn("busy", "Carregando...");
  cloudDiag("Conectando ao Firebase...");
  try {
    var ok = await fbInit();
    if (!ok) throw new Error("Firebase nao inicializado");
    var snap = await fbDocRef().get();
    cloudDiag("Documento existe: " + snap.exists);
    if (!snap.exists) {
      cloudDiag("Sem dados na nuvem - salvando locais");
      await fbCloudSave();
      showToast("Primeiro uso - dados salvos no Firebase!");
      cloudSetBtn("ok", "Firebase");
      return;
    }
    var d = snap.data();
    // Verifica se há bloqueio de carga do Firebase (restauração recente)
    var blockTs = parseInt(localStorage.getItem('painel_block_cloud_load') || '0');
    if (blockTs && (Date.now() - blockTs) < 300000) {
      console.log('[CLOUD] Carga bloqueada — restauração recente. Salvando dados locais no Firebase...');
      localStorage.removeItem('painel_block_cloud_load');
      cloudSetBtn('ok', 'Dados locais mantidos');
      setTimeout(fbCloudSave, 2000);
      return;
    }
    cloudDiag("Dados recebidos. savedAt: " + (d.savedAt || "sem data"));
    var cloudTime = d.savedAt ? new Date(d.savedAt).getTime() : 0;
    var localRaw = localStorage.getItem("painel_dados_v1");
    var localTime = 0;
    if (localRaw) { try { localTime = new Date(JSON.parse(localRaw).savedAt).getTime(); } catch(_){} }
    // Só usa local se for mais recente E tiver dados significativos (>10 itens)
    var localData = null;
    try { localData = localRaw ? JSON.parse(localRaw) : null; } catch(_) {}
    var localFinCount = (localData && localData.finances) ? localData.finances.length : 0;
    var localIsNewer = cloudTime > 0 && localTime > cloudTime && localFinCount > 10;
    if (!forceLoad && localIsNewer) {
      cloudDiag("Local mais recente (" + localFinCount + " fin) - Firebase atualizado");
      await fbCloudSave(); cloudSetBtn("ok", "Nuvem"); return;
    }
    if (d.events)            { events = d.events; nextEventId = d.nextEventId || nextEventId; }
    if (d.backlog) {
      backlog = d.backlog;
      nextBacklogId = d.nextBacklogId || nextBacklogId;
      // fotos incluídas diretamente nos itens
    }
    if (d.tasks)             { tasks = d.tasks; nextTaskId = d.nextTaskId || nextTaskId; }
    if (d.kanbanCols)        { kanbanCols = d.kanbanCols; nextColId = d.nextColId || nextColId; }
    // Salva backup antes de sobrescrever com dados do Firebase
    if (finances && finances.length > 0) {
      try { localStorage.setItem('painel_finances_backup', JSON.stringify({ts: Date.now(), data: finances, nextFinId: nextFinId})); } catch(e) {}
    }
    if (d.finances)          { finances = d.finances; nextFinId = d.nextFinId || nextFinId; }
    if (d.customPayMethods)  { customPayMethods = d.customPayMethods; localStorage.setItem('painel_pay_methods', JSON.stringify(customPayMethods)); }
    if (d.recorrentes)      { recorrentes = d.recorrentes; saveRecorrentes(); }
    if (d.orcamentos)      { orcamentos = d.orcamentos; saveOrcamentos(); }
    if (d.cartoesCredito)  { cartoesCredito = d.cartoesCredito; saveCartoes(); }
    if (d.finCategories)     { finCategories = d.finCategories; }
    if (d.lists)             { lists = d.lists; nextListId = d.nextListId||nextListId; nextListItemId = d.nextListItemId||nextListItemId; }
    if (d.notes) {
      var localNotes = [];
      try { localNotes = JSON.parse(localStorage.getItem("painel_dados_v1")||"{}").notes||[]; } catch(_){}
      notes = d.notes.map(function(n){
        if (!n.image) return n;
        // URL do Storage (https://...): usa diretamente em qualquer device
        if (n.image.startsWith('http')) return n;
        // Base64 completo: usa direto
        if (n.image.startsWith('data:image')) return n;
        // '__local__': tenta recuperar do localStorage deste device
        if (n.image === '__local__') {
          var ln = localNotes.find(function(x){ return x.id === n.id; });
          return ln && ln.image ? Object.assign({},n,{image:ln.image}) : Object.assign({},n,{image:null});
        }
        return n;
      });
      nextNoteId = d.nextNoteId || nextNoteId;
    }
    if (d.noteFolders)       { noteFolders = d.noteFolders; }
    if (d.curriculo && d.curriculo.length) { curriculo = d.curriculo; }
    if (d.kbeState) { kbeState = d.kbeState; }
    if (d.curTopicosStatus)  { curTopicosStatus = d.curTopicosStatus; }
    if (d.curTopicosData)    { curTopicosData = d.curTopicosData; }
    if (d.atividades)        { atividades = d.atividades; nextAtivId = d.nextAtivId||nextAtivId; }
    if (d.sessoes)           { sessoes = d.sessoes; nextSessaoId = d.nextSessaoId||nextSessaoId; }
    if (d.questaoSessoes)    { questaoSessoes = d.questaoSessoes; nextQId = d.nextQId||nextQId; }
    if (d.revisoesPendentes) { revisoesPendentes = d.revisoesPendentes; nextRevId = d.nextRevId||nextRevId; }
    if (d.studyBacklog)      { studyBacklog = d.studyBacklog; nextStudyBlogId = d.nextStudyBlogId||nextStudyBlogId; }
    if (d.parcelamentos)     { parcelamentos = d.parcelamentos; nextParcId = d.nextParcId||nextParcId; }
    if (d.economias)         { economias = d.economias; nextEcoId = d.nextEcoId||nextEcoId; }
    if (typeof d.jogoXP !== 'undefined')     jogoXP     = d.jogoXP;
    if (typeof d.jogoMoedas !== 'undefined') jogoMoedas = d.jogoMoedas;
    if (typeof d.jogoStreak !== 'undefined') jogoStreak = d.jogoStreak;
    if (d.jogoLastDay)       jogoLastDay = d.jogoLastDay;
    lsSave();
    if (typeof renderBacklog==="function") renderBacklog();
    if (typeof renderCalendar==="function") renderCalendar();
    if (typeof renderFinance==="function") renderFinance();
    if (typeof renderNotes==="function" && currentView==="notes") renderNotes();
    if (typeof renderEstudosPainel==="function" && currentView==="estudos") renderEstudosPainel();
    if (typeof renderJogo==="function" && currentView==="jogo") { jogoUpdateStreak(); renderJogo(); }
    cloudSetBtn("ok", "Nuvem");
    var cnt = (d.backlog||[]).length+(d.tasks||[]).length+(d.finances||[]).length+(d.notes||[]).length+(d.atividades||[]).length;
    cloudDiag("OK! " + cnt + " itens carregados do Firebase!");
    showToast("Todos os modulos carregados do Firebase (" + cnt + " itens)");
  } catch(e) {
    cloudSetBtn("off", "Erro");
    cloudDiag("Erro: " + e.message);
    showToast("Erro ao carregar: " + e.message);
  }
}

function cloudLoad(force) { return fbCloudLoad(force); }

function cloudDisconnect() {
  localStorage.removeItem('fb_config');
  _fbApp = null; _fbDb = null;
  cloudSetBtn('off', 'Nuvem');
  closeModal('modal-cloud');
  showToast('Firebase desconectado');
}

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════

function pwaInit() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      regs.forEach(function(r) { r.unregister(); });
    });
  }
}


function openSettingsModal() {
  renderSettingsTabs();
  // Update cloud status
  var cs = document.getElementById('settings-cloud-status');
  var fbCfg = fbLoadConfig();
  var isConnected = fbCfg && fbCfg.projectId;
  if (cs) cs.textContent = isConnected ? ('✅ Firebase: ' + fbCfg.projectId) : 'Não configurado';
  var cloudBtns = document.getElementById('settings-cloud-btns');
  if (cloudBtns) cloudBtns.style.display = isConnected ? 'flex' : 'none';

  // Update gcal status
  var gs = document.getElementById('settings-gcal-status');
  var gd = document.getElementById('settings-gcal-disconnect');
  var gi = document.getElementById('settings-gcal-id');
  if (gs) gs.textContent = gcalState.connected ? '✅ Conectado' : 'Não conectado';
  if (gd) gd.style.display = gcalState.connected ? 'inline-flex' : 'none';
  if (gi && gcalState.clientId) gi.value = gcalState.clientId;
  openModal('modal-settings');
}

function settingsGcalConnect() {
  var inp = document.getElementById('settings-gcal-id');
  if (!inp || !inp.value.trim()) { showToast('⚠️ Cole o Client ID'); return; }
  var gcalInp = document.getElementById('gcal-client-id');
  if (gcalInp) gcalInp.value = inp.value.trim();
  gcalConnect();
  closeModal('modal-settings');
}

function exportData() {
  lsSave();
  var data = localStorage.getItem('painel_dados_v1');
  if (!data) { showToast('Sem dados para exportar'); return; }
  var blob = new Blob([data], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'painel-backup-' + todayLocal() + '.json';
  a.click();
  showToast('📤 Backup exportado!');
}

function importData(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var d = JSON.parse(e.target.result);
      localStorage.setItem('painel_dados_v1', JSON.stringify(d));
      // Bloqueia Firebase de sobrescrever por 5 minutos
      localStorage.setItem('painel_block_cloud_load', Date.now().toString());
      lsLoad();
      // Bloqueia Firebase e salva nele
      localStorage.setItem('painel_block_cloud_load', Date.now().toString());
      setTimeout(function() {
        if (typeof fbCloudSave === 'function') fbCloudSave();
      }, 2000);
      // Re-renderiza TODAS as views
      try { renderBacklog(); } catch(e){}
      try { renderCalendar(); } catch(e){}
      try { renderFinance(); } catch(e){}
      try { renderLists(); } catch(e){}
      try { renderNotes(); } catch(e){}
      try { if (estudosActiveTab === 'desempenho') renderDesempenho(); } catch(e){}
      try { if (estudosActiveTab === 'consistencia') renderConsistencia(); } catch(e){}
      try { if (estudosActiveTab === 'kanban-estudo') renderKanbanEstudo(); } catch(e){}
      var counts = [
        (d.finances||[]).length + ' lançamentos',
        (d.lists||[]).length + ' listas',
        (d.notes||[]).length + ' notas',
        (d.curriculo||[]).length + ' matérias',
      ].join(', ');
      showToast('📥 Importado: ' + counts);
    } catch(err) {
      showToast('❌ Arquivo inválido: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  // Primeira barreira
  if (!confirm('⚠️ ATENÇÃO: Você tem certeza absoluta?\n\nIsso apagará TODOS os seus dados locais e não pode ser desfeito!\n\nClique em OK apenas se tiver certeza.')) return;
  // Segunda barreira — digitação de confirmação via prompt
  var confirmacao = prompt('Para confirmar, digite exatamente: APAGAR');
  if (confirmacao === null) return;  // cancelou
  if (confirmacao.trim().toUpperCase() !== 'APAGAR') {
    alert('Texto incorreto. Operação cancelada.');
    return;
  }
  // Apaga só os dados locais (keys conhecidas do painel)
  var keys = Object.keys(localStorage).filter(function(k){ return k.startsWith('painel_'); });
  keys.forEach(function(k){ localStorage.removeItem(k); });
  location.reload();
}



// ══ ENVIAR PARA BACKLOG ══
function sendToBacklog(type, id) {
  var item = null;
  var text = '';

  if (type === 'task') {
    item = tasks.find(t => t.id === id);
    if (!item) return;
    text = item.title + (item.notes ? ' — ' + item.notes : '');
    tasks = tasks.filter(t => t.id !== id);
    lsSave();
    renderKanban();
  } else if (type === 'note') {
    item = notes.find(n => n.id === id);
    if (!item) return;
    text = (item.title || '') + (item.body ? (item.title ? ' — ' : '') + item.body.slice(0,100) : '');
    notes = notes.filter(n => n.id !== id);
    lsSave();
    renderNotes();
  } else if (type === 'event') {
    item = events.find(ev => ev.id === id);
    if (!item) return;
    text = item.title + (item.date ? ' (' + item.date + ')' : '') + (item.location ? ' — ' + item.location : '');
    events = events.filter(ev => ev.id !== id);
    lsSave();
    renderCalendar();
  } else if (type === 'finance') {
    item = finances.find(f => f.id === id);
    if (!item) return;
    text = (item.type === 'expense' ? '↓ ' : '↑ ') + item.desc + ' R$' + Math.abs(item.value).toFixed(2);
    finances = finances.filter(f => f.id !== id);
    lsSave();
    renderFinance();
  } else if (type === 'list-item') {
    // id = {listId, itemId}
    var list = lists.find(l => l.id === id.listId);
    if (!list) return;
    var li = list.items.find(i => i.id === id.itemId);
    if (!li) return;
    text = li.text + (li.tag ? ' [' + li.tag + ']' : '');
    list.items = list.items.filter(i => i.id !== id.itemId);
    lsSave();
    renderLists();
  }

  if (!text.trim()) return;

  // Add to backlog
  backlog.push({
    id: nextBacklogId++,
    text: text.trim(),
    tag: type,
    priority: 'normal',
    timestamp: Date.now(),
    origin: type,
  });
  lsSave();
  scheduleSave();
  showToast('↩ Enviado para o Backlog');

  // Switch to inbox view
  var inboxBtn = document.querySelector('.nav-btn[onclick*=\"inbox\"]') ||
                 document.querySelector('.bnav-btn[onclick*=\"inbox\"]');
  switchView('inbox', inboxBtn);
  renderBacklog();
}



// ══ COLUNAS KANBAN ══
function openManageCols() {
  var el = document.getElementById('cols-list');
  if (el) {
    el.innerHTML = kanbanCols.map((c,i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border-soft)">
        <span style="flex:1;font-size:13px">${escHtml(c.name)}</span>
        <span style="font-size:10px;color:var(--text-dim)">${tasks.filter(t=>t.col===c.id).length} tarefas</span>
        <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px"
          onclick="renameCol('${c.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" style="padding:2px 6px;font-size:11px"
          onclick="deleteKanbanCol('${c.id}')">✕</button>
      </div>`).join('');
  }
  openModal('modal-cols');
}

function renameCol(colId) {
  var col = kanbanCols.find(c => c.id === colId);
  if (!col) return;
  var name = prompt('Novo nome:', col.name);
  if (name && name.trim()) {
    col.name = name.trim();
    lsSave();
    renderKanban();
    openManageCols();
    showToast('✏️ Coluna renomeada');
  }
}

// ══ CATEGORIAS FINANCEIRO ══
function openManageCats() {
  renderFinCatsModal();
  openModal('modal-fin-cats');
}

function openManageCats() {
  renderFinCatsModal();
  openModal('modal-fin-cats');
}

function renderFinCatsModal() {
  var el = document.getElementById('fin-cats-list');
  if (!el) return;
  if (!finCategories.length) {
    el.innerHTML = '<p style="color:var(--text-dim);font-size:12px;padding:8px 0">Nenhuma categoria.</p>';
    return;
  }
  el.innerHTML = finCategories.map(function(c, i) {
    var label = typeof c === 'string' ? c : (c.label || c.id || String(c));
    var type  = (typeof c === 'object' && c.type) ? c.type : 'saida';
    var typeColor = type === 'saida' ? '#EF4444' : type === 'entrada' ? '#10B981' : '#7878A0';
    var typeBg    = type === 'saida' ? 'rgba(239,68,68,.12)' : type === 'entrada' ? 'rgba(16,185,129,.12)' : 'rgba(120,120,160,.1)';
    var typeLabel = type === 'saida' ? 'Despesa' : type === 'entrada' ? 'Receita' : 'Ambos';
    var txCount = finances.filter(function(f){ return f.category === label || f.category === (c.id || label); }).length;
    return [
      '<div style="display:flex;align-items:center;gap:6px;padding:8px 0;border-bottom:1px solid var(--border-soft);flex-wrap:wrap">',
      '  <div style="display:flex;flex-direction:column;gap:1px;flex-shrink:0">',
      '    <button onclick="moveCat('+i+',-1)" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:9px;padding:1px 4px;line-height:1" title="Subir">▲</button>',
      '    <button onclick="moveCat('+i+',1)"  style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:9px;padding:1px 4px;line-height:1" title="Descer">▼</button>',
      '  </div>',
      '  <span style="flex:1;font-size:13px;color:var(--text);font-weight:500;min-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+label+'">'+label+'</span>',
      '  <span style="font-size:10px;padding:2px 7px;border-radius:20px;background:'+typeBg+';color:'+typeColor+';border:1px solid '+typeColor+';white-space:nowrap;flex-shrink:0">'+typeLabel+'</span>',
      '  <span style="font-size:10px;color:var(--text-dim);white-space:nowrap;flex-shrink:0;min-width:32px;text-align:right">'+txCount+'x</span>',
      '  <div style="display:flex;gap:4px;flex-shrink:0;margin-left:auto">',
      '    <button onclick="editCat('+i+')" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text-muted);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center" title="Editar">✏️</button>',
      '    <button onclick="deleteCat('+i+')" style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.08);color:#EF4444;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center" title="Excluir">✕</button>',
      '  </div>',
      '</div>'
    ].join('');
  }).join('');
}
function moveCat(idx, dir) {
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= finCategories.length) return;
  var tmp = finCategories[idx];
  finCategories[idx] = finCategories[newIdx];
  finCategories[newIdx] = tmp;
  lsSave(); scheduleSave();
  renderFinCatsModal(); updateFinCategorySelects();
}

function editCat(idx) {
  var c = finCategories[idx];
  var label = typeof c === 'string' ? c : (c.label || '');
  var type  = (typeof c === 'object' && c.type) ? c.type : 'saida';
  var newLabel = prompt('Nome da categoria:', label);
  if (!newLabel || !newLabel.trim()) return;
  newLabel = newLabel.trim();
  var types = ['saida', 'entrada', 'ambos'];
  var typeMap = {saida:'1', entrada:'2', ambos:'3'};
  var pick = prompt('Tipo:\n1 = Despesa\n2 = Receita\n3 = Ambos', typeMap[type] || '1');
  var typeIdx = parseInt(pick) - 1;
  if (isNaN(typeIdx) || typeIdx < 0 || typeIdx > 2) typeIdx = 0;
  var oldLabel = label;
  finCategories[idx] = { id: newLabel, label: newLabel, type: types[typeIdx] };
  finances.forEach(function(f) { if (f.category === oldLabel) f.category = newLabel; });
  lsSave(); scheduleSave();
  renderFinCatsModal(); updateFinCategorySelects();
  showToast('✏️ Categoria atualizada');
}

function deleteCat(idx) {
  var c = finCategories[idx];
  var label = typeof c === 'string' ? c : (c.label || String(c));
  var count = finances.filter(function(f) { return f.category === label; }).length;
  var msg = 'Remover "'+ label +'"?';
  if (count > 0) msg += '\n\n⚠️ ' + count + ' lançamento(s) usam esta categoria.';
  if (!confirm(msg)) return;
  finCategories.splice(idx, 1);
  lsSave(); scheduleSave();
  renderFinCatsModal(); updateFinCategorySelects();
  showToast('🗑️ Categoria removida');
}

function addFinCategory() {
  var label = document.getElementById('new-cat-label').value.trim();
  var type  = document.getElementById('new-cat-type').value;
  if (!label) { showToast('⚠️ Informe o nome'); return; }
  var dup = finCategories.find(function(c) {
    return (typeof c === 'string' ? c : (c.label || c.id || '')) === label;
  });
  if (dup) { showToast('⚠️ Categoria já existe'); return; }
  finCategories.push({ id: label, label: label, type: type });
  document.getElementById('new-cat-label').value = '';
  renderFinCatsModal(); updateFinCategorySelects();
  lsSave(); scheduleSave();
  showToast('✅ Categoria "' + label + '" criada');
}


function renameCat(idx) {
  var name = prompt('Novo nome:', finCategories[idx]);
  if (name && name.trim()) {
    var old = finCategories[idx];
    finCategories[idx] = name.trim();
    finances.forEach(function(f) { if (f.category === old) f.category = name.trim(); });
    lsSave();
    renderFinance();
    renderFinCatsModal();
    showToast('✏️ Categoria renomeada');
  }
}

// ══ NOTA → BACKLOG (fix — add to renderNotes) ══
// The CSS class exists but injection failed — using onclick on note card directly

// ══ FINANCE → BACKLOG (fix) ══
function finToBacklog(id) {
  var item = finances.find(function(f) { return f.id === id; });
  if (!item) return;
  var text = (item.type === 'expense' ? '↓ ' : '↑ ') + item.desc + ' R$' + Math.abs(item.value).toFixed(2);
  finances = finances.filter(function(f) { return f.id !== id; });
  backlog.push({ id: nextBacklogId++, text: text, tag: 'financeiro', priority: 'normal', timestamp: Date.now(), origin: 'finance' });
  lsSave();
  scheduleSave();
  renderFinance();
  var inboxBtn2 = document.querySelector('.nav-btn[onclick*=\"inbox\"]') ||
                  document.querySelector('.bnav-btn[onclick*=\"inbox\"]');
  switchView('inbox', inboxBtn2);
  renderBacklog();
  showToast('↩ Enviado para o Backlog');
}



// ══ REGISTRAR ESTUDO ══
let regMatId = null;
let regTopicoIdx = null;

function openRegistrarEstudo(mid, idx) {
  regMatId = mid;
  regTopicoIdx = idx;
  const mat = curriculo.find(m => m.id === mid);
  if (!mat) return;
  const nome = mat.topicos[idx] || '';
  document.getElementById('reg-topico-nome').textContent = mat.nome + ' › ' + nome;
  document.getElementById('reg-mat-id').value = mid;
  document.getElementById('reg-topico-idx').value = idx;
  document.getElementById('reg-data').value = todayLocal();
  document.getElementById('reg-tempo').value = '';
  document.getElementById('reg-acerto').value = '';
  document.getElementById('reg-revisao').checked = false;

  // Pre-fill with existing data
  var existing = curTopicosData[mid + '_' + idx];
  if (existing && typeof existing === 'object') {
    if (existing.date) document.getElementById('reg-data').value = existing.date;
    if (existing.tempo) document.getElementById('reg-tempo').value = existing.tempo;
    if (existing.acerto != null) document.getElementById('reg-acerto').value = existing.acerto;
  }
  openModal('modal-registrar-estudo');
}

function saveRegistroEstudo() {
  const mid = parseInt(document.getElementById('reg-mat-id').value);
  const idx = parseInt(document.getElementById('reg-topico-idx').value);
  const data = document.getElementById('reg-data').value;
  const tempo = parseInt(document.getElementById('reg-tempo').value) || 0;
  const acertoVal = document.getElementById('reg-acerto').value;
  const acerto = acertoVal !== '' ? parseInt(acertoVal) : null;
  const revisao = document.getElementById('reg-revisao').checked;

  if (!data) { showToast('⚠️ Informe a data'); return; }

  // Get or init historico
  var existing = curTopicosData[mid + '_' + idx];
  var historico = (existing && existing.historico) ? existing.historico : [];

  // Add this session to historico
  historico.push({ date: data, tempo, acerto });

  // Update curTopicosData
  curTopicosData[mid + '_' + idx] = { date: data, tempo, acerto, historico };

  // Mark as estudado
  curTopicosStatus[mid + '_' + idx] = 'estudado';

  // Schedule revisao espaçada
  if (revisao) {
    const baseDate = new Date(data + 'T12:00:00');
    [1, 7, 15, 30].forEach(function(days) {
      const revDate = new Date(baseDate);
      revDate.setDate(revDate.getDate() + days);
      const mat = curriculo.find(m => m.id === mid);
      const topicoNome = mat ? mat.topicos[idx] : 'Tópico';
      const matNome = mat ? mat.nome : '';
      revisoesPendentes.push({
        id: nextRevId++,
        matId: mid,
        topicoIdx: idx,
        nome: matNome + ' › ' + topicoNome,
        dataRev: dateToLocal(revDate),
        dias: days,
        concluida: false,
      });
    });
    showToast('📖 Estudo registrado + 4 revisões agendadas!');
  } else {
    showToast('📖 Estudo registrado!');
  }

  // Also register as sessão (for the painel estudos view)
  const mat2 = curriculo.find(m => m.id === mid);
  if (mat2 && tempo > 0) {
    sessoes.push({
      id: nextSessaoId++,
      disciplina: mat2.nome,
      data: data,
      inicio: new Date(data + 'T08:00:00').getTime(),
      fim: new Date(data + 'T08:00:00').getTime() + tempo * 60000,
      duracao: tempo * 60,
      durMin: tempo,
    });
  }

  // Salva questões em questaoSessoes se preenchido
  const qTotal  = parseInt(document.getElementById('reg-questoes-total')?.value) || 0;
  const qCertas = parseInt(document.getElementById('reg-questoes-certas')?.value) || 0;
  const mat3 = curriculo.find(m => m.id === mid);
  if (mat3 && qTotal > 0) {
    questaoSessoes.push({
      id: nextQId++,
      disciplina: mat3.nome,
      tema: mat3.topicos[idx] || '',
      matId: mid,
      topicoIdx: idx,
      total: qTotal,
      acertos: qCertas,
      acerto: qTotal > 0 ? Math.round(qCertas/qTotal*100) : 0,
      fonte: 'Registro de Estudo',
      data: data,
    });
  }

  lsSave();
  scheduleSave();
  closeModal('modal-registrar-estudo');
  renderEstudosCur();
}

// ══ DESEMPENHO POR TÓPICO ══
function renderDesempenhoCurriculo() {
  const mat = curriculo.find(m => m.id === curSelectedMatId);
  const el = document.getElementById('cur-desempenho');
  if (!el || !mat) return;

  var rows = mat.topicos.map((t, i) => {
    var d = curTopicosData[mat.id + '_' + i];
    var status = curTopicosStatus[mat.id + '_' + i] || 'pendente';
    if (!d || typeof d !== 'object') return null;
    return { nome: t, status, date: d.date, tempo: d.tempo, acerto: d.acerto, historico: d.historico || [] };
  }).filter(Boolean);

  if (!rows.length) {
    el.innerHTML = '<p style="color:var(--text-dim);font-size:12px">Nenhum tópico estudado ainda.</p>';
    return;
  }

  el.innerHTML = rows.map(r => `
    <div style="padding:8px 0;border-bottom:1px solid var(--border-soft);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span style="flex:1;font-size:12px;color:var(--text)">${escHtml(r.nome)}</span>
      ${r.date ? `<span style="font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--text-dim)">${r.date}</span>` : ''}
      ${r.tempo ? `<span style="font-size:10px;color:var(--cyan)">⏱ ${r.tempo}min</span>` : ''}
      ${r.acerto != null ? `<span style="font-size:10px;color:${r.acerto >= 70 ? 'var(--green)' : r.acerto >= 50 ? 'var(--amber)' : 'var(--red)'}">🎯 ${r.acerto}%</span>` : ''}
      <span style="font-size:9px;padding:1px 5px;border-radius:4px;background:${r.status==='estudado'?'rgba(16,185,129,0.15)':'rgba(245,158,11,0.15)'};color:${r.status==='estudado'?'var(--green)':'var(--amber)'}">${r.status}</span>
    </div>`).join('');
}



// ══ BACKLOG DE ESTUDOS (GURUJÁ) ══

function openAddEstudoBacklog() {
  // Populate materias
  const sel = document.getElementById('sbl-materia');
  if (sel) {
    sel.innerHTML = '<option value="">Selecione a matéria…</option>' +
      curriculo.map(m => `<option value="${m.id}">${escHtml(m.nome)}</option>`).join('');
  }
  document.getElementById('sbl-topicos-check').innerHTML = '';
  document.getElementById('sbl-tempo').value = '60';
  document.getElementById('sbl-questoes').value = '';
  openModal('modal-estudo-backlog');
}

function sblLoadTopicos() {
  const matId = parseInt(document.getElementById('sbl-materia').value);
  const mat = curriculo.find(m => m.id === matId);
  const el = document.getElementById('sbl-topicos-check');
  if (!el) return;
  if (!mat) { el.innerHTML = ''; return; }
  el.innerHTML = mat.topicos.map((t, i) => {
    const status = curTopicosStatus[mat.id + '_' + i] || 'pendente';
    const statusColor = status === 'estudado' ? 'var(--green)' : status === 'andamento' ? 'var(--amber)' : 'var(--text-dim)';
    return `<label style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;cursor:pointer;border-bottom:1px solid var(--border-soft)">
      <input type="checkbox" value="${i}" style="accent-color:var(--violet);margin-top:2px;flex-shrink:0">
      <span style="flex:1;font-size:12px;color:var(--text)">${escHtml(t)}</span>
      <span style="font-size:9px;color:${statusColor}">${status}</span>
    </label>`;
  }).join('');
}

function saveEstudoBacklog() {
  const matId = parseInt(document.getElementById('sbl-materia').value);
  const mat = curriculo.find(m => m.id === matId);
  if (!mat) { showToast('⚠️ Selecione a matéria'); return; }

  const checks = document.querySelectorAll('#sbl-topicos-check input[type=checkbox]:checked');
  const topicosIdx = Array.from(checks).map(c => parseInt(c.value));
  const topicosNomes = topicosIdx.map(i => mat.topicos[i]);
  if (!topicosNomes.length) { showToast('⚠️ Selecione pelo menos um tópico'); return; }

  const tempo = parseInt(document.getElementById('sbl-tempo').value) || 60;
  const questoes = parseInt(document.getElementById('sbl-questoes').value) || 0;

  studyBacklog.push({
    id: nextStudyBlogId++,
    matId, materia: mat.nome,
    topicosIdx, topicos: topicosNomes,
    tempo, questoes,
    status: 'backlog', // backlog | planejado | concluido
    atividadeId: null,
    criadoEm: new Date().toISOString(),
  });

  lsSave();
  scheduleSave();
  closeModal('modal-estudo-backlog');
  renderEstudosBacklog();
  showToast('✅ Adicionado ao backlog de estudos');
}

function planejarEstudo(id) {
  const item = studyBacklog.find(x => x.id === id);
  if (!item) return;
  // Open planejar modal
  document.getElementById('plan-study-id').value = id;
  document.getElementById('plan-desc').value = item.materia + ' — ' + item.topicos.join(', ');
  document.getElementById('plan-disciplina').value = item.materia;
  document.getElementById('plan-tempo').value = item.tempo;
  document.getElementById('plan-questoes').value = item.questoes || '';
  // Default to next occurrence of the item's stored dia, or today
  var today = new Date();
  var nextDate = new Date(today);
  document.getElementById('plan-data').value = dateToLocal(nextDate);
  openModal('modal-planejar-estudo');
}

function savePlanejamento() {
  const id = parseInt(document.getElementById('plan-study-id').value);
  const item = studyBacklog.find(x => x.id === id);
  if (!item) return;

  const dataPlano = document.getElementById('plan-data').value;
  if (!dataPlano) { showToast('⚠️ Selecione a data'); return; }
  const tempo = parseInt(document.getElementById('plan-tempo').value) || 60;
  const questoes = parseInt(document.getElementById('plan-questoes').value) || 0;
  const dow = new Date(dataPlano + 'T12:00:00').getDay();
  const dia = dow === 0 ? 6 : dow - 1; // 0=Seg

  // Create atividade in Semana de Estudos
  const atividadeId = nextAtivId++;
  atividades.push({
    id: atividadeId,
    desc: item.materia + ' — ' + item.topicos.join(', '),
    disciplina: item.materia,
    tipo: questoes > 0 ? 'questoes' : 'leitura',
    dia, data: dataPlano, tempo,
    questoesMeta: questoes,
    done: false,
    studyBacklogId: id,
  });

  // Update backlog item
  item.status = 'planejado';
  item.atividadeId = atividadeId;
  item.dia = dia;
  item.dataPlano = dataPlano;

  lsSave();
  scheduleSave();
  closeModal('modal-planejar-estudo');
  selectedDia = dia;
  renderEstudosBacklog();
  renderSemana();
  renderAtividades();
  const [y,m,d] = dataPlano.split('-');
  showToast('📅 Planejado para ' + d + '/' + m + '/' + y);
}

function concluirEstudo(id) {
  const item = studyBacklog.find(x => x.id === id);
  if (!item) return;
  document.getElementById('conc-study-id').value = id;
  document.getElementById('conc-desc').value = item.materia + ' — ' + item.topicos.join(', ');
  document.getElementById('conc-tempo').value = item.tempo || '';
  document.getElementById('conc-questoes-feitas').value = '';
  document.getElementById('conc-acerto').value = '';
  document.getElementById('conc-revisao').checked = false;
  document.getElementById('conc-data').value = todayLocal();
  openModal('modal-concluir-estudo');
}

function saveConclusao() {
  const id = parseInt(document.getElementById('conc-study-id').value);
  const item = studyBacklog.find(x => x.id === id);
  if (!item) return;

  const tempo = parseInt(document.getElementById('conc-tempo').value) || 0;
  const questFeitas = parseInt(document.getElementById('conc-questoes-feitas').value) || 0;
  const questCertas = parseInt(document.getElementById('conc-questoes-certas')?.value) || 0;
  const acerto = document.getElementById('conc-acerto').value;
  const revisao = document.getElementById('conc-revisao').checked;
  const data = document.getElementById('conc-data').value;

  // Update backlog item
  item.status = 'concluido';
  item.tempoConcluido = tempo;
  item.questoesConcluidas = questFeitas;
  item.acerto = acerto !== '' ? parseInt(acerto) : null;
  item.concluidoEm = data;

  // Mark topicos as estudado + register study data
  const mat = curriculo.find(m => m.id === item.matId);
  if (mat) {
    item.topicosIdx.forEach(function(idx) {
      curTopicosStatus[item.matId + '_' + idx] = 'estudado';
      var hist = curTopicosData[item.matId + '_' + idx];
      var historico = (hist && hist.historico) ? hist.historico : [];
      historico.push({ date: data, tempo: Math.round(tempo / (item.topicosIdx.length || 1)), acerto: item.acerto });
      curTopicosData[item.matId + '_' + idx] = {
        date: data,
        tempo: Math.round(tempo / (item.topicosIdx.length || 1)),
        acerto: item.acerto,
        historico,
      };
    });
  }

  // Mark atividade as done
  if (item.atividadeId) {
    const atv = atividades.find(a => a.id === item.atividadeId);
    if (atv) atv.done = true;
  }

  // Register sessão — store ID for undo
  var sessaoId = null;
  if (tempo > 0) {
    sessaoId = nextSessaoId++;
    sessoes.push({
      id: sessaoId,
      disciplina: item.materia,
      data: data,
      inicio: new Date(data + 'T08:00:00').getTime(),
      fim: new Date(data + 'T08:00:00').getTime() + tempo * 60000,
      duracao: tempo * 60,
      durMin: tempo,
    });
  }

  // Schedule revisao espaçada — store IDs for undo
  var revisaoIds = [];
  if (revisao) {
    const baseDate = new Date(data + 'T12:00:00');
    [1, 7, 15, 30].forEach(function(days) {
      const revDate = new Date(baseDate);
      revDate.setDate(revDate.getDate() + days);
      var rid = nextRevId++;
      revisaoIds.push(rid);
      revisoesPendentes.push({
        id: rid,
        matId: item.matId,
        nome: item.materia + ' — ' + item.topicos.join(', '),
        dataRev: dateToLocal(revDate),
        dias: days,
        concluida: false,
      });
    });
  }

  // Register questões — store ID for undo
  var questaoId = null;
  if (questFeitas > 0 && acerto !== '') {
    questaoId = nextQId++;
    questaoSessoes.push({
      id: questaoId,
      disciplina: item.materia,
      total: questFeitas,
      acertos: questCertas || Math.round(questFeitas * parseInt(acerto) / 100),
      acerto: parseInt(acerto),
      fonte: 'Gurujá',
      tema: item.topicos.join(', '),
      data,
    });
  }

  // Store IDs for clean undo
  item.sessaoIds = sessaoId ? [sessaoId] : [];
  item.questaoIds = questaoId ? [questaoId] : [];
  item.revisaoIds = revisaoIds;

  lsSave();
  scheduleSave();
  closeModal('modal-concluir-estudo');
  renderEstudosBacklog();
  renderAtividades();
  renderDesempenho();
  renderRevisoes();
  renderHorasDisc();
  renderSessoes();
  renderEstudosCur();
  showToast('✅ Estudo concluído!' + (revisao ? ' Revisões agendadas.' : ''));
}

function deleteEstudoBacklog(id) {
  if (!confirm('Remover este item do backlog?')) return;
  // Also remove linked atividade
  const item = studyBacklog.find(x => x.id === id);
  if (item && item.atividadeId) {
    atividades = atividades.filter(a => a.id !== item.atividadeId);
  }
  studyBacklog = studyBacklog.filter(x => x.id !== id);
  lsSave();
  scheduleSave();
  renderEstudosBacklog();
  showToast('🗑️ Removido');
}

function renderEstudosBacklog() {
  const el = document.getElementById('estudos-backlog-list');
  if (!el) return;

  const backlog = studyBacklog.filter(x => x.status === 'backlog');
  const planejados = studyBacklog.filter(x => x.status === 'planejado');
  const concluidos = []; // concluidos appear in sessoes, not backlog

  const diasNomes = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

  function renderItem(item) {
    const statusColor = item.status === 'concluido' ? 'var(--green)' : item.status === 'planejado' ? 'var(--amber)' : 'var(--violet-light)';
    const statusLabel = item.status === 'concluido'
      ? ('✓ ' + (item.concluidoEm ? item.concluidoEm.split('-').reverse().slice(0,2).join('/') : 'Concluído'))
      : item.status === 'planejado'
        ? ('📅 ' + (item.dataPlano ? item.dataPlano.split('-').reverse().slice(0,2).join('/') : diasNomes[item.dia||0]))
        : '● Backlog';
    return `<div style="padding:10px 14px;border-radius:var(--radius-sm);background:var(--card);border:1px solid var(--border-soft);margin-bottom:8px">
      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text)">${escHtml(item.materia)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${item.topicos.map(t => escHtml(t)).join(' · ')}</div>
        </div>
        <span style="font-size:10px;padding:2px 7px;border-radius:10px;background:rgba(0,0,0,0.2);color:${statusColor};white-space:nowrap;flex-shrink:0">${statusLabel}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-size:10px;color:var(--text-dim)">⏱ ${item.tempo}min</span>
        ${item.questoes ? `<span style="font-size:10px;color:var(--text-dim)">📝 ${item.questoes} questões</span>` : ''}
        ${item.acerto != null ? `<span style="font-size:10px;color:var(--green)">🎯 ${item.acerto}%</span>` : ''}
        <div style="margin-left:auto;display:flex;gap:4px">
          ${item.status === 'backlog' ? `<button class="btn btn-primary btn-sm" onclick="planejarEstudo(${item.id})">📅 Planejar</button>` : ''}
          ${item.status === 'planejado' ? `<button class="btn btn-primary btn-sm" onclick="concluirEstudo(${item.id})">✓ Concluir</button>` : ''}
          ${item.status === 'concluido' ? `
            <button class="btn btn-ghost btn-sm" onclick="reabrirEstudo(${item.id})" title="Reabrir">↩ Reabrir</button>
            <button class="btn btn-ghost btn-sm" onclick="editarConclusao(${item.id})" title="Editar">✏️</button>
          ` : ''}
          <button class="btn btn-ghost btn-sm" onclick="deleteEstudoBacklog(${item.id})" style="color:var(--red)">✕</button>
        </div>
      </div>
    </div>`;
  }

  let html = '';
  if (backlog.length) {
    html += `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:6px">● Backlog (${backlog.length})</div>`;
    html += backlog.map(renderItem).join('');
  }
  if (planejados.length) {
    html += `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin:10px 0 6px">📅 Planejados (${planejados.length})</div>`;
    html += planejados.map(renderItem).join('');
  }
  if (concluidos.length) {
    html += `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin:10px 0 6px">✓ Recentes</div>`;
    html += concluidos.map(renderItem).join('');
  }
  if (!html) {
    html = '<p style="color:var(--text-dim);font-size:12px">Nenhum item no backlog. Clique em "+ Adicionar" para adicionar.</p>';
  }
  el.innerHTML = html;
}



function calcAcerto() {
  var resolvidas = parseInt(document.getElementById('conc-questoes-feitas').value) || 0;
  var certas = parseInt(document.getElementById('conc-questoes-certas').value) || 0;
  var acertoEl = document.getElementById('conc-acerto');
  if (resolvidas > 0 && acertoEl) {
    var pct = Math.round((certas / resolvidas) * 100);
    acertoEl.value = Math.min(100, pct);
  } else if (acertoEl) {
    acertoEl.value = '';
  }
}


function reabrirEstudo(id) {
  var item = studyBacklog.find(x => x.id === id);
  if (!item) return;
  if (!confirm('Reabrir este estudo? O registro de conclusão, sessão e questões serão removidos.')) return;

  // 1. Revert status
  item.status = item.atividadeId ? 'planejado' : 'backlog';

  // 2. Remove sessoes — by ID first, then fallback to date+disciplina
  if (item.sessaoIds && item.sessaoIds.length) {
    sessoes = sessoes.filter(function(s) { return item.sessaoIds.indexOf(s.id) === -1; });
  }
  // Also remove by date regardless (catches both old and new format)
  if (item.concluidoEm) {
    sessoes = sessoes.filter(function(s) {
      return !(s.disciplina === item.materia && s.data === item.concluidoEm);
    });
  }

  // 3. Remove questaoSessoes — by ID first, then fallback
  if (item.questaoIds && item.questaoIds.length) {
    questaoSessoes = questaoSessoes.filter(function(q) { return item.questaoIds.indexOf(q.id) === -1; });
  }
  // Also remove by date+disciplina+fonte regardless
  if (item.concluidoEm) {
    questaoSessoes = questaoSessoes.filter(function(q) {
      return !(q.disciplina === item.materia && q.data === item.concluidoEm);
    });
  }

  // 4. Remove revisoes pendentes from this study
  revisoesPendentes = revisoesPendentes.filter(function(r) {
    if (item.revisaoIds && item.revisaoIds.length) {
      return item.revisaoIds.indexOf(r.id) === -1;
    }
    return !(!r.concluida && (r.matId === item.matId ||
      (r.nome && r.nome.includes(item.materia))));
  });

  // 5. Undo topico status and data
  var mat = curriculo.find(function(m) { return m.id === item.matId; });
  if (mat) {
    item.topicosIdx.forEach(function(ti) {
      curTopicosStatus[item.matId + '_' + ti] = 'andamento';
      delete curTopicosData[item.matId + '_' + ti];
    });
  }

  // 6. Revert atividade done status
  if (item.atividadeId) {
    var atv = atividades.find(function(a) { return a.id === item.atividadeId; });
    if (atv) atv.done = false;
  }

  // 7. Clear conclusion data
  item.tempoConcluido = null;
  item.questoesConcluidas = null;
  item.acerto = null;
  item.concluidoEm = null;
  item.sessaoIds = [];
  item.questaoIds = [];
  item.revisaoIds = [];

  lsSave();
  scheduleSave();
  renderEstudosBacklog();
  renderAtividades();
  renderDesempenho();
  renderRevisoes();
  renderHorasDisc();
  renderSessoes();
  renderEstudosCur();
  showToast('↩ Estudo reaberto');
}

function editarConclusao(id) {
  var item = studyBacklog.find(x => x.id === id);
  if (!item) return;
  document.getElementById('conc-study-id').value = id;
  document.getElementById('conc-desc').value = item.materia + ' — ' + item.topicos.join(', ');
  document.getElementById('conc-tempo').value = item.tempoConcluido || '';
  document.getElementById('conc-questoes-feitas').value = item.questoesConcluidas || '';
  document.getElementById('conc-questoes-certas').value = '';
  document.getElementById('conc-acerto').value = item.acerto != null ? item.acerto : '';
  document.getElementById('conc-revisao').checked = false;
  document.getElementById('conc-data').value = item.concluidoEm || todayLocal();
  openModal('modal-concluir-estudo');
}



function calcAcertoReg() {
  var total = parseInt(document.getElementById('reg-questoes-total')?.value) || 0;
  var certas = parseInt(document.getElementById('reg-questoes-certas')?.value) || 0;
  var el = document.getElementById('reg-acerto');
  if (total > 0 && el) el.value = Math.min(100, Math.round((certas/total)*100));
  else if (el) el.value = '';
}


function calcAcertoQ() {
  var total = parseInt(document.getElementById('q-total')?.value) || 0;
  var certas = parseInt(document.getElementById('q-acertos')?.value) || 0;
  // Store percentage for display (saveQuestao will calculate)
}

function openEditQuestao(id) {
  var q = questaoSessoes.find(x => x.id === id);
  if (!q) return;
  document.getElementById('q-edit-id').value = id;
  document.getElementById('q-disciplina').value = q.disciplina;
  document.getElementById('q-total').value = q.total;
  document.getElementById('q-acertos').value = q.acertos;
  document.getElementById('q-fonte').value = q.fonte || '';
  document.getElementById('q-tema').value = q.tema || '';
  document.getElementById('q-revisao').value = '0';
  document.getElementById('q-delete-btn').style.display = 'inline-flex';
  openModal('modal-questao');
}

function deleteQuestaoSessao() {
  var id = parseInt(document.getElementById('q-edit-id').value);
  if (!id || !confirm('Excluir este registro?')) return;
  questaoSessoes = questaoSessoes.filter(q => q.id !== id);
  lsSave();
  scheduleSave();
  closeModal('modal-questao');
  renderDesempenho();
  showToast('🗑️ Registro excluído');
}



// ══ SESSÕES — EDITAR / EXCLUIR ══
function editSessao(id) {
  const s = sessoes.find(x => x.id === id);
  if (!s) return;
  const mins = s.durMin != null ? s.durMin : (s.duracao ? Math.round(s.duracao/60) : 0);
  const dateStr = s.data || (s.inicio ? dateToLocal(new Date(s.inicio + 'T12:00:00')) : todayLocal());
  document.getElementById('sess-edit-id').value = id;
  const sessDiscEl = document.getElementById('sess-disc');
  if (sessDiscEl) {
    sessDiscEl.innerHTML = DISCIPLINAS.map(d => `<option value="${escHtml(d)}"${d===s.disciplina?' selected':''}>${escHtml(d)}</option>`).join('');
  }
  document.getElementById('sess-data').value = dateStr;
  document.getElementById('sess-mins').value = mins;
  openModal('modal-sessao-edit');
}

function saveSessaoEdit() {
  const id = parseInt(document.getElementById('sess-edit-id').value);
  const s = sessoes.find(x => x.id === id);
  if (!s) return;
  s.disciplina = document.getElementById('sess-disc').value;
  s.data = document.getElementById('sess-data').value;
  s.durMin = parseInt(document.getElementById('sess-mins').value) || 0;
  s.duracao = s.durMin * 60;
  lsSave();
  scheduleSave();
  closeModal('modal-sessao-edit');
  renderSessoes();
  renderHorasDisc();
  showToast('✏️ Sessão atualizada');
}

function deleteSessao(id) {
  if (!confirm('Excluir esta sessão?')) return;
  sessoes = sessoes.filter(x => x.id !== id);
  lsSave();
  scheduleSave();
  renderSessoes();
  renderHorasDisc();
  updateMetaRing();
  showToast('🗑️ Sessão excluída');
}



function toggleDesemp(disc) {
  var id = 'desemp-detail-' + disc.replace(/[^a-zA-Z0-9]/g, '_');
  var el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function deleteQuestaoById(id) {
  if (!confirm('Excluir este registro de questões?')) return;
  questaoSessoes = questaoSessoes.filter(function(q) { return q.id !== id; });
  lsSave();
  scheduleSave();
  renderDesempenho();
  showToast('🗑️ Registro excluído');
}



// ══ HISTÓRICO DE ESTUDOS POR TÓPICO ══
function toggleHistorico(key) {
  var el = document.getElementById('top-hist-' + key);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function editHistoricoSession(mid, topicoIdx, histIdx) {
  var d = curTopicosData[mid + '_' + topicoIdx];
  if (!d || !d.historico || !d.historico[histIdx]) return;
  var h = d.historico[histIdx];
  document.getElementById('hist-mat-id').value = mid;
  document.getElementById('hist-topico-idx').value = topicoIdx;
  document.getElementById('hist-hist-idx').value = histIdx;
  document.getElementById('hist-data').value = h.date || '';
  document.getElementById('hist-tempo').value = h.tempo || '';
  document.getElementById('hist-acerto-total').value = '';
  document.getElementById('hist-acerto-certas').value = '';
  document.getElementById('hist-acerto-pct').value = h.acerto != null ? h.acerto : '';
  openModal('modal-hist-edit');
}

function calcAcertoHist() {
  var total = parseInt(document.getElementById('hist-acerto-total').value) || 0;
  var certas = parseInt(document.getElementById('hist-acerto-certas').value) || 0;
  var el = document.getElementById('hist-acerto-pct');
  if (total > 0 && el) el.value = Math.min(100, Math.round((certas/total)*100));
}

function saveHistoricoEdit() {
  var mid = parseInt(document.getElementById('hist-mat-id').value);
  var ti = parseInt(document.getElementById('hist-topico-idx').value);
  var hi = parseInt(document.getElementById('hist-hist-idx').value);
  var d = curTopicosData[mid + '_' + ti];
  if (!d || !d.historico || !d.historico[hi]) return;
  d.historico[hi].date = document.getElementById('hist-data').value;
  d.historico[hi].tempo = parseInt(document.getElementById('hist-tempo').value) || 0;
  var pct = document.getElementById('hist-acerto-pct').value;
  d.historico[hi].acerto = pct !== '' ? parseInt(pct) : null;
  // Update main record to last session data
  d.date = d.historico[d.historico.length-1].date;
  d.tempo = d.historico[d.historico.length-1].tempo;
  d.acerto = d.historico[d.historico.length-1].acerto;
  lsSave();
  scheduleSave();
  closeModal('modal-hist-edit');
  renderEstudosCur();
  showToast('✏️ Registro atualizado');
}

function deleteHistoricoSession(mid, topicoIdx, histIdx) {
  if (!confirm('Excluir este registro de estudo?')) return;
  var d = curTopicosData[mid + '_' + topicoIdx];
  if (!d || !d.historico) return;
  d.historico.splice(histIdx, 1);
  if (d.historico.length === 0) {
    // No more sessions — revert to pending
    delete curTopicosData[mid + '_' + topicoIdx];
    curTopicosStatus[mid + '_' + topicoIdx] = 'pendente';
  } else {
    // Update main record to last session
    var last = d.historico[d.historico.length-1];
    d.date = last.date; d.tempo = last.tempo; d.acerto = last.acerto;
  }
  lsSave();
  scheduleSave();
  renderEstudosCur();
  showToast('🗑️ Registro excluído');
}



// ══ DESEMPENHO POR DISCIPLINA ══
function renderDesempenho() {
  const el = document.getElementById('desempenho-list');
  if (!el) return;
  if (!questaoSessoes.length) {
    el.innerHTML = '<p style="color:var(--text-dim);font-size:12px">Registre sessões de questões.</p>';
    return;
  }
  const map = {};
  questaoSessoes.forEach(function(s) {
    if (!map[s.disciplina]) map[s.disciplina] = {total:0, acertos:0};
    map[s.disciplina].total   += (s.total || 0);
    const acerts = s.acertos != null ? s.acertos : (s.total && s.acerto != null ? Math.round(s.total * s.acerto / 100) : 0);
    map[s.disciplina].acertos += acerts;
  });
  const sorted = Object.entries(map).map(function([d,v]) {
    const pct = v.total ? Math.round(v.acertos/v.total*100) : 0;
    return {d, pct, total:v.total, acertos:v.acertos};
  }).sort((a,b) => a.pct - b.pct);
  el.innerHTML = sorted.map(function({d, pct, total, acertos}) {
    const color = pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
    const discSessoes = questaoSessoes.filter(function(q) { return q.disciplina === d; });
    const sessDetail = discSessoes.map(function(q) {
      return `<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;background:var(--surface);border-radius:4px;margin-top:3px">
        <span style="flex:1;font-size:10px;color:var(--text-muted)">${q.data||''} ${q.tema?'· '+escHtml(q.tema.slice(0,30)):''}</span>
        <span style="font-size:10px;color:var(--text-dim)">${q.acertos||0}/${q.total||0}</span>
        <span style="font-size:10px;color:${acertoColor(q.acerto||0)}">${q.acerto||0}%</span>
        <button onclick="event.stopPropagation();deleteQuestaoById(${q.id})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:11px;padding:0 3px">✕</button>
      </div>`;
    }).join('');
    return `<div style="margin-bottom:6px">
      <div class="disc-row" style="cursor:pointer" onclick="toggleDesemp('${d.replace(/[^a-zA-Z0-9]/g,'_')}')">
        <div class="disc-name" title="${escHtml(d)}">${escHtml(d)}</div>
        <div class="disc-bar-bg"><div class="disc-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="disc-pct" style="color:${color}">${pct}%</div>
        <div class="disc-q">${acertos}/${total}</div>
      </div>
      <div id="desemp-detail-${d.replace(/[^a-zA-Z0-9]/g,'_')}" style="display:none;padding:0 4px">${sessDetail}</div>
    </div>`;
  }).join('');
}

// ══ REVISÕES PENDENTES ══
function renderRevisoes() {
  const el = document.getElementById('revisoes-list');
  const cnt = document.getElementById('revisoes-count');
  if (!el) return;
  const today = todayLocal();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const tomorrowStr = dateToLocal(tomorrow);
  const in3 = new Date(); in3.setDate(in3.getDate()+3);
  const in3Str = dateToLocal(in3);
  const allPending = revisoesPendentes.map(function(r) {
    return { id:r.id, data:r.data||r.dataRev||'', tema:r.tema||r.nome||'', etapa:r.etapa||r.dias||0, concluida:r.concluida||false };
  }).filter(function(r) { return r.data >= today && !r.concluida; })
    .sort(function(a,b) { return a.data.localeCompare(b.data); });
  const urgentPending = allPending.filter(function(r) { return r.data <= in3Str; });
  if (cnt) cnt.textContent = urgentPending.length || allPending.length;
  if (!allPending.length) {
    el.innerHTML = '<p style="color:var(--text-dim);font-size:12px">Nenhuma revisão agendada.</p>';
    return;
  }
  el.innerHTML = allPending.slice(0,10).map(function(r) {
    var badgeCls = 'proxima', badgeLabel = fmtDate(r.data);
    if (r.data === today)            { badgeCls='hoje';   badgeLabel='Hoje'; }
    else if (r.data === tomorrowStr) { badgeCls='amanha'; badgeLabel='Amanhã'; }
    return `<div class="rev-item">
      <span class="rev-badge ${badgeCls}">${badgeLabel}</span>
      <span class="rev-tema" style="flex:1" title="${escHtml(r.tema)}">${escHtml(r.tema)}</span>
      ${r.etapa ? `<span class="rev-disc">${r.etapa}d</span>` : ''}
      <button onclick="marcarRevisaoConcluida(${r.id})" style="background:none;border:none;color:var(--green);cursor:pointer;font-size:14px;flex-shrink:0" title="Feita">✓</button>
    </div>`;
  }).join('');
}



// ══ CRONÔMETRO SIMPLES + POMODORO ══
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let timerStartTime = null;
let timerMode = 'livre'; // 'livre' | 'pomodoro'
let pomodoroPhase = 'foco'; // 'foco' | 'descanso'
let pomodoroCount = 0; // completed focus sessions
const POMO_FOCO = 50 * 60;     // 50 min
const POMO_DESCANSO = 10 * 60; // 10 min

function timerSetMode(mode) {
  if (timerRunning) return; // can't switch while running
  timerMode = mode;
  timerSeconds = 0;
  pomodoroPhase = 'foco';
  pomodoroCount = 0;
  var btnL = document.getElementById('timer-mode-livre');
  var btnP = document.getElementById('timer-mode-pomodoro');
  var info = document.getElementById('timer-pomodoro-info');
  var label = document.getElementById('timer-phase-label');
  if (btnL) btnL.style.background = mode === 'livre' ? 'var(--violet)' : '';
  if (btnL) btnL.style.color = mode === 'livre' ? '#fff' : '';
  if (btnP) btnP.style.background = mode === 'pomodoro' ? 'var(--violet)' : '';
  if (btnP) btnP.style.color = mode === 'pomodoro' ? '#fff' : '';
  if (info) info.style.display = mode === 'pomodoro' ? 'block' : 'none';
  if (label) label.textContent = mode === 'pomodoro' ? '🎯 Foco — 50min' : '';
  timerUpdateDisplay();
  timerUpdatePomoDots();
}

function timerStart() {
  timerRunning = true;
  if (timerMode === 'pomodoro' && timerSeconds === 0) {
    // Starting a new phase
    timerSeconds = pomodoroPhase === 'foco' ? POMO_FOCO : POMO_DESCANSO;
  }
  timerStartTime = Date.now() - (timerMode === 'livre' ? timerSeconds * 1000 : 0);
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(timerTick, 1000);
  document.getElementById('timer-start-btn').style.display = 'none';
  document.getElementById('timer-pause-btn').style.display = 'inline-block';
  document.getElementById('timer-stop-btn').style.display = 'inline-block';
  var disp = document.getElementById('timer-display');
  if (disp) disp.classList.add('timer-running');
  var label = document.getElementById('timer-phase-label');
  if (label && timerMode === 'pomodoro') {
    label.textContent = pomodoroPhase === 'foco' ? '🎯 Foco' : '☕ Descanso';
    label.style.color = pomodoroPhase === 'foco' ? 'var(--violet-light)' : 'var(--green)';
  }
}

function timerPause() {
  if (timerRunning) {
    timerRunning = false;
    clearInterval(timerInterval);
    document.getElementById('timer-pause-btn').textContent = '▶ Retomar';
    document.getElementById('timer-display').classList.remove('timer-running');
  } else {
    timerRunning = true;
    if (timerMode === 'livre') timerStartTime = Date.now() - timerSeconds * 1000;
    if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(timerTick, 1000);
    document.getElementById('timer-pause-btn').textContent = '⏸ Pausar';
    document.getElementById('timer-display').classList.add('timer-running');
  }
}

function timerStop() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = 0;
  pomodoroPhase = 'foco';
  timerUpdateDisplay();
  document.getElementById('timer-display').classList.remove('timer-running');
  document.getElementById('timer-start-btn').style.display = 'inline-block';
  document.getElementById('timer-pause-btn').style.display = 'none';
  document.getElementById('timer-stop-btn').style.display = 'none';
  document.getElementById('timer-pause-btn').textContent = '⏸ Pausar';
  var label = document.getElementById('timer-phase-label');
  if (label) label.textContent = timerMode === 'pomodoro' ? '🎯 Foco — 50min' : '';
  if (label) label.style.color = '';
}

function timerTick() {
  if (timerMode === 'livre') {
    // Count UP
    timerSeconds = Math.round((Date.now() - timerStartTime) / 1000);
  } else {
    // Pomodoro: count DOWN
    timerSeconds--;
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      // Phase complete
      if (pomodoroPhase === 'foco') {
        pomodoroCount++;
        pomodoroPhase = 'descanso';
        timerSeconds = 0;
        timerUpdatePomoDots();
        showToast('☕ Foco concluído! Descanse 10 minutos.');
        // Auto-start break
        var label = document.getElementById('timer-phase-label');
        if (label) { label.textContent = '☕ Descanso — 10min'; label.style.color = 'var(--green)'; }
        timerSeconds = POMO_DESCANSO;
        timerRunning = true;
        if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(timerTick, 1000);
      } else {
        pomodoroPhase = 'foco';
        timerSeconds = 0;
        showToast('🎯 Descanso concluído! Pronta para mais?');
        var label = document.getElementById('timer-phase-label');
        if (label) { label.textContent = '🎯 Foco — 50min'; label.style.color = ''; }
        document.getElementById('timer-display').classList.remove('timer-running');
        document.getElementById('timer-start-btn').style.display = 'inline-block';
        document.getElementById('timer-pause-btn').style.display = 'none';
        document.getElementById('timer-stop-btn').style.display = 'none';
        document.getElementById('timer-pause-btn').textContent = '⏸ Pausar';
      }
    }
  }
  timerUpdateDisplay();
}

function timerUpdateDisplay() {
  var secs = timerSeconds;
  var h = Math.floor(secs / 3600);
  var m = Math.floor((secs % 3600) / 60);
  var sec = secs % 60;
  var disp = document.getElementById('timer-display');
  if (disp) {
    if (h > 0) disp.textContent = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
    else disp.textContent = String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
  }
}

function timerUpdatePomoDots() {
  var dots = document.getElementById('timer-pomo-dots');
  var cnt = document.getElementById('timer-pomo-count');
  if (dots) {
    var html = '';
    for (var i = 0; i < Math.max(4, pomodoroCount + 1); i++) {
      var filled = i < pomodoroCount;
      html += '<div style="width:8px;height:8px;border-radius:50%;background:' + (filled ? 'var(--green)' : 'var(--border)') + '"></div>';
    }
    dots.innerHTML = html;
  }
  if (cnt) cnt.textContent = pomodoroCount + ' sessões completas';
}

function renderTimer() {
  timerSetMode(timerMode);
}



// ══ LOCK / SENHA ══
const LOCK_KEY      = 'painel_lock_hash';
const LOCK_EMAIL_KEY= 'painel_lock_email';
const LOCK_EJS_KEY  = 'painel_lock_ejs';   // {serviceId, templateId, publicKey}


async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function lockSetHash(h) {
  localStorage.setItem(LOCK_KEY, h);
  // Backup: force-write so cache can't prevent it
  try { sessionStorage.setItem(LOCK_KEY + '_bk', h); } catch(e) {}
}
function lockSetEmail(e){ localStorage.setItem(LOCK_EMAIL_KEY, e); }
function lockGetEjs()   { try { return JSON.parse(localStorage.getItem(LOCK_EJS_KEY)) || null; } catch(e){ return null; } }
function lockSetEjs(o)  { localStorage.setItem(LOCK_EJS_KEY, JSON.stringify(o)); }


function lockHide() {
  lockActive = false;
  var el = document.getElementById('lock-screen');
  if (el) {
    el.classList.remove('visible');
    el.style.height = '';
    el.style.bottom = '';
    if (el._fitFn && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', el._fitFn);
    }
  }
  document.body.classList.remove('locked');
  lockResetTimer();
}




function lockForgot() {
  var email = lockGetEmail();
  var ejs   = lockGetEjs();
  var errEl = document.getElementById('lock-err');
  if (!email || !ejs || !ejs.serviceId || !ejs.publicKey) {
    errEl.textContent = 'Email não configurado. Use o código de emergência ou recrie o painel.';
    return;
  }
  // Generate 6-digit code, store hash of it
  lockRecoveryCode = Math.floor(100000 + Math.random() * 900000).toString();
  // Send via EmailJS
  emailjs.init({ publicKey: ejs.publicKey });
  emailjs.send(ejs.serviceId, ejs.templateId, {
    to_email: email,
    recovery_code: lockRecoveryCode
  }).then(function() {
    // Show code input
    var recW = document.getElementById('lock-recovery-wrap');
    var btn  = document.getElementById('lock-btn');
    var sub  = document.getElementById('lock-sub');
    var hint = document.getElementById('lock-hint');
    var extBtns = document.getElementById('lock-extra-btns');
    recW.style.display = 'block';
    document.getElementById('lock-input').style.display = 'none';
    btn.textContent = 'Verificar código';
    btn.dataset.mode = 'verify-code';
    sub.textContent = 'Código enviado para ' + email.replace(/(.{2}).+(@.+)/, '$1…$2');
    hint.textContent = 'Verifique seu email e digite o código de 6 dígitos.';
    if (extBtns) extBtns.style.display = 'none';
    errEl.textContent = '';
    showToast('📧 Código enviado para ' + email.replace(/(.{2}).+(@.+)/, '$1…$2'));
  }).catch(function(err) {
    errEl.textContent = 'Erro ao enviar email. Verifique as configurações do EmailJS.';
    console.error('EmailJS error:', err);
  });
}

function lockVerifyCode() {
  var inp   = document.getElementById('lock-recovery-input');
  var errEl = document.getElementById('lock-err');
  var code  = inp ? inp.value.trim() : '';
  if (!lockRecoveryCode) { errEl.textContent = 'Solicite um novo código.'; return; }
  if (code === lockRecoveryCode) {
    // Code OK — enter "change password" mode
    lockRecoveryCode = null;
    var recW = document.getElementById('lock-recovery-wrap');
    var btn  = document.getElementById('lock-btn');
    var sub  = document.getElementById('lock-sub');
    var hint = document.getElementById('lock-hint');
    var pwInp = document.getElementById('lock-input');
    recW.style.display = 'none';
    pwInp.style.display = 'block';
    pwInp.value = '';
    btn.textContent = 'Salvar nova senha';
    btn.dataset.mode = 'create';
    sub.textContent = 'Crie uma nova senha';
    hint.textContent = 'Mínimo 4 caracteres.';
    document.getElementById('lock-email-wrap').style.display = 'none';
    document.getElementById('lock-ejs-wrap').style.display = 'none';
    errEl.textContent = '';
    setTimeout(function(){ pwInp.focus(); }, 100);
  } else {
    errEl.textContent = 'Código incorreto. Tente novamente.';
    inp.classList.add('error');
  }
}

function lockInit() {
  var hash = lockGetHash();
  console.log('[LOCK] hash found:', !!hash, '| key:', LOCK_KEY);
  // Se há hash cadastrado → pede senha. Se não → modo criação de senha.

  ['click','keydown','mousemove','touchstart','scroll'].forEach(function(ev) {
    document.addEventListener(ev, lockActivityReset, { passive: true });
  });
}

function lockChangePassword() {
  var el    = document.getElementById('lock-screen');
  var sub   = document.getElementById('lock-sub');
  var btn   = document.getElementById('lock-btn');
  var hint  = document.getElementById('lock-hint');
  var emailW= document.getElementById('lock-email-wrap');
  var ejsW  = document.getElementById('lock-ejs-wrap');
  var recW  = document.getElementById('lock-recovery-wrap');
  var extBtns = document.getElementById('lock-extra-btns');
  var pwInp = document.getElementById('lock-input');
  if (!el) return;
  el.classList.add('visible');
  document.body.classList.add('locked');
  var shell = document.querySelector('.app-shell');
  var bnav = document.querySelector('.bottom-nav');
  if (shell) shell.style.display = 'none';
  if (bnav) bnav.style.display = 'none';
  lockActive = true;
  recW.style.display   = 'none';
  pwInp.style.display  = 'block';
  emailW.style.display = 'block';
  ejsW.style.display   = 'block';
  sub.textContent  = 'Redefina sua senha e email de recuperação';
  btn.textContent  = 'Salvar';
  hint.textContent = 'Mínimo 4 caracteres.';
  btn.dataset.mode = 'create';
  if (extBtns) extBtns.style.display = 'none';
  // Pre-fill email
  var emailEl = document.getElementById('lock-email');
  if (emailEl) emailEl.value = lockGetEmail() || '';
  var ejs = lockGetEjs() || {};
  var svcEl = document.getElementById('lock-ejs-service');
  var tplEl = document.getElementById('lock-ejs-template');
  var pubEl = document.getElementById('lock-ejs-pubkey');
  if (svcEl) svcEl.value = ejs.serviceId || '';
  if (tplEl) tplEl.value = ejs.templateId || '';
  if (pubEl) pubEl.value = ejs.publicKey || '';
  document.getElementById('lock-err').textContent = '';
  document.getElementById('lock-input').value = '';
  setTimeout(function(){ document.getElementById('lock-input').focus(); }, 100);
}



// === DIAGNÓSTICO TEMPORÁRIO — barra preta ===


// ══ LOCK SCREEN ══
const LOCK_TIMEOUT = 10 * 60 * 1000;
let lockTimer = null;
let lockActive = false;
let lockRecoveryCode = null;
