
function lockGetHash() { return localStorage.getItem('painel_lock_hash'); }
function lockGetEmail() { return localStorage.getItem('painel_lock_email') || ''; }
function lockSaveHash(h) { localStorage.setItem('painel_lock_hash', h); }

async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function lockShow(isFirst) {
  lockActive = true;
  var el    = document.getElementById('lock-screen');
  // Reposiciona o card via JS para sobreviver ao teclado virtual (independe de cache CSS)
  if (el) {
    el.style.justifyContent = 'flex-start';
    el.style.alignItems = 'center';
    el.style.overflowY = 'auto';
    el.style.paddingTop = '0';
    el.style.paddingBottom = '0';
    var card = el.querySelector('.lock-card');
    if (card) {
      card.style.marginTop = '6vh';
      card.style.marginBottom = '40px';
      card.style.flexShrink = '0';
    }
    // Ajusta altura à viewport visível (visualViewport reage ao teclado)
    var _fitRAF = null;
    fitToViewport = function() {
      if (_fitRAF) return;
      _fitRAF = requestAnimationFrame(function() {
        _fitRAF = null;
        var vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
        el.style.height = vh + 'px';
        el.style.bottom = 'auto';
      });
    };
    fitToViewport();
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', fitToViewport);
      window.visualViewport.addEventListener('resize', fitToViewport);
      el._fitFn = fitToViewport;
    }
  }
  var sub   = document.getElementById('lock-sub');
  var btn   = document.getElementById('lock-btn');
  var hint  = document.getElementById('lock-hint');
  var inp   = document.getElementById('lock-input');
  var emailW= document.getElementById('lock-email-wrap');
  var ejsW  = document.getElementById('lock-ejs-wrap');
  var recW  = document.getElementById('lock-recovery-wrap');
  var extBtns = document.getElementById('lock-extra-btns');
  if (!el) return;
  el.classList.add('visible');

  if (recW) recW.style.display = 'none';
  if (emailW) emailW.style.display = 'none';
  if (ejsW) ejsW.style.display = 'none';
  if (isFirst) {
    if (sub) sub.textContent = 'Crie uma senha para proteger o painel';
    if (btn) { btn.textContent = 'Criar senha'; btn.dataset.mode = 'create'; }
    if (emailW) emailW.style.display = 'block';
    if (ejsW) ejsW.style.display = 'flex';
    if (extBtns) extBtns.style.display = 'none';
  } else {
    if (sub) sub.textContent = 'Digite sua senha para continuar';
    if (btn) { btn.textContent = 'Entrar'; btn.dataset.mode = 'unlock'; }
    if (extBtns) extBtns.style.display = lockGetEmail() ? 'flex' : 'none';
  }
  if (inp) { inp.value = ''; setTimeout(function(){ inp.focus(); }, 300); }
  var err = document.getElementById('lock-err');
  if (err) err.textContent = '';
}

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
  lockResetTimer();
}

async function lockSubmit() {
  var inp   = document.getElementById('lock-input');
  var errEl = document.getElementById('lock-err');
  var btn   = document.getElementById('lock-btn');
  var val   = inp ? inp.value.trim() : '';
  if (!val) return;
  if (btn && btn.dataset.mode === 'create') {
    if (val.length < 4) { if(errEl) errEl.textContent = 'Mínimo 4 caracteres'; inp.classList.add('error'); return; }
    var h = await sha256(val);
    lockSaveHash(h);
    var emailInp = document.getElementById('lock-email');
    if (emailInp && emailInp.value.trim()) localStorage.setItem('painel_lock_email', emailInp.value.trim());
    lockHide();
    showToast('🔒 Senha criada');
  } else {
    var h2 = await sha256(val);
    if (h2 === lockGetHash()) {
      lockHide();
    } else {
      if(errEl) errEl.textContent = 'Senha incorreta';
      if(inp) inp.classList.add('error');
    }
  }
}

function lockResetTimer() {
  clearTimeout(lockTimer);
  lockTimer = setTimeout(function() {
    if (lockGetHash()) { lockRecoveryCode = null; lockShow(false); }
  }, LOCK_TIMEOUT);
}

function lockActivityReset() { if (!lockActive) lockResetTimer(); }

function lockForgotPassword() {
  var recW = document.getElementById('lock-recovery-wrap');
  var sub  = document.getElementById('lock-sub');
  var btn  = document.getElementById('lock-btn');
  if (recW) recW.style.display = 'block';
  if (sub) sub.textContent = 'Digite o código de recuperação enviado por email';
  if (btn) { btn.textContent = 'Recuperar'; btn.dataset.mode = 'recover'; }
}
['mousemove','keydown','touchstart','scroll','click'].forEach(function(ev) {
  document.addEventListener(ev, lockActivityReset, { passive: true });
});

// ══ JOGO FINANCEIRO ══
let parcelamentos = JSON.parse(localStorage.getItem('jogo_parcelamentos') || '[]');
let economias     = JSON.parse(localStorage.getItem('jogo_economias')     || '[]');
let jogoSort  = 'valor';   // valor | data | restantes | pagas
let jogoSortAsc = false;
let jogoXP        = parseInt(localStorage.getItem('jogo_xp')              || '0');
let jogoMoedas    = parseInt(localStorage.getItem('jogo_moedas')          || '0');
let jogoStreak    = parseInt(localStorage.getItem('jogo_streak')          || '0');
let jogoLastDay   = localStorage.getItem('jogo_last_day')                  || '';
// Se nunca teve lastDay registrado, zera o streak (evita valor falso)
if (!jogoLastDay && jogoStreak > 0) { jogoStreak = 0; }
let nextParcId    = parseInt(localStorage.getItem('jogo_next_parc_id')    || '1');
let nextEcoId     = parseInt(localStorage.getItem('jogo_next_eco_id')     || '1');

function jogoSave() {
  // Salva localmente via lsSave (que inclui dados do jogo)
  lsSave();
  // Envia para a nuvem
  if (typeof cloudSave === 'function') cloudSave();
}

function jogoLevel() {
  var levels = [0,100,300,600,1000,1500,2200,3000,4000,5500,7500];
  for (var i = levels.length-1; i >= 0; i--) {
    if (jogoXP >= levels[i]) return {level: i+1, current: jogoXP - levels[i], next: (levels[i+1]||99999) - levels[i], title: ['','Iniciante','Controlador','Economizador','Estrategista','Guerreiro Financeiro','Mestre do Orçamento','Domador de Dívidas','Caçador de Parcelas','Campeão da Liberdade','Lenda Financeira'][i+1]||'Lenda'};
  }
  return {level:1, current:jogoXP, next:100, title:'Iniciante'};
}

function jogoAddXP(xp, msg) {
  jogoXP += xp;
  jogoMoedas += Math.floor(xp / 5);
  jogoSave();
  showToast('⚡ +' + xp + ' XP — ' + msg);
  if (document.getElementById('jogo-section') && document.getElementById('jogo-section').style.display !== 'none') renderJogo();
}

function jogoUpdateStreak() {
  // Streak = dias desde o gasto parcelado mais recente (data_inicio)
  if (!parcelamentos.length) { jogoStreak = 0; jogoSave(); return; }
  var hoje = new Date();
  hoje.setHours(0,0,0,0);
  // Usa data_inicio (data real do gasto) como referência
  var parcComData = parcelamentos.filter(function(p){ return p.data_inicio; });
  if (!parcComData.length) { jogoStreak = 0; jogoSave(); return; }
  var datas = parcComData.map(function(p){ return new Date(p.data_inicio + 'T00:00:00'); });
  var maisRecente = new Date(Math.max.apply(null, datas));
  maisRecente.setHours(0,0,0,0);
  var diffMs = hoje - maisRecente;
  jogoStreak = Math.max(0, Math.floor(diffMs / 86400000));
  jogoSave();
}

// ══ JOGO FINANCEIRO — FUNÇÕES ══

function switchFinTab(tab) {
  var main = document.getElementById('fin-main-section');
  var jogo = document.getElementById('jogo-section');
  var vf   = document.getElementById('view-finance');
  if (main) { main.style.display = tab === 'main' ? '' : 'none'; main.style.width = '100%'; }
  if (jogo) { jogo.style.display = tab === 'jogo' ? 'block' : 'none'; jogo.style.width = '100%'; }
  if (vf)   { vf.style.maxWidth = '100%'; }
  document.getElementById('fin-tab-main').classList.toggle('active', tab === 'main');
  document.getElementById('fin-tab-jogo').classList.toggle('active', tab === 'jogo');
  if (tab === 'jogo') { jogoUpdateStreak(); renderJogo(); }
}

function jogoTotalDivida() {
  return parcelamentos.filter(function(p){ return !p.quitado; })
    .reduce(function(s,p){ return s + (p.parcelas_restantes * p.valor_parcela); }, 0);
}

function jogoTotalPago() {
  return parcelamentos.reduce(function(s,p){ return s + (p.parcelas_pagas * p.valor_parcela); }, 0);
}

function jogoPctTotal() {
  var total = parcelamentos.reduce(function(s,p){ return s + (p.parcelas_total * p.valor_parcela); }, 0);
  if (!total) return 0;
  var pago = jogoTotalPago();
  return Math.min(100, Math.round(pago / total * 100));
}

function jogo_parcelamentoEmoji(p) {
  var restantes = p.parcelas_restantes;
  if (p.quitado) return '✅';
  if (restantes > 24) return '🐉';
  if (restantes > 12) return '🐺';
  if (restantes > 4)  return '🐭';
  return '⚡';
}

function jogo_hpColor(pct) {
  if (pct >= 80) return 'var(--green)';
  if (pct >= 40) return 'var(--amber)';
  return 'var(--red)';
}

function renderJogo() {
  var el = document.getElementById('jogo-main') || document.getElementById('jogo-section');
  if (!el) return;
  var lv = jogoLevel();
  var pct = jogoPctTotal();
  var totalDivida = jogoTotalDivida();
  var totalPago   = jogoTotalPago();
  var missoes = gerarMissoes();
  var conquistas = gerarConquistas();

  // Streak calendar — últimos 21 dias
  var calDays = [];
  var today = new Date();
  today.setHours(0,0,0,0);
  var todayKey = dateToLocal(today);
  // Data do gasto mais recente (data_inicio)
  var lastParcDate = null;
  var parcComData2 = parcelamentos.filter(function(p){ return p.data_inicio; });
  if (parcComData2.length) {
    var datas2 = parcComData2.map(function(p){ return new Date(p.data_inicio + 'T00:00:00'); });
    lastParcDate = new Date(Math.max.apply(null, datas2));
    lastParcDate.setHours(0,0,0,0);
  }
  for (var i = 20; i >= 0; i--) {
    var d = new Date(today.getTime() - i*86400000);
    d.setHours(0,0,0,0);
    var key = dateToLocal(d);
    // Usa data_inicio (data real do gasto)
    var hasParc = parcelamentos.some(function(p){
      return p.data_inicio === key;
    });
    // "on" (roxo) = dia estritamente APÓS o gasto mais recente (streak)
    var inStreak = lastParcDate ? (d.getTime() > lastParcDate.getTime()) : false;
    calDays.push({ key:key, day:d.getDate(), on: inStreak, hasParc: hasParc, isToday: key===todayKey });
  }

  var xpPct = Math.min(100, Math.round(lv.current / lv.next * 100));
  var html = '';

  // ── HEADER ──
  html += '<div class="jogo-header">';
  html += '<div class="jogo-level"><span class="lv-label">Nv</span><span class="lv-num">'+lv.level+'</span></div>';
  html += '<div class="jogo-xp-wrap">';
  html += '<div style="font-size:12px;font-weight:700;color:var(--text)">'+lv.title+'</div>';
  html += '<div class="jogo-xp-bar"><div class="jogo-xp-fill" style="width:'+xpPct+'%"></div></div>';
  html += '<div style="font-size:10px;color:var(--text-muted)">'+lv.current+' / '+lv.next+' XP</div>';
  html += '</div>';
  html += '<div class="jogo-stat"><span class="sv" style="color:var(--amber)">🔥 '+jogoStreak+'</span><span class="sl">dias streak</span></div>';
  html += '<div class="jogo-stat"><span class="sv" style="color:var(--amber)">🪙 '+jogoMoedas+'</span><span class="sl">moedas</span></div>';
  html += '</div>';

  // ── INDICADORES ──
  var totalMensal   = parcelamentos.filter(function(p){return !p.quitado;}).reduce(function(s,p){return s+p.valor_parcela;},0);
  var totalRestante = jogoTotalDivida();
  var qtQuitados    = parcelamentos.filter(function(p){return p.quitado;}).length;
  var qtAtivos      = parcelamentos.filter(function(p){return !p.quitado;}).length;
  var mesesRestantes = totalMensal > 0 ? Math.ceil(totalRestante / totalMensal) : 0;
  var dataQuit = mesesRestantes > 0 ? (function(){ var d=new Date(); d.setMonth(d.getMonth()+mesesRestantes); return d.toLocaleDateString('pt-BR',{month:'short',year:'numeric'}); })() : '—';
  html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px">';
  html += '<div class="card" style="padding:12px;text-align:center"><div style="font-size:18px;font-weight:800;color:var(--red)">'+fmtMoney(totalMensal)+'</div><div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;margin-top:2px">Comprometido/mês</div></div>';
  html += '<div class="card" style="padding:12px;text-align:center"><div style="font-size:18px;font-weight:800;color:var(--amber)">'+fmtMoney(totalRestante)+'</div><div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;margin-top:2px">Total restante</div></div>';
  html += '<div class="card" style="padding:12px;text-align:center"><div style="font-size:18px;font-weight:800;color:var(--violet-light)">'+dataQuit+'</div><div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;margin-top:2px">Previsão quitação</div></div>';
  html += '<div class="card" style="padding:12px;text-align:center"><div style="font-size:18px;font-weight:800;color:var(--green)">'+qtQuitados+' <span style="font-size:12px;color:var(--text-muted)">/ '+(qtQuitados+qtAtivos)+'</span></div><div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;margin-top:2px">Quitados</div></div>';
  html += '</div>';

  // ── BUSCA + BOTÕES ──
  var jogoSearch = (window._jogoSearch || '').toLowerCase();
  html += '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;align-items:center">';
  html += '<input class="form-input" id="jogo-search" placeholder="🔍 Buscar parcelamento..." value="' + escHtml(window._jogoSearch || '') + '" oninput="window._jogoSearch=this.value;renderJogo()" style="flex:1;min-width:160px;padding:7px 12px;font-size:13px">';
  html += '<button class="btn btn-primary btn-sm" onclick="jogo_abrirNovaParcela()">+ Parcelamento</button>';
  html += '<button class="btn btn-ghost btn-sm" onclick="jogo_abrirEconomia()">+ Economia</button>';
  html += '</div>';

  // ── CORRIDA ──
  html += '<div class="card" style="margin-bottom:12px">';
  html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:10px">🏁 Corrida até a Liberdade</div>';
  html += '<div class="race-track-wrap">';
  html += '<div class="race-bar-outer">';
  html += '<div class="race-bar-fill" style="width:'+Math.max(pct,4)+'%"><span style="font-size:14px">🏃‍♀️</span></div>';
  html += '<span style="position:absolute;right:32px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:700;color:var(--text-muted)">'+pct+'%</span>';
  html += '<span style="position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:16px">🏁</span>';
  html += '</div></div>';
  html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:8px">';
  html += '<span>Pago: <strong style="color:var(--green)">'+fmtMoney(totalPago)+'</strong></span>';
  html += '<span>Restante: <strong style="color:var(--red)">'+fmtMoney(totalDivida)+'</strong></span>';
  html += '</div>';

  // Parcelamentos — separados em ativos e quitados
  var parcTodos = jogoSearch
    ? parcelamentos.filter(function(p){ return (p.nome||'').toLowerCase().includes(jogoSearch) || (p.banco||'').toLowerCase().includes(jogoSearch); })
    : parcelamentos;
  var parcAtivos   = parcTodos.filter(function(p){ return !p.quitado; });
  var parcQuitados = parcTodos.filter(function(p){ return  p.quitado; });

  // Ativos
  if (parcAtivos.length) {
    // Ordenação
    var sortedAtivos = parcAtivos.slice().sort(function(a,b){
      var av, bv;
      if (jogoSort==='valor')      { av=a.valor_parcela;       bv=b.valor_parcela; }
      else if (jogoSort==='data')  { av=a.data_inicio||'';     bv=b.data_inicio||''; }
      else if (jogoSort==='restantes') { av=a.parcelas_restantes||0; bv=b.parcelas_restantes||0; }
      else if (jogoSort==='pagas') { av=a.parcelas_pagas||0;   bv=b.parcelas_pagas||0; }
      else { av=a.valor_parcela; bv=b.valor_parcela; }
      return jogoSortAsc ? (av>bv?1:av<bv?-1:0) : (av<bv?1:av>bv?-1:0);
    });

    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin:12px 0 8px;flex-wrap:wrap;gap:6px">';
    html += '<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">⚔️ Parcelamentos ativos' + (jogoSearch ? ' (' + parcAtivos.length + ')' : '') + '</span>';
    html += '<div style="display:flex;gap:4px;flex-wrap:wrap">';
    var sortOpts = [['valor','Valor'],['data','Data'],['restantes','Faltam'],['pagas','Pagas']];
    sortOpts.forEach(function(s){
      var isAct = jogoSort===s[0];
      var arrow = isAct ? (jogoSortAsc ? ' ↑' : ' ↓') : '';
      html += '<button onclick="jogoSetSort(\''+s[0]+'\')" style="font-size:10px;padding:3px 9px;border-radius:15px;cursor:pointer;border:1px solid '+(isAct?'var(--violet)':'var(--border)')+';background:'+(isAct?'var(--violet-glow)':'var(--card)')+';color:'+(isAct?'var(--violet-light)':'var(--text-muted)')+';font-weight:'+(isAct?'700':'400')+'">'+s[1]+arrow+'</button>';
    });
    html += '</div></div>';

    sortedAtivos.forEach(function(p) {
      var qPct = p.parcelas_total > 0 ? Math.round(p.parcelas_pagas / p.parcelas_total * 100) : 0;
      var isHi   = qPct >= 70;
      var cardCls = qPct >= 70 ? 'parc-quase' : (qPct === 0 ? 'parc-novo' : '');
      var totalVal = p.valor_parcela * p.parcelas_total;
      var restVal  = p.valor_parcela * (p.parcelas_restantes || 0);
      var dataFmt  = p.data_inicio ? p.data_inicio.split('-').reverse().join('/') : '—';
      var parcLabel = (p.parcelas_pagas||0) + '/' + p.parcelas_total;

      html += '<div class="parc-card '+cardCls+'">';
      html += '<div class="parc-card-top">';
      html += '<div class="parc-card-nome">'+escHtml(p.nome)+'</div>';
      html += '<div><div class="parc-card-vmes">'+fmtMoney(p.valor_parcela)+'</div><div class="parc-card-vlabel">/mês</div></div>';
      html += '</div>';
      html += '<div class="parc-card-metas">';
      html += '<div class="parc-meta"><span class="parc-meta-label">Parcelas</span><span class="parc-meta-val">'+parcLabel+'</span></div>';
      if (p.banco) html += '<div class="parc-meta"><span class="parc-meta-label">Cartão</span><span class="parc-meta-val">'+escHtml(p.banco)+'</span></div>';
      html += '<div class="parc-meta"><span class="parc-meta-label">Início</span><span class="parc-meta-val">'+dataFmt+'</span></div>';
      html += '<div class="parc-meta"><span class="parc-meta-label">Total</span><span class="parc-meta-val">'+fmtMoney(totalVal)+'</span></div>';
      html += '</div>';
      html += '<div style="display:flex;align-items:center;gap:10px">';
      html += '<div class="parc-card-bar-wrap"><div class="parc-card-bar'+(isHi?' hi':'')+'" style="width:'+qPct+'%"></div></div>';
      html += '<span class="parc-card-pct'+(isHi?' hi':'')+'">'+qPct+'%</span>';
      html += '</div>';
      html += '<div class="parc-card-footer">';
      html += '<span class="parc-card-restante">Faltam <strong>'+fmtMoney(restVal)+'</strong> · '+(p.parcelas_restantes||0)+' parcelas</span>';
      html += '<div style="display:flex;gap:4px">';
      html += '<button class="btn btn-ghost btn-sm parc-btn-pay" style="padding:4px 10px;font-size:10px" onclick="jogo_pagarParcela('+p.id+')">✓ Paguei</button>';
      html += '<button class="btn btn-ghost btn-sm" style="padding:4px 8px;font-size:10px" onclick="jogo_editarParcela('+p.id+')">✏️</button>';
      html += '<button class="btn btn-ghost btn-sm" style="padding:4px 8px;font-size:10px;color:var(--red)" onclick="jogo_excluirParcela('+p.id+')">✕</button>';
      html += '</div>';
      html += '</div>';
      html += '</div>'; // parc-card
    });
  } else if (!jogoSearch) {
    html += '<p style="font-size:12px;color:var(--text-muted);padding:12px 0;text-align:center">Clique em <strong>+ Parcelamento</strong> para cadastrar uma dívida</p>';
  } else {
    html += '<p style="font-size:12px;color:var(--text-muted);padding:12px 0;text-align:center">Nenhum parcelamento ativo encontrado</p>';
  }

  // Quitados
  if (parcQuitados.length) {
    html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--green);margin:16px 0 8px">🎉 Quitados ('+parcQuitados.length+')</div>';
    parcQuitados.forEach(function(p) {
      var totalVal = p.valor_parcela * p.parcelas_total;
      var dataFmt  = p.data_inicio ? p.data_inicio.split('-').reverse().join('/') : '—';
      html += '<div class="parc-card parc-quitado">';
      html += '<div class="parc-card-top">';
      html += '<div class="parc-card-nome">'+escHtml(p.nome)+'</div>';
      html += '<div><div class="parc-card-vmes quitado">'+fmtMoney(p.valor_parcela)+'</div><div class="parc-card-vlabel">/mês</div></div>';
      html += '</div>';
      html += '<div class="parc-card-metas">';
      html += '<div class="parc-meta"><span class="parc-meta-label">Parcelas</span><span class="parc-meta-val">'+p.parcelas_total+'/'+p.parcelas_total+'</span></div>';
      if (p.banco) html += '<div class="parc-meta"><span class="parc-meta-label">Cartão</span><span class="parc-meta-val">'+escHtml(p.banco)+'</span></div>';
      html += '<div class="parc-meta"><span class="parc-meta-label">Total pago</span><span class="parc-meta-val" style="color:var(--green)">'+fmtMoney(totalVal)+'</span></div>';
      html += '</div>';
      html += '<div style="display:flex;align-items:center;gap:10px">';
      html += '<div class="parc-card-bar-wrap"><div class="parc-card-bar hi" style="width:100%"></div></div>';
      html += '<span class="parc-card-pct hi">100%</span>';
      html += '</div>';
      html += '<div class="parc-card-footer">';
      html += '<span class="parc-card-restante" style="color:var(--green)">🎉 Quitado!</span>';
      html += '<button class="btn btn-ghost btn-sm" style="padding:4px 8px;font-size:10px;color:var(--red)" onclick="jogo_excluirParcela('+p.id+')">✕ Remover</button>';
      html += '</div>';
      html += '</div>';
    });
  }
  html += '</div>';


  // ── SIMULADOR ──
  var parcAtivos = parcelamentos.filter(function(p){return !p.quitado;});
  if (parcAtivos.length) {
    var mensal = parcAtivos.reduce(function(s,p){return s+p.valor_parcela;},0);
    var meses0 = totalDivida > 0 ? Math.ceil(totalDivida / mensal) : 0;
    var meses1 = totalDivida > 0 ? Math.ceil(totalDivida / (mensal+300)) : 0;
    var meses2 = totalDivida > 0 ? Math.ceil(totalDivida / (mensal+700)) : 0;
    function addMeses(m) {
      var d2 = new Date(); d2.setMonth(d2.getMonth()+m);
      return d2.toLocaleDateString('pt-BR',{month:'short',year:'numeric'});
    }
    html += '<div class="card" style="margin-bottom:12px">';
    html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px">🔮 Simulador</div>';
    html += '<div class="scenario-jogo">💤 Ritmo atual (<strong>'+fmtMoney(mensal)+'/mês</strong>): termina em <strong style="color:var(--text)">'+addMeses(meses0)+'</strong></div>';
    if (meses1>0 && meses1<meses0) html += '<div class="scenario-jogo" style="border-color:var(--amber)">⚡ +R$300/mês: <strong style="color:var(--amber)">'+addMeses(meses1)+'</strong> <small style="color:var(--text-muted)">('+( meses0-meses1)+' meses antes)</small></div>';
    if (meses2>0 && meses2<meses0) html += '<div class="scenario-jogo" style="border-color:var(--green)">🚀 +R$700/mês: <strong style="color:var(--green)">'+addMeses(meses2)+'</strong> <small style="color:var(--text-muted)">('+( meses0-meses2)+' meses antes)</small></div>';
    html += '</div>';
  }

  // ── LINHA DO TEMPO ──
  var parcAtivosLT = parcelamentos.filter(function(p){ return p.data_inicio && !p.quitado; });
  if (parcAtivosLT.length > 0) {
    // Calcula range de meses: do mais antigo ao mais recente término
    var hoje = new Date();
    var minDate = new Date(Math.min.apply(null, parcAtivosLT.map(function(p){ return new Date(p.data_inicio + 'T12:00:00'); })));
    var maxMeses = Math.max.apply(null, parcAtivosLT.map(function(p){ return p.parcelas_restantes; }));
    var maxDate = new Date(hoje.getFullYear(), hoje.getMonth() + maxMeses + 1, 1);

    // Gera lista de meses
    var meses = [];
    var cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur <= maxDate) {
      meses.push(new Date(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
    if (meses.length > 36) meses = meses.slice(0, 36); // máx 3 anos

    // Calcula total acumulado por mês
    var acumuladoMes = meses.map(function(m) {
      return parcAtivosLT.reduce(function(sum, p) {
        var inicio = new Date(p.data_inicio + 'T12:00:00');
        var inicioMes = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
        var fimMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + p.parcelas_total, 1);
        var mes = new Date(m.getFullYear(), m.getMonth(), 1);
        return (mes >= inicioMes && mes < fimMes) ? sum + p.valor_parcela : sum;
      }, 0);
    });



    var maxAcum = Math.max.apply(null, acumuladoMes) || 1;
    var totalCols = meses.length;
    var mesHoje = meses.findIndex(function(m){ return m.getFullYear()===hoje.getFullYear() && m.getMonth()===hoje.getMonth(); });

    html += '<div class="card" style="margin-bottom:12px">';
    html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:12px">📊 Linha do Tempo</div>';

    // Barras dos parcelamentos (Gantt)
    html += '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">';
    html += '<div style="min-width:' + Math.max(600, totalCols * 28) + 'px">';

    // Header meses
    html += '<div style="display:flex;margin-left:100px;margin-bottom:4px">';
    meses.forEach(function(m, i) {
      var isHoje = i === mesHoje;
      var showLabel = i === 0 || m.getMonth() === 0 || (totalCols <= 18) || (i % 3 === 0);
      html += '<div style="flex:0 0 ' + Math.floor(100/totalCols*totalCols) + 'px;width:' + (600/totalCols) + 'px;font-size:8px;color:' + (isHoje?'var(--violet-light)':'var(--text-dim)') + ';text-align:center;font-weight:' + (isHoje?'700':'400') + '">';
      if (showLabel) html += m.toLocaleDateString('pt-BR',{month:'short'}).replace('.','') + (m.getMonth()===0||i===0?'/'+String(m.getFullYear()).slice(2):'');
      if (isHoje) html += '▼';
      html += '</div>';
    });
    html += '</div>';

    // Linhas de cada parcelamento
    parcAtivosLT.forEach(function(p) {
      var inicio = new Date(p.data_inicio + 'T12:00:00');
      var inicioMes = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
      var startIdx = meses.findIndex(function(m){ return m.getFullYear()===inicioMes.getFullYear()&&m.getMonth()===inicioMes.getMonth(); });
      if (startIdx < 0) startIdx = 0;
      var endIdx = startIdx + p.parcelas_total - 1;
      if (endIdx >= meses.length) endIdx = meses.length - 1;
      var paidEnd = startIdx + p.parcelas_pagas - 1;

      var colors = ['#7C3AED','#10B981','#3B82F6','#F59E0B','#EF4444','#EC4899','#8B5CF6','#14B8A6'];
      var color = colors[p.id % colors.length];

      html += '<div style="display:flex;align-items:center;margin-bottom:5px">';
      html += '<div style="width:100px;flex-shrink:0;font-size:10px;color:var(--text);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8px">' + escHtml(p.nome) + '</div>';
      html += '<div style="position:relative;flex:1;height:18px">';

      // Barra total (cinza)
      var startPct = (startIdx / totalCols * 100).toFixed(1);
      var widthPct = ((endIdx - startIdx + 1) / totalCols * 100).toFixed(1);
      html += '<div style="position:absolute;left:' + startPct + '%;width:' + widthPct + '%;height:100%;background:' + color + '30;border-radius:3px;border:1px solid ' + color + '60"></div>';

      // Barra pago (colorida)
      if (p.parcelas_pagas > 0) {
        var paidW = (p.parcelas_pagas / totalCols * 100).toFixed(1);
        html += '<div style="position:absolute;left:' + startPct + '%;width:' + paidW + '%;height:100%;background:' + color + ';border-radius:3px;opacity:.8"></div>';
      }

      // Linha do hoje
      if (mesHoje >= 0) {
        var hojeLeft = (mesHoje / totalCols * 100).toFixed(1);
        html += '<div style="position:absolute;left:' + hojeLeft + '%;width:2px;height:100%;background:var(--violet-light);opacity:.6"></div>';
      }

      // Valor
      html += '<div style="position:absolute;right:0;top:0;bottom:0;display:flex;align-items:center;font-size:8px;color:var(--text-muted);padding-right:2px">' + fmtMoney(p.valor_parcela) + '</div>';
      html += '</div></div>';
    });

    // Gráfico de acumulado mensal
    html += '<div style="margin-top:10px;border-top:1px solid var(--border-soft);padding-top:8px">';
    html += '<div style="font-size:9px;color:var(--text-muted);margin-bottom:4px;margin-left:100px">Total mensal em parcelas</div>';
    html += '<div style="display:flex;align-items:flex-end;margin-left:100px;height:40px;gap:1px">';
    acumuladoMes.forEach(function(val, i) {
      var h = Math.round(val / maxAcum * 36);
      var isHoje = i === mesHoje;
      html += '<div style="flex:1;height:' + h + 'px;background:' + (isHoje?'var(--violet)':'rgba(124,58,237,.35)') + ';border-radius:2px 2px 0 0;min-width:2px" title="' + meses[i].toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}) + ': ' + fmtMoney(val) + '"></div>';
    });
    html += '</div>';

    // Legenda valor máximo
    html += '<div style="font-size:9px;color:var(--text-muted);margin-left:100px;margin-top:3px">Pico: ' + fmtMoney(maxAcum) + '/mês</div>';
    html += '</div>';

    html += '</div></div></div>';
  }

  // ── MISSÕES ──
  html += '<div class="card" style="margin-bottom:12px">';
  html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px">📋 Missões da semana</div>';
  missoes.forEach(function(m) {
    var pctM = m.total > 0 ? Math.min(100,Math.round(m.progresso/m.total*100)) : (m.done?100:0);
    html += '<div class="missao-item'+(m.done?' done':'') +'">';
    html += '<div class="mi-ico">'+m.ico+'</div>';
    html += '<div class="mi-body"><div class="mi-title">'+m.titulo+'</div><div class="mi-desc">'+m.desc+'</div>';
    html += '<div class="mi-prog"><div class="mi-bar"><div class="mi-fill" style="width:'+pctM+'%;background:'+(m.done?'var(--green)':'var(--violet)')+'"></div></div>';
    html += '<div class="mi-reward">'+(m.done?'✅ +'+m.xp+' XP':'+'+m.xp+' XP')+'</div></div>';
    html += '</div></div>';
  });
  if (!missoes.length) html += '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px">Cadastre parcelamentos para gerar missões</p>';
  html += '</div>';

  // ── CALENDÁRIO DO MÊS ATUAL ──
  var calNow = new Date();
  var calAno = calNow.getFullYear();
  var calMes = calNow.getMonth();
  var calNomeMes = calNow.toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
  var primeiroDia = new Date(calAno, calMes, 1).getDay(); // 0=Dom
  var diasNoMes = new Date(calAno, calMes+1, 0).getDate();

  html += '<div class="card" style="margin-bottom:12px">';
  html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:10px">📅 ' + calNomeMes.charAt(0).toUpperCase() + calNomeMes.slice(1) + '</div>';

  // Cabeçalho dias da semana
  html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:3px">';
  ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach(function(d){
    html += '<div style="font-size:9px;font-weight:700;color:var(--text-dim);text-align:center;padding:2px 0">' + d + '</div>';
  });
  html += '</div>';

  // Grid dos dias
  html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">';

  // Células vazias antes do primeiro dia
  for (var b = 0; b < primeiroDia; b++) {
    html += '<div></div>';
  }

  // Dias do mês
  for (var dia = 1; dia <= diasNoMes; dia++) {
    var keyDia = calAno + '-' + String(calMes+1).padStart(2,'0') + '-' + String(dia).padStart(2,'0');
    var isHojeDia = dia === calNow.getDate();
    var temParc = parcelamentos.some(function(p){ return p.data_inicio === keyDia; });
    var eStreak = lastParcDate ? (new Date(keyDia+'T00:00:00') > lastParcDate && new Date(keyDia+'T00:00:00') <= calNow) : false;

    var bg = 'var(--card)';
    var cor = 'var(--text-muted)';
    var borda = 'transparent';
    if (temParc)  { bg = 'var(--red)';    cor = '#fff'; }
    else if (eStreak) { bg = 'var(--violet)'; cor = '#fff'; }
    if (isHojeDia) borda = 'var(--violet-light)';

    html += '<div style="height:32px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:11px;font-weight:'+(isHojeDia?'800':'500')+';background:'+bg+';color:'+cor+';border:2px solid '+borda+';cursor:default" title="'+(temParc?'Gasto parcelado':eStreak?'Dia livre':'')+'">'+dia+'</div>';
  }
  html += '</div>';

  // Legenda + streak
  html += '<div style="display:flex;gap:12px;margin-top:10px;font-size:10px;color:var(--text-muted);justify-content:center;flex-wrap:wrap">';
  html += '<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--red);vertical-align:middle;margin-right:3px"></span>Gasto parcelado</span>';
  html += '<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--violet);vertical-align:middle;margin-right:3px"></span>Dia livre</span>';
  html += '<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;border:2px solid var(--violet-light);vertical-align:middle;margin-right:3px"></span>Hoje</span>';
  html += '</div>';

  var streakMsg = jogoStreak === 0 ? '<span style="color:var(--text-muted)">Cadastre a data do gasto para contar o streak</span>' : '🔥 <strong style="color:var(--amber)">'+jogoStreak+' dia'+(jogoStreak!==1?'s':'')+' </strong> desde o último gasto parcelado';
  html += '<div style="font-size:11px;text-align:center;margin-top:8px">' + streakMsg + '</div>';
  html += '</div>';

  // ── CONQUISTAS ──
  html += '<div class="card">';
  html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px">🏆 Conquistas</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">';
  conquistas.forEach(function(t) {
    html += '<div class="trophy-jogo'+(t.unlocked?' unlocked':' locked')+'">';
    html += '<div style="font-size:20px">'+t.ico+'</div>';
    html += '<div style="font-size:9px;font-weight:600;color:var(--text);line-height:1.2;margin-top:2px">'+t.nome+'</div>';
    if (!t.unlocked) html += '<div style="font-size:8px;color:var(--text-muted)">'+t.req+'</div>';
    html += '</div>';
  });
  html += '</div></div>';

  el.innerHTML = html;
}

function gerarMissoes() {
  var miss = [];
  var hoje = new Date();
  var semInicio = new Date(hoje); semInicio.setDate(hoje.getDate() - hoje.getDay());
  var ecosSemana = economias.filter(function(e){
    var d = new Date(e.data + 'T12:00:00');
    return d >= semInicio;
  });
  var totalEcoSemana = ecosSemana.reduce(function(s,e){ return s+e.valor; }, 0);

  // Missão: economizar R$300 na semana
  miss.push({ ico: '💰', titulo: 'Economizar R$ 300 esta semana', desc: 'Registre economias para atingir a meta',
    progresso: totalEcoSemana, total: 300, done: totalEcoSemana >= 300, xp: 100 });

  // Missão: não parcelar nada
  var addedThisWeek = parcelamentos.some(function(p){
    return p.createdAt && new Date(p.createdAt) >= semInicio;
  });
  miss.push({ ico: '📵', titulo: 'Não parcelar nada esta semana', desc: 'Mantenha o streak sem novas parcelas',
    progresso: addedThisWeek ? 0 : 1, total: 1, done: !addedThisWeek, xp: 80 });

  // Missão: pagar 1 parcela extra (se houver parcelamento quase quitado)
  var quase = parcelamentos.filter(function(p){ return !p.quitado && p.parcelas_restantes <= 3 && p.parcelas_restantes > 0; });
  if (quase.length) {
    miss.push({ ico: '⚡', titulo: 'Quite o ' + quase[0].nome + ' (faltam ' + quase[0].parcelas_restantes + '!)', desc: 'Esse inimigo está quase derrotado!',
      progresso: 0, total: 1, done: false, xp: 150 });
  }

  return miss;
}

function gerarConquistas() {
  var qtQuitados = parcelamentos.filter(function(p){ return p.quitado; }).length;
  var totalEco = economias.reduce(function(s,e){ return s+e.valor; }, 0);
  return [
    { ico:'🥇', nome:'1ª Parcela Extra', req:'', unlocked: parcelamentos.some(function(p){ return p.parcelas_pagas > 0; }) },
    { ico:'🔥', nome:'Streak 7 dias', req:'7 dias sem parcela', unlocked: jogoStreak >= 7 },
    { ico:'⚔️', nome:'Inimigo Derrotado', req:'1 quitação', unlocked: qtQuitados >= 1 },
    { ico:'💎', nome:'Streak 30 dias', req:'30 dias', unlocked: jogoStreak >= 30 },
    { ico:'💰', nome:'R$ 1k Economizado', req:'R$ 1.000', unlocked: totalEco >= 1000 },
    { ico:'🐉', nome:'Mata o Chefão', req:'Quite a maior dívida', unlocked: parcelamentos.length > 0 && parcelamentos.every(function(p){ return p.quitado || p.valor_parcela < 500; }) },
    { ico:'🏁', nome:'Linha de Chegada', req:'Quite tudo', unlocked: parcelamentos.length > 0 && parcelamentos.every(function(p){ return p.quitado; }) },
    { ico:'👑', nome:'Nível 10', req:'', unlocked: jogoLevel().level >= 10 },
  ];
}

function jogo_excluirParcela(id) {
  var p = parcelamentos.find(function(x){ return x.id === id; });
  if (!p) return;
  if (!confirm('Excluir "' + p.nome + '"?')) return;
  parcelamentos = parcelamentos.filter(function(x){ return x.id !== id; });
  jogoSave();
  showToast('Parcelamento removido');
  renderJogo();
}

function jogo_abrirNovaParcela() {
  var title = document.getElementById('parc-modal-title');
  var saveBtn = document.getElementById('parc-save-btn');
  if (title) title.textContent = '⚔️ Novo Parcelamento';
  if (saveBtn) { saveBtn.textContent = 'Adicionar'; saveBtn.onclick = jogo_salvarParcela; }
  document.getElementById('parc-nome').value = '';
  document.getElementById('parc-total').value = '';
  document.getElementById('parc-pagas').value = '0';
  document.getElementById('parc-valor').value = '';
  document.getElementById('parc-data-inicio').value = '';
  document.getElementById('parc-banco').value = '';
  var titulo = document.getElementById('parc-modal-title');
  var btn = document.getElementById('parc-save-btn');
  if (titulo) titulo.textContent = '⚔️ Novo Parcelamento';
  if (btn) { btn.textContent = 'Adicionar'; delete btn.dataset.editId; btn.onclick = jogo_salvarOuAtualizar; }
  openModal('modal-parc');
  setTimeout(function(){ document.getElementById('parc-nome').focus(); }, 200);
}

function jogo_salvarParcela() {
  var nome  = document.getElementById('parc-nome').value.trim();
  var total = parseInt(document.getElementById('parc-total').value) || 0;
  var pagas = parseInt(document.getElementById('parc-pagas').value) || 0;
  var valor = parseFloat(document.getElementById('parc-valor').value.replace(',','.')) || 0;
  var dataInicio = document.getElementById('parc-data-inicio').value || '';
  var banco = (document.getElementById('parc-banco').value || '').trim();
  if (!nome) { document.getElementById('parc-nome').focus(); showToast('⚠️ Informe o nome'); return; }
  if (!total || total < 1) { document.getElementById('parc-total').focus(); showToast('⚠️ Informe o total de parcelas'); return; }
  if (!valor || valor <= 0) { document.getElementById('parc-valor').focus(); showToast('⚠️ Informe o valor da parcela'); return; }
  if (pagas > total) { showToast('⚠️ Parcelas pagas não pode ser maior que o total'); return; }
  var p = {
    id: nextParcId++, nome: nome,
    parcelas_total: total, parcelas_pagas: pagas,
    parcelas_restantes: total - pagas,
    valor_parcela: valor,
    data_inicio: dataInicio,
    banco: banco,
    quitado: (total - pagas) <= 0,
    createdAt: new Date().toISOString()
  };
  parcelamentos.push(p);
  jogoSave();
  closeModal('modal-parc');
  jogoAddXP(30, 'Parcelamento cadastrado');
  renderJogo();
}

function jogo_editarParcela(id) {
  var p = parcelamentos.find(function(x){ return x.id === id; });
  if (!p) return;
  document.getElementById('parc-nome').value        = p.nome || '';
  document.getElementById('parc-total').value       = p.parcelas_total || '';
  document.getElementById('parc-pagas').value       = p.parcelas_pagas || 0;
  document.getElementById('parc-valor').value       = p.valor_parcela || '';
  document.getElementById('parc-data-inicio').value = p.data_inicio || '';
  document.getElementById('parc-banco').value       = p.banco || '';
  var titulo = document.getElementById('parc-modal-title');
  var btn    = document.getElementById('parc-save-btn');
  if (titulo) titulo.textContent = '✏️ Editar Parcelamento';
  if (btn)    { btn.textContent = 'Salvar'; btn.dataset.editId = id; btn.onclick = jogo_salvarOuAtualizar; }
  openModal('modal-parc');
}

function jogo_salvarOuAtualizar() {
  var btn = document.getElementById('parc-save-btn');
  var editId = btn && btn.dataset.editId ? parseInt(btn.dataset.editId) : null;
  if (editId) {
    jogo_atualizarParcela(editId);
  } else {
    jogo_salvarParcela();
  }
}

function jogo_atualizarParcela(id) {
  var p = parcelamentos.find(function(x){ return x.id === id; });
  if (!p) return;
  var nome      = document.getElementById('parc-nome').value.trim();
  var total     = parseInt(document.getElementById('parc-total').value)   || p.parcelas_total;
  var pagas     = parseInt(document.getElementById('parc-pagas').value)   || 0;
  var valor     = parseFloat(document.getElementById('parc-valor').value) || p.valor_parcela;
  var dataIni   = document.getElementById('parc-data-inicio').value       || '';
  var banco     = document.getElementById('parc-banco').value.trim()      || '';
  if (!nome) { showToast('⚠️ Informe o nome'); return; }
  p.nome               = nome;
  p.parcelas_total     = total;
  p.parcelas_pagas     = pagas;
  p.parcelas_restantes = total - pagas;
  p.valor_parcela      = valor;
  p.data_inicio        = dataIni;
  p.banco              = banco;
  p.quitado            = p.parcelas_restantes <= 0;
  jogoSave();
  closeModal('modal-parc');
  // Restaura modal para "novo"
  var titulo = document.getElementById('parc-modal-title');
  var btn    = document.getElementById('parc-save-btn');
  if (titulo) titulo.textContent = '⚔️ Novo Parcelamento';
  if (btn)    { btn.textContent = 'Adicionar'; btn.onclick = jogo_salvarParcela; }
  jogoUpdateStreak();
  renderJogo();
}

function jogo_pagarParcela(id) {
  var p = parcelamentos.find(function(x){ return x.id === id; });
  if (!p || p.quitado) return;
  p.parcelas_pagas++;
  p.parcelas_restantes--;
  if (p.parcelas_restantes <= 0) {
    p.quitado = true;
    jogoAddXP(200, '🎉 ' + p.nome + ' QUITADO!');
    showToast('🎉 Inimigo derrotado! ' + p.nome + ' está quitado!');
  } else {
    jogoAddXP(25, 'Parcela paga — ' + p.nome);
  }
  jogoSave();
  renderJogo();
}

function jogo_abrirEconomia() {
  document.getElementById('eco-desc').value = '';
  document.getElementById('eco-valor').value = '';
  openModal('modal-eco');
  setTimeout(function(){ document.getElementById('eco-desc').focus(); }, 200);
}

function jogo_salvarEconomia() {
  var desc  = document.getElementById('eco-desc').value.trim();
  var valor = parseFloat(document.getElementById('eco-valor').value.replace(',','.')) || 0;
  if (!desc) { document.getElementById('eco-desc').focus(); showToast('⚠️ Descreva a economia'); return; }
  if (!valor || valor <= 0) { document.getElementById('eco-valor').focus(); showToast('⚠️ Informe o valor'); return; }
  economias.push({ id: nextEcoId++, desc: desc, valor: valor, data: new Date().toISOString() });
  jogoSave();
  closeModal('modal-eco');
  jogoAddXP(15, 'Economia registrada!');
  renderJogo();
}

// ══ CURRÍCULO — SORT E INDICADORES ══
let curSort = 'status'; // status | q-desc | q-asc | acerto-desc | acerto-asc | nome-az | nome-za

function setCurSort(by, btn) {
  curSort = by;
  document.querySelectorAll('.cur-sort-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCurriculoTopicos();
}

// Retorna stats de questões para um texto de tópico
function curTopicoQStats(topicoNome, disciplinaNome, matId, topicoIdx) {
  var sessoes;
  if (matId != null && topicoIdx != null) {
    // Matching exato por ID — prioridade máxima
    sessoes = questaoSessoes.filter(function(s) {
      if (s.matId != null && s.topicoIdx != null) {
        // Match por matId+topicoIdx OU por matId+tema (índice pode ter deslocado)
        if (s.matId !== matId) return false;
        return s.topicoIdx === topicoIdx || (topicoNome && s.tema === topicoNome);
      }
      // Fallback para sessões antigas sem ID: match por texto exato
      return s.tema === topicoNome && (s.disciplina||'') === (disciplinaNome||'');
    });
  } else {
    // Sem ID: match por texto exato
    sessoes = questaoSessoes.filter(function(s) {
      return s.tema === topicoNome && (s.disciplina||'') === (disciplinaNome||'');
    });
  }
  if (!sessoes.length) return null;
  const total   = sessoes.reduce(function(s,q){ return s + (q.total||0); }, 0);
  const acertos = sessoes.reduce(function(s,q){ return s + (q.acertos||0); }, 0);
  const pct     = total > 0 ? Math.round(acertos / total * 100) : 0;
  return { total, acertos, pct };
}

// Stats de questões de uma matéria inteira
function curMatQStats(mat) {
  const sessoes = questaoSessoes.filter(function(s) {
    // Prioridade: matId exato
    if (s.matId != null) return s.matId === mat.id;
    // Fallback: nome exato da disciplina
    return (s.disciplina||'') === mat.nome;
  });
  if (!sessoes.length) return null;
  const total   = sessoes.reduce(function(s,q){ return s + (q.total||0); }, 0);
  const acertos = sessoes.reduce(function(s,q){ return s + (q.acertos||0); }, 0);
  const pct     = total > 0 ? Math.round(acertos / total * 100) : 0;
  // Por tema para tópico mais forte/fraco
  const porTema = {};
  sessoes.forEach(function(s) {
    const k = s.tema || '?';
    if (!porTema[k]) porTema[k] = {total:0, acertos:0};
    porTema[k].total   += s.total || 0;
    porTema[k].acertos += s.acertos || 0;
  });
  const temas = Object.entries(porTema)
    .filter(function(e){ return e[1].total >= 3; })
    .map(function(e){ return {tema: e[0], pct: Math.round(e[1].acertos/e[1].total*100), total: e[1].total}; });
  temas.sort(function(a,b){ return b.pct - a.pct; });
  return { total, acertos, pct, melhor: temas[0]||null, pior: temas[temas.length-1]||null };
}

// ══ ABA DESEMPENHO ══
let deseMatId  = null; // matéria selecionada na aba desempenho
let deseSort   = 'status';
let deseFilter = 'todos'; // todos | estudado | andamento | pendente

function buildDesempenhoHTML() {
  return '<div id="dese-root" style="display:flex;gap:0;height:100%;min-height:0"></div>';
}

function renderDesempenho() {
  var root = document.getElementById('dese-root');
  if (!root) return;

  // ── Calcula stats gerais ──
  var totalT = 0, totalE = 0;
  curriculo.forEach(function(m){
    totalT += m.topicos.length;
    totalE += m.topicos.filter(function(_,i){ return curGetStatus(m.id,i)==='estudado'; }).length;
  });
  var pctGeral = totalT ? Math.round(totalE/totalT*100) : 0;
  var totalQ   = questaoSessoes.reduce(function(s,q){ return s+(q.total||0); },0);
  var totalAc  = questaoSessoes.reduce(function(s,q){ return s+(q.acertos||0); },0);
  var acertoG  = totalQ ? Math.round(totalAc/totalQ*100) : 0;
  var acGC = acertoColor(acertoG);
  var porDisc = {};
  questaoSessoes.forEach(function(s){ var d=s.disciplina||'?'; porDisc[d]=(porDisc[d]||0)+(s.total||0); });
  var discArr = Object.entries(porDisc).sort(function(a,b){return b[1]-a[1];});

  // Seleciona primeira matéria se não tiver
  if (!deseMatId && curriculo.length) deseMatId = curriculo[0].id;
  var mat = curriculo.find(function(m){ return m.id === deseMatId; }) || curriculo[0];

  // ── HTML ──
  var html = '';

  // KPI cards gerais
  html += '<div style="width:100%">';
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">';
  html += kpiCard(pctGeral+'%','var(--violet-light)','Progresso geral', totalE+'/'+totalT+' tópicos estudados');
  html += kpiCard(totalQ.toLocaleString('pt-BR'),'var(--blue)','Questões feitas', questaoSessoes.length+' sessões registradas');
  html += kpiCard((totalQ?acertoG+'%':'—'), acGC,'Acerto geral', totalAc+'/'+totalQ+' acertos');
  html += kpiCard(discArr[0]?discArr[0][0]:'—','var(--amber)','Mais estudada', discArr[0]?discArr[0][1]+'q':'');
  html += '</div>';

  // ── Sessões órfãs (sem tópico válido no currículo atual) ──
  var orfas = questaoSessoes.filter(function(s) {
    if (s.matId != null && s.topicoIdx != null) {
      var mat2 = curriculo.find(function(m){ return m.id === s.matId; });
      if (!mat2) return true; // matéria não existe mais
      // Verifica pelo índice E pelo tema para robustez contra deslocamento de índices
      var topicoPorIdx  = mat2.topicos[s.topicoIdx];
      var topicoPorTema = s.tema ? mat2.topicos.indexOf(s.tema) !== -1 : false;
      // Só é órfã se nem o índice nem o tema existirem
      return !topicoPorIdx && !topicoPorTema;
    }
    // Sem ID: verifica se disciplina+tema ainda existe no currículo
    var matMatch = curriculo.find(function(m){ return m.nome === s.disciplina; });
    if (!matMatch) return true;
    return matMatch.topicos.indexOf(s.tema) === -1;
  });

  if (orfas.length > 0) {
    html += '<div style="background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:14px 16px;margin-bottom:14px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
    html += '<span style="font-size:11px;font-weight:700;color:var(--red)">⚠️ '+orfas.length+' lançamento(s) sem vínculo com tópico</span>';
    html += '<button onclick="limparSessoesOrfas()" style="font-size:10px;padding:3px 10px;border-radius:8px;border:1px solid rgba(239,68,68,.4);background:transparent;color:var(--red);cursor:pointer">Excluir todos</button>';
    html += '</div>';

    // Tabela
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
    html += '<thead><tr style="color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.05em">';
    html += '<th style="text-align:left;padding:4px 8px;font-weight:700;border-bottom:1px solid var(--border-soft)">Disciplina</th>';
    html += '<th style="text-align:left;padding:4px 8px;font-weight:700;border-bottom:1px solid var(--border-soft)">Tema registrado</th>';
    html += '<th style="text-align:center;padding:4px 8px;font-weight:700;border-bottom:1px solid var(--border-soft)">Qtd</th>';
    html += '<th style="text-align:center;padding:4px 8px;font-weight:700;border-bottom:1px solid var(--border-soft)">Acerto</th>';
    html += '<th style="text-align:center;padding:4px 8px;font-weight:700;border-bottom:1px solid var(--border-soft)">Data</th>';
    html += '<th style="text-align:center;padding:4px 8px;font-weight:700;border-bottom:1px solid var(--border-soft)">Ações</th>';
    html += '</tr></thead><tbody>';

    orfas.forEach(function(s) {
      var qsIdx = questaoSessoes.indexOf(s);
      var acC = acertoColor(s.acerto||0);
      html += '<tr style="border-bottom:1px solid var(--border-soft)">';
      html += '<td style="padding:7px 8px;color:var(--text);font-weight:600">'+escHtml(s.disciplina||'?')+'</td>';
      html += '<td style="padding:7px 8px;color:var(--text-muted)">'+escHtml(s.tema||'—')+'</td>';
      html += '<td style="padding:7px 8px;text-align:center;color:var(--violet-light);font-weight:700">'+s.total+'q</td>';
      html += '<td style="padding:7px 8px;text-align:center;font-weight:800;color:'+acC+'">'+s.acerto+'%</td>';
      html += '<td style="padding:7px 8px;text-align:center;color:var(--dim);font-family:monospace;font-size:10px">'+(s.data||'—')+'</td>';
      html += '<td style="padding:7px 8px;text-align:center">';
      html += '<div style="display:flex;gap:4px;justify-content:center">';
      html += '<button onclick="abrirVincularOrfa('+qsIdx+')" '+
              'style="font-size:10px;padding:3px 10px;border-radius:6px;border:1px solid rgba(124,58,237,.4);background:var(--violet-glow);color:var(--violet-light);cursor:pointer;font-weight:600;white-space:nowrap">🔗 Vincular</button>';
      html += '<button onclick="deleteQuestaoSessao('+qsIdx+')" '+
              'style="font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid rgba(239,68,68,.3);background:transparent;color:var(--red);cursor:pointer">✕</button>';
      html += '</div></td></tr>';
    });

    html += '</tbody></table></div>';
  }

  // Layout: sidebar matérias + conteúdo
  html += '<div style="display:grid;grid-template-columns:220px 1fr;gap:12px;align-items:start">';

  // Sidebar matérias
  html += '<div style="background:var(--surface);border:1px solid var(--border-soft);border-radius:var(--radius);overflow:hidden">';
  html += '<div style="padding:10px 12px;border-bottom:1px solid var(--border-soft);display:flex;align-items:center;justify-content:space-between">';
  html += '<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Matérias</span>';
  html += '<button onclick="openAddMateriaDese()" style="font-size:10px;padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text-muted);cursor:pointer">+ Matéria</button>';
  html += '</div>';
  html += '<div style="max-height:70vh;overflow-y:auto">';
  curriculo.forEach(function(m) {
    var s = curMatStats(m);
    var isA = m.id === (mat ? mat.id : null);
    var pc = s.pct>=70?'var(--green)':s.pct>=30?'var(--amber)':'var(--text-dim)';
    html += '<div onclick="deseMatId='+m.id+';renderDesempenho()" style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border-soft);'+
      'background:'+(isA?'var(--violet-glow)':'transparent')+';border-left:3px solid '+(isA?'var(--violet)':'transparent')+'">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
        '<span style="flex:1;font-size:11px;font-weight:'+(isA?'700':'400')+';color:'+(isA?'var(--text)':'var(--text-muted)')+
          ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escHtml(m.nome)+'</span>' +
        '<span style="font-size:10px;font-weight:700;color:'+pc+'">'+s.pct+'%</span>' +
      '</div>' +
      '<div style="height:3px;background:var(--border-soft);border-radius:2px;overflow:hidden">' +
        '<div style="height:100%;width:'+s.pct+'%;background:'+pc+';border-radius:2px"></div>' +
      '</div>' +
      '<div style="font-size:9px;color:var(--text-dim);margin-top:3px">'+s.estudado+'/'+s.total+' tópicos</div>' +
    '</div>';
  });
  html += '</div></div>';

  // Conteúdo principal
  html += '<div>';

  if (mat) {
    // Card desempenho da matéria
    var mqs = curMatQStats(mat);
    var ms  = curMatStats(mat);

    html += '<div style="background:var(--surface);border:1px solid var(--border-soft);border-radius:var(--radius);padding:16px;margin-bottom:12px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
    html += '<div><div style="font-size:15px;font-weight:700;color:var(--text)">'+escHtml(mat.nome)+'</div>' +
            '<div style="font-size:10px;color:var(--text-muted);margin-top:2px">'+mat.topicos.length+' tópicos no currículo</div></div>';
    html += '</div>';

    // KPIs da matéria
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">';
    html += kpiCard(ms.pct+'%','var(--violet-light)','Progresso', ms.estudado+'/'+ms.total+' estudados', true);
    if (mqs) {
      var mqc = acertoColor(mqs.pct);
      html += kpiCard(mqs.total+'','var(--blue)','Questões feitas', mqs.acertos+' acertos', true);
      html += kpiCard(mqs.pct+'%', mqc,'Taxa de acerto','',true);
    } else {
      html += kpiCard('—','var(--text-dim)','Questões feitas','sem registros', true);
      html += kpiCard('—','var(--text-dim)','Taxa de acerto','sem registros', true);
    }
    html += '</div>';

    // Barra de acerto
    if (mqs) {
      var mqc2 = acertoColor(mqs.pct);
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
        '<span style="font-size:9px;color:var(--text-muted);width:50px">Acerto</span>' +
        '<div style="flex:1;height:8px;background:var(--card);border-radius:4px;overflow:hidden">' +
          '<div style="width:'+mqs.pct+'%;height:100%;background:'+mqc2+';border-radius:4px"></div>' +
        '</div>' +
        '<span style="font-size:12px;font-weight:800;color:'+mqc2+'">'+mqs.pct+'%</span>' +
      '</div>';
      // Forte/fraco
      if (mqs.melhor && mqs.pior && mqs.melhor.tema !== mqs.pior.tema) {
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
        html += '<div style="background:var(--card);border-radius:8px;padding:10px 12px;border-left:3px solid var(--green)">' +
          '<div style="font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">💪 Mais forte</div>' +
          '<div style="font-size:11px;font-weight:600;color:var(--text);line-height:1.3">'+escHtml(mqs.melhor.tema)+'</div>' +
          '<div style="font-size:10px;color:var(--green);font-weight:700;margin-top:4px">'+mqs.melhor.pct+'% · '+mqs.melhor.total+'q</div>' +
        '</div>';
        html += '<div style="background:var(--card);border-radius:8px;padding:10px 12px;border-left:3px solid var(--red)">' +
          '<div style="font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">⚠️ Reforçar</div>' +
          '<div style="font-size:11px;font-weight:600;color:var(--text);line-height:1.3">'+escHtml(mqs.pior.tema)+'</div>' +
          '<div style="font-size:10px;color:var(--red);font-weight:700;margin-top:4px">'+mqs.pior.pct+'% · '+mqs.pior.total+'q</div>' +
        '</div>';
        html += '</div>';
      }
    }
    html += '</div>'; // card desempenho

    // ── LISTA DE TÓPICOS ──
    html += '<div style="background:var(--surface);border:1px solid var(--border-soft);border-radius:var(--radius);overflow:hidden">';

    // Header matéria
    var ms2 = curMatStats(mat);
    html += '<div style="padding:14px 16px;border-bottom:1px solid var(--border-soft)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<span style="font-size:14px;font-weight:700;color:var(--text)">'+escHtml(mat.nome)+'</span>';
    html += '<span style="font-size:11px;color:var(--text-muted)">'+mat.topicos.length+' tópicos</span>';
    html += '</div>';
    html += '<div style="display:flex;gap:6px">';
    html += '<button onclick="openAddTopicoModal()" style="font-size:11px;padding:5px 11px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text-muted);cursor:pointer">+ Tópico</button>';
    html += '<button onclick="openEditMateriaModalDese()" style="width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text-muted);cursor:pointer;font-size:13px">✏️</button>';

    html += '</div></div>';
    // Barra progresso
    var pcBr = ms2.pct>=70?'var(--green)':ms2.pct>=30?'var(--amber)':'var(--violet)';
    html += '<div style="height:4px;background:var(--card);border-radius:2px;overflow:hidden;margin-bottom:8px">';
    html += '<div style="width:'+ms2.pct+'%;height:100%;background:'+pcBr+';border-radius:2px"></div></div>';
    // Status chips
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    html += '<span onclick="deseSetFilter(&quot;estudado&quot;)" style="font-size:10px;padding:3px 10px;border-radius:20px;cursor:pointer;background:rgba(16,185,129,.15);color:var(--green);border:1px solid rgba(16,185,129,.3)">✓ '+ms2.estudado+' estudados</span>';
    html += '<span onclick="deseSetFilter(&quot;andamento&quot;)" style="font-size:10px;padding:3px 10px;border-radius:20px;cursor:pointer;background:rgba(245,158,11,.1);color:var(--amber);border:1px solid rgba(245,158,11,.2)">⟳ '+ms2.andamento+' andamento</span>';
    html += '<span onclick="deseSetFilter(&quot;pendente&quot;)" style="font-size:10px;padding:3px 10px;border-radius:20px;cursor:pointer;background:var(--card);color:var(--text-muted);border:1px solid var(--border-soft)">○ '+ms2.pendente+' pendentes</span>';
    html += '</div></div>';

    // Filtros + busca + ordenação
    html += '<div style="padding:10px 16px;border-bottom:1px solid var(--border-soft);display:flex;gap:6px;flex-wrap:wrap;align-items:center">';
    var filters = [['todos','Todos'],['estudado','✓ Estudados'],['andamento','⟳ Andamento'],['pendente','○ Pendentes']];
    filters.forEach(function(fv){
      var isAct = fv[0]===deseFilter;
      html += '<button onclick="deseSetFilter(&quot;'+fv[0]+'&quot;);" style="font-size:10px;padding:3px 10px;border-radius:20px;cursor:pointer;'+
              'border:1px solid '+(isAct?'var(--violet)':'var(--border-soft)')+';'+
              'background:'+(isAct?'var(--violet-glow)':'transparent')+';'+
              'color:'+(isAct?'var(--violet-light)':'var(--text-muted)')+';'+
              'font-weight:'+(isAct?'700':'400')+'">'+fv[1]+'</button>';
    });
    html += '<input id="dese-search" type="text" placeholder="🔍 Buscar tópico..." oninput="renderDesempenhoTopicos()" '+
            'style="flex:1;min-width:140px;padding:5px 10px;background:var(--card);border:1px solid var(--border-soft);border-radius:8px;color:var(--text);font-size:11px;outline:none">';
    html += '</div>';

    // Ordenação
    html += '<div style="padding:8px 16px;border-bottom:1px solid var(--border-soft);display:flex;align-items:center;gap:5px;flex-wrap:wrap">';
    html += '<span style="font-size:10px;color:var(--text-dim);font-weight:600">Ordenar:</span>';
    var sorts = [['status','Status'],['q-desc','+questões'],['q-asc','−questões'],['pct-desc','+acerto'],['pct-asc','−acerto'],['az','A–Z'],['za','Z–A']];
    sorts.forEach(function(sv){
      var isAct = sv[0]===deseSort;
      html += '<button onclick="deseSortSet(\''+sv[0]+'\');" style="font-size:10px;padding:3px 10px;border-radius:20px;cursor:pointer;'+
              'border:1px solid '+(isAct?'var(--violet)':'var(--border)')+';'+
              'background:'+(isAct?'var(--violet-glow)':'transparent')+';'+
              'color:'+(isAct?'var(--violet-light)':'var(--text-muted)')+';'+
              'font-weight:'+(isAct?'700':'400')+'">'+sv[1]+'</button>';
    });
    html += '</div>';

    html += '<div id="dese-topicos" style="padding:0 16px"></div>';
    html += '</div>';
  }

  html += '</div></div></div>'; // col principal, grid, root

  root.innerHTML = html;
  renderDesempenhoTopicos();
}

function kpiCard(val, color, label, sub, small) {
  var fs = small ? '16px' : '20px';
  return '<div style="background:var(--card);border:1px solid var(--border-soft);border-radius:10px;padding:'+(small?'10px 12px':'12px 14px')+'">' +
    '<div style="font-size:'+fs+';font-weight:800;color:'+color+';line-height:1">'+val+'</div>' +
    '<div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:3px">'+label+'</div>' +
    (sub ? '<div style="font-size:10px;color:var(--text-dim);margin-top:2px">'+sub+'</div>' : '') +
  '</div>';
}

function renderDesempenhoTopicos() {
  var el = document.getElementById('dese-topicos');
  if (!el) return;
  var mat = curriculo.find(function(m){ return m.id === deseMatId; });
  if (!mat) { el.innerHTML = ''; return; }

  var q = ((document.getElementById('dese-search') || {}).value || '').toLowerCase();
  var statusOrder = {estudado:0, andamento:1, pendente:2};

  // Prepara dados
  var topicos = mat.topicos.map(function(t, i) {
    var status = curGetStatus(mat.id, i);
    var d = curTopicosData[mat.id+'_'+i];
    var acerto = d ? (d.acerto != null ? parseInt(d.acerto) : null) : null;
    var qs = curTopicoQStats(t, mat.nome, mat.id, i);
    // Prefere questaoSessoes (média ponderada acumulada) sobre acerto do último registro
    var pct = (qs && qs.total > 0) ? qs.pct : (acerto != null ? acerto : null);
    var qTotal = qs ? qs.total : 0;
    return { t, i, status, acerto, qs, pct, qTotal, d };
  }).filter(function(x){
    if (deseFilter !== 'todos' && x.status !== deseFilter) return false;
    return !q || x.t.toLowerCase().includes(q);
  });

  var maxQ = Math.max.apply(null, topicos.map(function(x){ return x.qTotal; }).concat([1]));

  // Ordena
  if (deseSort==='status')   topicos.sort(function(a,b){ return statusOrder[a.status]-statusOrder[b.status]; });
  if (deseSort==='q-desc')   topicos.sort(function(a,b){ return b.qTotal-a.qTotal; });
  if (deseSort==='q-asc')    topicos.sort(function(a,b){ return a.qTotal-b.qTotal; });
  if (deseSort==='pct-desc') topicos.sort(function(a,b){ return (b.pct||0)-(a.pct||0); });
  if (deseSort==='pct-asc')  topicos.sort(function(a,b){ return (a.pct||0)-(b.pct||0); });
  if (deseSort==='az')       topicos.sort(function(a,b){ return a.t.localeCompare(b.t); });
  if (deseSort==='za')       topicos.sort(function(a,b){ return b.t.localeCompare(a.t); });

  if (!topicos.length) { el.innerHTML = '<p style="font-size:12px;color:var(--text-dim);padding:12px;text-align:center">Nenhum tópico encontrado.</p>'; return; }

  var BAR_W = 100;
  el.innerHTML = topicos.map(function(x) {
    var statusIcon = x.status==='estudado'?'✓':x.status==='andamento'?'⟳':'○';
    var statusColor = x.status==='estudado'?'var(--green)':x.status==='andamento'?'var(--amber)':'var(--border)';
    var pctColor = acertoColor(x.pct);
    var qBarW = Math.round(x.qTotal/maxQ*100);
    var badge = x.pct != null ?
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;min-width:'+BAR_W+'px">' +
        '<div style="display:flex;align-items:baseline;gap:5px">' +
          '<span style="font-size:15px;font-weight:800;color:'+pctColor+';line-height:1">'+x.pct+'%</span>' +
          (x.qTotal>0?'<span style="font-size:10px;font-weight:700;color:var(--violet-light)">'+x.qTotal+'q</span>':'') +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:4px;width:'+BAR_W+'px">' +
          '<span style="font-size:8px;color:var(--text-dim);width:10px">%</span>' +
          '<div style="flex:1;height:5px;background:var(--border-soft);border-radius:3px;overflow:hidden">' +
            '<div style="width:'+x.pct+'%;height:100%;background:'+pctColor+';border-radius:3px"></div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:4px;width:'+BAR_W+'px">' +
          '<span style="font-size:8px;color:var(--text-dim);width:10px">q</span>' +
          '<div style="flex:1;height:5px;background:var(--border-soft);border-radius:3px;overflow:hidden">' +
            (x.qTotal>0?'<div style="width:'+qBarW+'%;height:100%;background:var(--violet-light);opacity:.7;border-radius:3px"></div>':'') +
          '</div>' +
          (x.qTotal>0?'<span style="font-size:9px;color:var(--text-dim)">'+x.qTotal+'q</span>':'') +
        '</div>' +
      '</div>'
      : '<div style="min-width:60px;flex-shrink:0;text-align:right"><span style="font-size:9px;padding:2px 8px;border-radius:10px;background:var(--border-soft);color:var(--text-dim)">sem dados</span></div>';

    var btns =
      '<div style="display:flex;gap:4px;flex-shrink:0;margin-left:6px">' +
        '<button onclick="event.stopPropagation();openRegistrarEstudo('+mat.id+','+x.i+')" title="Registrar Estudo" '+
          'style="font-size:9px;padding:3px 8px;border-radius:6px;border:1px solid rgba(124,58,237,.4);background:var(--violet-glow);color:var(--violet-light);cursor:pointer;font-weight:600;white-space:nowrap">📖</button>' +
        '<button onclick="event.stopPropagation();openEditTopicoModal('+mat.id+','+x.i+')" title="Editar" '+
          'style="width:26px;height:26px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text-muted);cursor:pointer;font-size:11px">✏️</button>' +
        '<button onclick="event.stopPropagation();deleteTopicoConfirm('+mat.id+','+x.i+')" title="Excluir" '+
          'style="width:26px;height:26px;border-radius:6px;border:1px solid rgba(239,68,68,.3);background:transparent;color:var(--red);cursor:pointer;font-size:11px">✕</button>' +
      '</div>';

    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border-soft)">' +
      '<div style="width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;'+
        'font-size:11px;font-weight:700;background:'+statusColor+'22;color:'+statusColor+';border:1px solid '+statusColor+'44;flex-shrink:0">'+statusIcon+'</div>' +
      '<div style="flex:1;min-width:0;font-size:12px;color:var(--text);line-height:1.3">'+escHtml(x.t)+'</div>' +
      badge +
      btns +
    '</div>' +
    // Histórico de sessões deste tópico (questaoSessoes por matId+topicoIdx)
    (function(){
      var sessions = questaoSessoes.filter(function(s){
        return s.matId === mat.id && s.topicoIdx === x.i;
      }).sort(function(a,b){ return (b.data||'').localeCompare(a.data||''); });
      if (!sessions.length) return '';
      return '<div style="padding:4px 0 0 30px">' +
        sessions.map(function(s){
          var sc = acertoColor(s.acerto);
          var qsIdx = questaoSessoes.indexOf(s);
          return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:10px;color:var(--text-dim);border-bottom:1px solid var(--border-soft)">' +
            '<span style="font-family:monospace;flex-shrink:0;min-width:72px">'+( s.data||'—')+'</span>' +
            '<span style="flex-shrink:0;font-weight:600;color:var(--text)">'+s.total+'q</span>' +
            '<span style="font-weight:800;color:'+sc+';min-width:32px">'+s.acerto+'%</span>' +
            '<div style="flex:1;height:4px;background:var(--border-soft);border-radius:2px;overflow:hidden">' +
              '<div style="width:'+s.acerto+'%;height:100%;background:'+sc+';border-radius:2px"></div>' +
            '</div>' +
            '<button onclick="event.stopPropagation();editQuestaoSessao('+qsIdx+')" title="Editar" '+
              'style="background:none;border:none;cursor:pointer;color:var(--text-dim);font-size:11px;padding:1px 4px;flex-shrink:0">✏️</button>' +
            '<button onclick="event.stopPropagation();deleteQuestaoSessao('+qsIdx+')" title="Excluir" '+
              'style="background:none;border:none;cursor:pointer;color:var(--red);font-size:11px;padding:1px 4px;flex-shrink:0">✕</button>' +
          '</div>';
        }).join('') +
      '</div>';
    })();
  }).join('') + '<div style="height:8px"></div>';
}

function deseSortSet(by) {
  deseSort = by;
  renderDesempenho();
}

function deleteTopicoConfirm(mid, idx) {
  if (confirm('Excluir tópico?')) {
    deleteTopico(mid, idx);
    lsSave();
    if (cloudTimer) clearTimeout(cloudTimer);
    fbCloudSave();
    setTimeout(renderDesempenho, 100);
  }
}

function renderEstudosCur() {
  if (estudosActiveTab === 'desempenho') {
    renderDesempenho();
  } else {
    renderEstudosCur();
  }
}

function deseSetFilter(f) {
  deseFilter = f;
  renderDesempenhoTopicos();
}

function deseTodosEstudado() {
  var mat = curriculo.find(function(m){ return m.id === deseMatId; });
  if (!mat || !confirm('Marcar todos os tópicos de ' + mat.nome + ' como Estudado?')) return;
  mat.topicos.forEach(function(_, i){ curSetStatus(mat.id, i, 'estudado'); });
  renderDesempenho();
}

function openEditMateriaModalDese() {
  var mat = curriculo.find(function(m){ return m.id === deseMatId; });
  if (!mat) return;
  document.getElementById('edit-mat-nome').value = mat.nome;
  openModal('modal-editar-materia');
  setTimeout(function(){ document.getElementById('edit-mat-nome').focus(); }, 200);
}

function saveEditMateriaDese() {
  var nome = document.getElementById('edit-mat-nome').value.trim();
  if (!nome) { showToast('⚠️ Informe o nome'); return; }
  var mat = curriculo.find(function(m){ return m.id === deseMatId; });
  if (!mat) return;
  mat.nome = nome;
  lsSave();
  if (cloudTimer) clearTimeout(cloudTimer);
  fbCloudSave();
  closeModal('modal-editar-materia');
  renderDesempenho();
  showToast('✅ Matéria atualizada');
}

function openAddTopicoModal() {
  // Usa deseMatId (aba Desempenho) ou curSelectedMatId (aba Currículo)
  var mid = (estudosActiveTab === 'desempenho') ? deseMatId : curSelectedMatId;
  if (!mid) { showToast('⚠️ Selecione uma matéria primeiro'); return; }
  curSelectedMatId = mid; // garante que saveTopico use o id correto
  curEditTopicoIdx = null;
  var titleEl = document.getElementById('modal-topico-title');
  if (titleEl) titleEl.textContent = 'Novo Tópico';
  var nomeEl = document.getElementById('top-nome');
  if (nomeEl) nomeEl.value = '';
  var statusEl = document.getElementById('top-status');
  if (statusEl) statusEl.value = 'pendente';
  openModal('modal-topico');
  setTimeout(function(){ if (nomeEl) nomeEl.focus(); }, 200);
}

function openEditTopicoModal(mid, idx) {
  curSelectedMatId = mid;
  curEditTopicoIdx = idx;
  var mat = curriculo.find(function(m){ return m.id === mid; });
  if (!mat) return;
  var titleEl = document.getElementById('modal-topico-title');
  if (titleEl) titleEl.textContent = 'Editar Tópico';
  var nomeEl = document.getElementById('top-nome');
  if (nomeEl) nomeEl.value = mat.topicos[idx] || '';
  var statusEl = document.getElementById('top-status');
  if (statusEl) statusEl.value = curGetStatus(mid, idx);
  openModal('modal-topico');
  setTimeout(function(){ if (nomeEl) nomeEl.focus(); }, 200);
}

function editQuestaoSessao(idx) {
  var s = questaoSessoes[idx];
  if (!s) return;
  document.getElementById('edit-qs-idx').value = idx;
  document.getElementById('edit-qs-data').value = s.data || '';
  document.getElementById('edit-qs-total').value = s.total || '';
  document.getElementById('edit-qs-certas').value = s.acertos || '';
  document.getElementById('edit-qs-acerto').value = s.acerto || '';
  openModal('modal-edit-qs');
}

function calcEditQs() {
  var total  = parseInt(document.getElementById('edit-qs-total').value)  || 0;
  var certas = parseInt(document.getElementById('edit-qs-certas').value) || 0;
  document.getElementById('edit-qs-acerto').value = total > 0 ? Math.round(certas/total*100) : 0;
}

function saveEditQuestaoSessao() {
  var idx    = parseInt(document.getElementById('edit-qs-idx').value);
  var s      = questaoSessoes[idx];
  if (!s) return;
  var total  = parseInt(document.getElementById('edit-qs-total').value)  || 0;
  var certas = parseInt(document.getElementById('edit-qs-certas').value) || 0;
  var data   = document.getElementById('edit-qs-data').value;
  if (!total || !data) { showToast('⚠️ Preencha os campos'); return; }
  s.total   = total;
  s.acertos = certas;
  s.acerto  = total > 0 ? Math.round(certas/total*100) : 0;
  s.data    = data;
  lsSave();
  scheduleSave();
  closeModal('modal-edit-qs');
  renderDesempenho();
  showToast('✅ Sessão atualizada');
}

function deleteQuestaoSessao(idx) {
  if (!confirm('Excluir este lançamento de questões?')) return;
  var s = questaoSessoes[idx];
  var matId = s ? s.matId : null;
  var topicoIdx = s ? s.topicoIdx : null;
  questaoSessoes.splice(idx, 1);
  // Se não há mais sessões para este tópico, remove status e dados
  if (matId != null && topicoIdx != null) {
    var restantes = questaoSessoes.filter(function(q){
      return q.matId === matId && q.topicoIdx === topicoIdx;
    });
    if (!restantes.length) {
      var key = matId + '_' + topicoIdx;
      delete curTopicosData[key];
      curTopicosStatus[key] = 'pendente';
    }
  }
  lsSave();
  scheduleSave();
  renderDesempenho();
  showToast('🗑️ Lançamento excluído');
}

// ══ ABA CONSISTÊNCIA ══
let consistMonth = new Date().getMonth();
let consistYear  = new Date().getFullYear();
let consistSelDay = null;

function renderConsistencia() {
  var root = document.getElementById('consist-root');
  if (!root) return;

  // ── Agrupa questaoSessoes por data ──
  var byDay = {};
  questaoSessoes.forEach(function(s) {
    if (!s.data) return;
    var key = s.data.substring(0, 10);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(s);
  });

  // ── KPIs ──
  var today = new Date();
  var todayKey = dateToLocal(today);

  // Streak: dias consecutivos até hoje
  var streak = 0;
  var d = new Date(today);
  while (true) {
    var k = dateToLocal(d);
    if (byDay[k] && byDay[k].length) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // Dias no mês atual com estudo
  var mesAtual = today.getMonth();
  var anoAtual = today.getFullYear();
  var diasMes  = Object.keys(byDay).filter(function(k){
    var dd = new Date(k+'T00:00:00');
    return dd.getMonth() === consistMonth && dd.getFullYear() === consistYear;
  }).length;

  // Acerto médio global
  var tqAll = questaoSessoes.reduce(function(s,q){ return s+(q.total||0); }, 0);
  var acAll = questaoSessoes.reduce(function(s,q){ return s+(q.acertos||0); }, 0);
  var acMed = tqAll ? Math.round(acAll/tqAll*100) : 0;
  var acMedC = acertoColor(acMed);

  // Questões no mês exibido
  var qMes = Object.keys(byDay).filter(function(k){
    var dd = new Date(k+'T00:00:00');
    return dd.getMonth() === consistMonth && dd.getFullYear() === consistYear;
  }).reduce(function(s,k){ return s + byDay[k].reduce(function(a,q){ return a+(q.total||0); },0); }, 0);

  // ── Calendário ──
  var mes = new Date(consistYear, consistMonth, 1);
  var mesNome = mes.toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
  mesNome = mesNome.charAt(0).toUpperCase() + mesNome.slice(1);
  var primeiroDia = mes.getDay();
  var diasNoMes   = new Date(consistYear, consistMonth+1, 0).getDate();

  function getLevel(sessions) {
    if (!sessions || !sessions.length) return 0;
    var q = sessions.reduce(function(s,x){ return s+(x.total||0); }, 0);
    if (q >= 40) return 4;
    if (q >= 25) return 3;
    if (q >= 10) return 2;
    return 1;
  }

  var html = '';

  // KPI row
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">';
  html += consistKpi('🔥 '+streak, 'var(--amber)', 'Dias seguidos', '');
  html += consistKpi(diasMes+'', 'var(--violet-light)', 'Dias estudados', mesNome.split(' ')[0]);
  html += consistKpi(acMed+'%', acMedC, 'Acerto médio', tqAll+' questões total');
  html += consistKpi(qMes+'', 'var(--blue)', 'Questões no mês', mesNome.split(' ')[0]);
  html += '</div>';

  // Layout calendário + painel
  html += '<div style="display:grid;grid-template-columns:1fr 300px;gap:14px;align-items:start">';

  // Card calendário
  html += '<div style="background:var(--surface);border:1px solid var(--border-soft);border-radius:var(--radius);padding:16px">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">';
  html += '<button onclick="consistChangeMonth(-1)" style="background:var(--card);border:1px solid var(--border-soft);border-radius:8px;padding:5px 12px;color:var(--muted);cursor:pointer;font-size:13px">‹</button>';
  html += '<span style="font-size:14px;font-weight:700;color:var(--text)">'+mesNome+'</span>';
  html += '<button onclick="consistChangeMonth(1)" style="background:var(--card);border:1px solid var(--border-soft);border-radius:8px;padding:5px 12px;color:var(--muted);cursor:pointer;font-size:13px">›</button>';
  html += '</div>';

  // Grid semanas
  html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">';
  ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach(function(w){
    html += '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:var(--dim);text-align:center;padding:3px 0">'+w+'</div>';
  });

  for (var b = 0; b < primeiroDia; b++) html += '<div></div>';

  for (var dia = 1; dia <= diasNoMes; dia++) {
    var key = consistYear+'-'+String(consistMonth+1).padStart(2,'0')+'-'+String(dia).padStart(2,'0');
    var sessions = byDay[key];
    var lv = getLevel(sessions);
    var isToday = key === todayKey;
    var isSel   = key === consistSelDay;
    var hasDot  = sessions && sessions.length > 0;

    var bg = ['var(--card)','rgba(124,58,237,.2)','rgba(124,58,237,.4)','rgba(124,58,237,.65)','var(--violet)'][lv];
    var fg = lv >= 2 ? '#fff' : (lv === 1 ? 'var(--violet-light)' : 'var(--dim)');
    var border = isSel ? 'var(--violet)' : (isToday ? 'var(--violet-light)' : 'transparent');
    // Verifica se alguma sessão teve acerto < 75% (precisa revisar)
    var needsReview = hasDot && sessions.some(function(s){ return (s.acerto||0) < 75; });

    html += '<div onclick="consistSelDay=&quot;'+key+'&quot;;renderConsistencia()" '+
            'style="aspect-ratio:1;border-radius:7px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;'+
            'background:'+bg+';color:'+fg+';border:2px solid '+border+';font-size:11px;font-weight:700;'+
            'position:relative;transition:background-color .15s,color .15s,border-color .15s,opacity .15s,transform .15s" '+
            'title="'+key+(hasDot?' · '+sessions.reduce(function(s,q){return s+(q.total||0);},0)+'q':'')+(needsReview?' · ⚠ revisar':'')+'">' +
            dia +
            (needsReview ? '<span style="position:absolute;top:1px;right:2px;font-size:28px;color:var(--red);font-weight:900;line-height:1;opacity:.85">●</span>' : '') +
      '</div>';
  }
  html += '</div>';

  // Legenda
  html += '<div style="display:flex;align-items:center;gap:6px;margin-top:12px;font-size:10px;color:var(--muted)">';
  html += '<span>Menos</span>';
  ['var(--card)','rgba(124,58,237,.2)','rgba(124,58,237,.4)','rgba(124,58,237,.65)','var(--violet)'].forEach(function(bg){
    html += '<div style="width:14px;height:14px;border-radius:3px;background:'+bg+'"></div>';
  });
  html += '<span>Mais questões</span></div>';
  html += '</div>'; // card calendário

  // Painel do dia
  html += '<div style="background:var(--surface);border:1px solid var(--border-soft);border-radius:var(--radius);padding:16px;min-height:280px" id="consist-day-panel">';
  if (!consistSelDay || !byDay[consistSelDay]) {
    html += '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:220px;gap:8px;color:var(--dim)">'+
            '<span style="font-size:24px">📅</span>'+
            '<span style="font-size:12px">Clique em um dia</span></div>';
  } else {
    var ss = byDay[consistSelDay];
    var dd2 = new Date(consistSelDay+'T00:00:00');
    var dateStr = dd2.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
    dateStr = dateStr.charAt(0).toUpperCase()+dateStr.slice(1);
    var tqDay = ss.reduce(function(s,q){ return s+(q.total||0); },0);
    var acDay = tqDay ? Math.round(ss.reduce(function(s,q){ return s+(q.acertos||0); },0)/tqDay*100) : 0;
    var acDayC = acertoColor(acDay);

    html += '<div style="border-bottom:1px solid var(--border-soft);padding-bottom:10px;margin-bottom:12px">';
    html += '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px">'+dateStr+'</div>';
    html += '<div style="font-size:11px;color:var(--muted)">'+tqDay+' questões · <span style="color:'+acDayC+';font-weight:700">'+acDay+'% acerto</span></div>';
    html += '</div>';

    ss.forEach(function(s) {
      var sc = acertoColor(s.acerto||0);
      html += '<div style="padding:9px 0;border-bottom:1px solid var(--border-soft)">';
      html += '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:3px">'+escHtml(s.disciplina||'')+'</div>';
      html += '<div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:6px;line-height:1.3">'+escHtml(s.tema||'')+'</div>';
      html += '<div style="display:flex;align-items:center;gap:8px">';
      html += '<span style="font-size:11px;font-weight:700;color:var(--violet-light);flex-shrink:0">'+(s.total||0)+'q</span>';
      html += '<div style="flex:1;height:5px;background:var(--border-soft);border-radius:3px;overflow:hidden">';
      html += '<div style="width:'+(s.acerto||0)+'%;height:100%;background:'+sc+';border-radius:3px"></div></div>';
      html += '<span style="font-size:12px;font-weight:800;color:'+sc+';flex-shrink:0">'+(s.acerto||0)+'%</span>';
      html += '</div></div>';
    });
  }
  html += '</div>'; // painel dia

  html += '</div>'; // grid
  root.innerHTML = html;
}

function consistKpi(val, color, label, sub) {
  return '<div style="background:var(--card);border:1px solid var(--border-soft);border-radius:10px;padding:12px 14px">' +
    '<div style="font-size:20px;font-weight:800;color:'+color+';line-height:1">'+val+'</div>' +
    '<div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:3px">'+label+'</div>' +
    (sub ? '<div style="font-size:10px;color:var(--dim);margin-top:2px">'+sub+'</div>' : '') +
  '</div>';
}

function consistChangeMonth(dir) {
  consistMonth += dir;
  if (consistMonth > 11) { consistMonth = 0; consistYear++; }
  if (consistMonth < 0)  { consistMonth = 11; consistYear--; }
  consistSelDay = null;
  renderConsistencia();
}

// ══ KANBAN ESTUDO ══
var kbeState     = JSON.parse(localStorage.getItem('kbe_state') || '{}'); // key: matId+'_'+topicoIdx => 'red'|'yellow'|'green'
var kbeDragging  = null;
var kbeSearchQ   = '';
var kbeOpenMats  = {};

function kbeSave() { lsSave(); scheduleSave(); }

function kbeKey(matId, idx) { return matId + '_' + idx; }

function kbeGetAcerto(matId, idx) {
  var key = matId + '_' + idx;
  // usa curTopicosData
  var d = curTopicosData[key];
  var pct = d && d.acerto != null ? parseInt(d.acerto) : null;
  // complementa com questaoSessoes
  var qs = curTopicoQStats(null, null, matId, idx);
  if (qs && qs.total > 0) pct = qs.pct;
  return pct;
}

function renderKanbanEstudo() {
  var root = document.getElementById('kbe-root');
  if (!root) return;

  var html = '';

  // Toolbar
  html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">';
  html += '<span style="font-size:13px;font-weight:700;color:var(--text)">🗂️ Kanban de Aprendizagem</span>';
  html += '<div style="flex:1"></div>';
  html += '<span style="font-size:10px;color:var(--muted)"><span style="color:var(--red)">●</span> Aprendendo &nbsp; <span style="color:var(--amber)">●</span> Praticando &nbsp; <span style="color:var(--green)">●</span> Dominado</span>';
  html += '</div>';
  // Barra de instrução para toque (aparece quando algo selecionado)
  html += '<div id="kbe-tap-hint" style="display:none;align-items:center;gap:10px;margin-bottom:10px;padding:8px 14px;background:var(--violet-glow);border:1px solid var(--violet);border-radius:8px;font-size:11px;color:var(--violet-light);flex-wrap:wrap">';
  html += '<span>👆 Tópico selecionado — toque numa coluna para mover, ou:</span>';
  html += '<button onclick="kbeTapMoveTo(&quot;red&quot;)" style="font-size:11px;padding:3px 10px;border-radius:6px;border:1px solid rgba(239,68,68,.4);background:rgba(239,68,68,.1);color:var(--red);cursor:pointer">🔴 Aprendendo</button>';
  html += '<button onclick="kbeTapMoveTo(&quot;yellow&quot;)" style="font-size:11px;padding:3px 10px;border-radius:6px;border:1px solid rgba(245,158,11,.4);background:rgba(245,158,11,.1);color:var(--amber);cursor:pointer">🟡 Praticando</button>';
  html += '<button onclick="kbeTapMoveTo(&quot;green&quot;)" style="font-size:11px;padding:3px 10px;border-radius:6px;border:1px solid rgba(16,185,129,.4);background:rgba(16,185,129,.1);color:var(--green);cursor:pointer">🟢 Dominado</button>';
  html += '<button onclick="kbeTapMoveTo(null)" style="font-size:11px;padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text-dim);cursor:pointer">↩ Backlog</button>';
  html += '<button onclick="kbeTapSelected=null;kbeUpdateTapVisual()" style="font-size:11px;padding:3px 8px;border-radius:6px;border:none;background:transparent;color:var(--text-dim);cursor:pointer;margin-left:auto">✕ Cancelar</button>';
  html += '</div>';

  // Layout
  html += '<div class="kbe-layout">';

  // ── Backlog ──
  html += '<div class="kbe-backlog">';
  html += '<div style="padding:10px 12px;border-bottom:1px solid var(--border-soft);flex-shrink:0">';
  html += '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:6px">📚 Backlog</div>';
  html += '<input oninput="kbeSearchQ=this.value.toLowerCase();renderKanbanEstudo()" value="'+escHtml(kbeSearchQ)+'" placeholder="🔍 Buscar tópico..." '+
          'style="width:100%;padding:5px 10px;background:var(--card);border:1px solid var(--border-soft);border-radius:7px;color:var(--text);font-size:11px;outline:none">';
  html += '</div>';
  html += '<div class="kbe-backlog-scroll">';

  curriculo.forEach(function(mat) {
    var inBacklog = mat.topicos.filter(function(_, i){ return !kbeState[kbeKey(mat.id, i)]; });
    var matchesMat = !kbeSearchQ || mat.nome.toLowerCase().includes(kbeSearchQ);
    var matchesTopic = mat.topicos.some(function(t,i){ return !kbeState[kbeKey(mat.id,i)] && t.toLowerCase().includes(kbeSearchQ); });
    if (kbeSearchQ && !matchesMat && !matchesTopic) return;
    if (!inBacklog.length && kbeSearchQ === '') return;

    var isOpen = kbeOpenMats[mat.id] !== false; // aberto por padrão
    html += '<div class="kbe-mat-header" onclick="kbeToggleMat('+mat.id+')">';
    html += '<span style="font-size:10px;color:var(--muted);transition:transform .15s;'+(isOpen?'transform:rotate(90deg)':'')+'">▶</span>';
    html += '<span style="flex:1;font-size:11px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escHtml(mat.nome)+'</span>';
    html += '<span style="font-size:9px;color:var(--muted);background:var(--border-soft);padding:1px 6px;border-radius:10px">'+inBacklog.length+'</span>';
    html += '</div>';

    html += '<div class="kbe-mat-topics'+(isOpen?' open':'') +'" id="kbe-mat-'+mat.id+'">';
    mat.topicos.forEach(function(t, i) {
      var key = kbeKey(mat.id, i);
      if (kbeState[key]) return;
      if (kbeSearchQ && !t.toLowerCase().includes(kbeSearchQ) && !matchesMat) return;
      var pct = kbeGetAcerto(mat.id, i);
      var dotBg = pct != null ? (acertoColor(pct)) : 'var(--dim)';
      html += '<div class="kbe-topic-row" draggable="true" data-kbekey="'+key+'" '+
              'ondragstart="kbeDragStart(event,&quot;'+key+'&quot;)" onclick="kbeTapSelect(&quot;'+key+'&quot;,event)">' +
              '<span style="width:6px;height:6px;border-radius:50%;background:'+dotBg+';flex-shrink:0"></span>'+
              escHtml(t)+
              '</div>';
    });
    html += '</div>';
  });

  html += '</div></div>'; // backlog-scroll + backlog

  // ── Colunas ──
  html += '<div class="kbe-cols">';

  var cols = [
    {id:'red',   label:'🔴 Aprendendo', bdot:'var(--red)',   bg:'rgba(239,68,68,.08)',   bc:'rgba(239,68,68,.2)',   bbg:'rgba(239,68,68,.15)',  bfg:'var(--red)'},
    {id:'yellow',label:'🟡 Praticando', bdot:'var(--amber)', bg:'rgba(245,158,11,.08)', bc:'rgba(245,158,11,.2)',  bbg:'rgba(245,158,11,.12)', bfg:'var(--amber)'},
    {id:'green', label:'🟢 Dominado',   bdot:'var(--green)', bg:'rgba(16,185,129,.08)', bc:'rgba(16,185,129,.2)',  bbg:'rgba(16,185,129,.12)', bfg:'var(--green)'},
  ];

  cols.forEach(function(col) {
    var items = [];
    curriculo.forEach(function(mat){
      mat.topicos.forEach(function(t, i){
        if (kbeState[kbeKey(mat.id,i)] === col.id) items.push({mat, t, i, key:kbeKey(mat.id,i)});
      });
    });
    var others = cols.filter(function(cc){ return cc.id !== col.id; });

    html += '<div class="kbe-col kbe-'+col.id+'" '+
            'ondragover="event.preventDefault();kbeDragOverCol(&quot;'+col.id+'&quot;)" '+
            'ondragleave="kbeDragLeaveCol(&quot;'+col.id+'&quot;)" '+
            'ondrop="kbeDrop(event,&quot;'+col.id+'&quot;)" '+
            'onclick="if(kbeTapSelected)kbeTapMoveTo(&quot;'+col.id+'&quot;)">';
    html += '<div class="kbe-col-hdr">';
    html += '<span style="width:10px;height:10px;border-radius:50%;background:'+col.bdot+';flex-shrink:0"></span>';
    html += '<span style="font-size:12px;font-weight:700;color:var(--text);flex:1">'+col.label+'</span>';
    html += '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:'+col.bbg+';color:'+col.bfg+'">'+items.length+'</span>';
    html += '</div>';
    html += '<div class="kbe-col-body" id="kbe-col-body-'+col.id+'">';

    if (!items.length) {
      html += '<div class="kbe-drop-empty">Arraste tópicos aqui</div>';
    } else {
      items.forEach(function(item) {
        var pct = kbeGetAcerto(item.mat.id, item.i);
        var pctC = pct!=null ? (acertoColor(pct)) : '';
        var qs = curTopicoQStats(null, null, item.mat.id, item.i);
        html += '<div class="kbe-card" draggable="true" data-kbekey="'+item.key+'" ondragstart="kbeDragStart(event,&quot;'+item.key+'&quot;)" onclick="kbeTapSelect(&quot;'+item.key+'&quot;,event)">';
        html += '<div class="kbe-card-btns">';
        others.forEach(function(cc){
          html += '<button class="kbe-mbtn" onclick="kbeMoveCard(&quot;'+item.key+'&quot;,&quot;'+cc.id+'&quot;)" title="→ '+cc.label+'">'+cc.label.split(' ')[0]+'</button>';
        });
        html += '<button class="kbe-mbtn" onclick="kbeMoveCard(&quot;'+item.key+'&quot;,null)" title="Voltar ao backlog" style="color:var(--dim)">↩</button>';
        html += '</div>';
        html += '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:3px">'+escHtml(item.mat.nome)+'</div>';
        html += '<div style="font-size:11px;font-weight:600;color:var(--text);line-height:1.3;margin-bottom:'+(pct!=null?'7px':'2px')+'">'+escHtml(item.t)+'</div>';
        if (pct != null) {
          var qtotal = qs ? qs.total : 0;
          html += '<div style="display:flex;align-items:center;gap:6px">';
          if (qtotal) html += '<span style="font-size:10px;font-weight:700;color:var(--violet-light);flex-shrink:0">'+qtotal+'q</span>';
          html += '<div style="flex:1;height:4px;background:var(--border-soft);border-radius:2px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+pctC+';border-radius:2px"></div></div>';
          html += '<span style="font-size:11px;font-weight:800;color:'+pctC+'">'+pct+'%</span>';
          html += '</div>';
        } else {
          html += '<div style="font-size:10px;color:var(--dim)">sem dados</div>';
        }
        html += '</div>';
      });
    }

    html += '</div></div>'; // col-body + col
  });

  html += '</div></div>'; // cols + layout
  root.innerHTML = html;
  kbeUpdateTapVisual();
}


function kbeDragOverCol(colId) {
  var el = document.getElementById('kbe-col-body-'+colId);
  if (el) el.classList.add('kbe-dragover');
}
function kbeDragLeaveCol(colId) {
  var el = document.getElementById('kbe-col-body-'+colId);
  if (el) el.classList.remove('kbe-dragover');
}
function kbeToggleMat(matId) {
  kbeOpenMats[matId] = kbeOpenMats[matId] === false ? true : false;
  var el = document.getElementById('kbe-mat-'+matId);
  if (el) el.classList.toggle('open');
}

function kbeDragStart(e, key) {
  kbeDragging = key;
  e.dataTransfer.effectAllowed = 'move';
}

function kbeDrop(e, col) {
  e.preventDefault();
  document.querySelectorAll('.kbe-col-body').forEach(function(b){ b.classList.remove('kbe-dragover'); });
  if (kbeDragging) { kbeState[kbeDragging] = col; kbeDragging = null; kbeSave(); renderKanbanEstudo(); }
}

function kbeMoveCard(key, col) {
  kbeState[key] = col;
  kbeSave();
  renderKanbanEstudo();
}

function acertoColor(pct) {
  if (pct == null) return 'var(--dim)';
  if (pct > 90)  return '#16a34a'; // verde escuro   > 90%–100%
  if (pct > 87)  return '#22c55e'; // verde           > 87%–90%
  if (pct > 84)  return '#86efac'; // verde claro     > 84%–87%
  if (pct > 80)  return '#bef264'; // verde-amarelo   > 80%–84%
  if (pct > 76)  return '#facc15'; // amarelo         > 76%–80%
  if (pct > 70)  return '#fb923c'; // laranja-amarelo > 70%–76%
  if (pct > 60)  return '#f97316'; // laranja         > 60%–70%
  return '#ef4444';                 // vermelho-laranja até 60%
}

function limparSessoesOrfas() {
  if (!confirm('Remover todos os lançamentos sem tópico correspondente no currículo?')) return;
  questaoSessoes = questaoSessoes.filter(function(s) {
    if (s.matId != null && s.topicoIdx != null) {
      var mat2 = curriculo.find(function(m){ return m.id === s.matId; });
      return mat2 && s.topicoIdx < mat2.topicos.length;
    }
    var matMatch = curriculo.find(function(m){ return m.nome === s.disciplina; });
    if (!matMatch) return false;
    return matMatch.topicos.indexOf(s.tema) !== -1;
  });
  lsSave();
  scheduleSave();
  renderDesempenho();
  showToast('✅ Lançamentos órfãos removidos');
}

function abrirVincularOrfa(qsIdx) {
  var s = questaoSessoes[qsIdx];
  if (!s) return;
  document.getElementById('vincular-qs-idx').value = qsIdx;
  document.getElementById('vincular-info').innerHTML =
    '<strong style="color:var(--text)">'+escHtml(s.disciplina||'?')+'</strong> — '+escHtml(s.tema||'')+'<br>'+
    '<span style="color:var(--violet-light)">'+s.total+'q</span> · '+
    '<span style="font-weight:700;color:'+acertoColor(s.acerto||0)+'">'+s.acerto+'%</span> · '+s.data;

  // Popula select de matérias
  var matSel = document.getElementById('vincular-mat');
  matSel.innerHTML = curriculo.map(function(m){
    var sel = m.nome === s.disciplina ? ' selected' : '';
    return '<option value="'+m.id+'"'+sel+'>'+escHtml(m.nome)+'</option>';
  }).join('');
  vincularPopulateTopicos();
  openModal('modal-vincular-orfa');
}

function vincularPopulateTopicos() {
  var matId = parseInt(document.getElementById('vincular-mat').value);
  var mat = curriculo.find(function(m){ return m.id === matId; });
  var topSel = document.getElementById('vincular-topico');
  if (!mat) { topSel.innerHTML = ''; return; }
  var qs = questaoSessoes[parseInt(document.getElementById('vincular-qs-idx').value)];
  topSel.innerHTML = mat.topicos.map(function(t, i){
    var sel = t === (qs ? qs.tema : '') ? ' selected' : '';
    return '<option value="'+i+'"'+sel+'>'+escHtml(t)+'</option>';
  }).join('');
}

function salvarVinculoOrfa() {
  var qsIdx  = parseInt(document.getElementById('vincular-qs-idx').value);
  var matId  = parseInt(document.getElementById('vincular-mat').value);
  var topIdx = parseInt(document.getElementById('vincular-topico').value);
  var s = questaoSessoes[qsIdx];
  var mat = curriculo.find(function(m){ return m.id === matId; });
  if (!s || !mat) return;
  s.matId      = matId;
  s.topicoIdx  = topIdx;
  s.disciplina = mat.nome;
  s.tema       = mat.topicos[topIdx] || s.tema;
  // Corrige outros lançamentos da mesma sessão que tenham tema igual mas índice errado
  questaoSessoes.forEach(function(q) {
    if (q !== s && q.matId === matId && q.tema === s.tema && q.topicoIdx !== topIdx) {
      q.topicoIdx = topIdx;
    }
  });
  lsSave();
  scheduleSave();
  closeModal('modal-vincular-orfa');
  renderDesempenho();
  showToast('✅ Lançamento vinculado a: '+escHtml(mat.topicos[topIdx]||''));
}

function openAddMateriaDese() {
  document.getElementById('add-mat-nome').value = '';
  openModal('modal-add-materia');
  setTimeout(function(){ document.getElementById('add-mat-nome').focus(); }, 200);
}

function saveAddMateriaDese() {
  var nome = document.getElementById('add-mat-nome').value.trim();
  if (!nome) { showToast('⚠️ Informe o nome da matéria'); return; }
  // Gera próximo ID
  var maxId = curriculo.reduce(function(mx, m){ return Math.max(mx, m.id); }, 0);
  curriculo.push({ id: maxId + 1, nome: nome, tags: [], topicos: [] });
  deseMatId = maxId + 1;
  lsSave();
  if (cloudTimer) clearTimeout(cloudTimer);
  fbCloudSave();
  closeModal('modal-add-materia');
  renderDesempenho();
  showToast('✅ Matéria adicionada: ' + nome);
}

// ══ KANBAN — SUPORTE A TOQUE (TABLET) ══
var kbeTapSelected = null; // key do tópico/card selecionado por toque

function kbeTapSelect(key, e) {
  if (e) { e.stopPropagation(); }
  if (kbeTapSelected === key) {
    kbeTapSelected = null; // deseleciona
  } else {
    kbeTapSelected = key;
  }
  kbeUpdateTapVisual();
}

function kbeUpdateTapVisual() {
  // Remove destaque de todos
  document.querySelectorAll('[data-kbekey]').forEach(function(el){
    el.style.outline = '';
    el.style.outlineOffset = '';
  });
  // Destaca o selecionado
  if (kbeTapSelected) {
    document.querySelectorAll('[data-kbekey="'+kbeTapSelected+'"]').forEach(function(el){
      el.style.outline = '2px solid var(--violet)';
      el.style.outlineOffset = '1px';
    });
  }
  // Mostra/esconde barra de instrução
  var bar = document.getElementById('kbe-tap-hint');
  if (bar) bar.style.display = kbeTapSelected ? 'flex' : 'none';
}

function kbeTapMoveTo(col) {
  if (!kbeTapSelected) return;
  kbeState[kbeTapSelected] = col;
  kbeTapSelected = null;
  kbeSave();
  renderKanbanEstudo();
}

// ══ PROTEÇÃO CONTRA MODAL PRESO / TELA PRETA ══
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(function(m){ m.classList.remove('open'); });
  }
});
// Clicar no fundo do overlay (fora do .modal) fecha
document.addEventListener('click', function(e) {
  if (e.target.classList && e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
}, true);
// Função de emergência: fecha tudo
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(function(m){ m.classList.remove('open'); });
}

// ══ FINANCEIRO — TAGS ══
function finAddTagChip(txt) {
  var wrap = document.getElementById('fin-tag-wrap');
  var inp  = document.getElementById('fin-tag-inp');
  if (!wrap || !txt.trim()) return;
  // Evita duplicata
  var existing = Array.from(wrap.querySelectorAll('.fin-tag-chip')).map(function(c){ return c.dataset.tag; });
  if (existing.indexOf(txt.trim()) !== -1) return;
  var chip = document.createElement('span');
  chip.className = 'fin-tag-chip';
  chip.dataset.tag = txt.trim();
  chip.innerHTML = escHtml(txt.trim()) + ' <button class="fin-tag-rm" onclick="this.parentElement.remove()">✕</button>';
  wrap.insertBefore(chip, inp);
}

function finGetTags() {
  var wrap = document.getElementById('fin-tag-wrap');
  if (!wrap) return [];
  return Array.from(wrap.querySelectorAll('.fin-tag-chip')).map(function(c){ return c.dataset.tag; });
}

function finTagKey(e) {
  if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
    e.preventDefault();
    finTagConfirmBtn();
  } else if (e.key === 'Backspace' && !e.target.value) {
    var chips = document.querySelectorAll('#fin-tag-wrap .fin-tag-chip');
    if (chips.length) chips[chips.length-1].remove();
  }
}

function finTagConfirmBtn() {
  var inp = document.getElementById('fin-tag-inp');
  if (!inp) return;
  var val = inp.value.replace(/[,;]+$/, '').trim();
  if (val) { finAddTagChip(val); inp.value = ''; }
  var recent = document.getElementById('fin-tag-recent');
  if (recent) recent.style.display = 'none';
  inp.focus();
}

function finTagConfirmBlur(inp) {
  // Pequeno delay para não conflitar com clique no botão + ou nas sugestões
  setTimeout(function() {
    var val = (inp.value || '').replace(/[,;]+$/, '').trim();
    if (val) { finAddTagChip(val); inp.value = ''; }
  }, 200);
}

function finTagSuggest(val) {
  var recent = document.getElementById('fin-tag-recent');
  if (!recent) return;
  if (!val || val.length < 1) { recent.style.display = 'none'; return; }
  // Coleta todas as tags já usadas
  var allTags = {};
  finances.forEach(function(f){ (f.tags||[]).forEach(function(t){ allTags[t] = (allTags[t]||0)+1; }); });
  var matches = Object.keys(allTags).filter(function(t){ return t.toLowerCase().includes(val.toLowerCase()); })
    .sort(function(a,b){ return allTags[b]-allTags[a]; }).slice(0,6);
  if (!matches.length) { recent.style.display = 'none'; return; }
  recent.style.display = 'flex';
  recent.innerHTML = matches.map(function(t){
    return '<span onclick="finAddTagChip(\''+escHtml(t)+'\');document.getElementById(\'fin-tag-inp\').value=\'\';document.getElementById(\'fin-tag-recent\').style.display=\'none\'">'+escHtml(t)+'</span>';
  }).join('');
}

function finShowRecentTags() {
  var allTags = {};
  finances.forEach(function(f){ (f.tags||[]).forEach(function(t){ allTags[t] = (allTags[t]||0)+1; }); });
  var top = Object.keys(allTags).sort(function(a,b){ return allTags[b]-allTags[a]; }).slice(0,8);
  var recent = document.getElementById('fin-tag-recent');
  if (!recent || !top.length) return;
  recent.style.display = 'flex';
  recent.innerHTML = '<span style="color:var(--dim);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;align-self:center">Recentes:</span>' +
    top.map(function(t){
      return '<span onclick="finAddTagChip(\''+escHtml(t)+'\')">'+escHtml(t)+'</span>';
    }).join('');
}

// ══ FINANCEIRO — RELATÓRIO ══
var finRelSort = 'date';
var finRelAsc  = false;
var finRelOpen = false;

function toggleFinRelatorio(btn) {
  finRelOpen = !finRelOpen;
  var section = document.getElementById('fin-relatorio-section');
  var main    = document.getElementById('fin-main-section');
  if (!section || !main) return;
  if (finRelOpen) {
    btn.style.background = 'var(--violet)';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    section.style.display = 'block';
    main.style.display = 'none';
    renderFinRelatorio();
  } else {
    btn.style.background = '';
    btn.style.color = '';
    btn.style.border = '';
    section.style.display = 'none';
    main.style.display = 'block';
  }
}

function renderFinRelatorio() {
  var section = document.getElementById('fin-relatorio-section');
  if (!section) return;

  // Salva filtros atuais antes de reconstruir o HTML
  var _savedFilters = {};
  ['frel-ini','frel-fim','frel-tipo','frel-cat','frel-method','frel-tag','frel-obs'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) _savedFilters[id] = el.value;
  });

  // Coleta opções de filtro
  var cats    = [...new Set(finances.map(function(f){ return f.category; }).filter(Boolean))].sort();
  var methods = [...new Set(finances.map(function(f){ return f.method;   }).filter(Boolean))].sort();
  var allTags = {};
  finances.forEach(function(f){ (f.tags||[]).forEach(function(t){ allTags[t]=(allTags[t]||0)+1; }); });
  var tagOpts = Object.keys(allTags).sort(function(a,b){ return allTags[b]-allTags[a]; });

  var catOpts    = cats.map(function(c){ return '<option value="'+escHtml(c)+'">'+escHtml(c)+'</option>'; }).join('');
  var methodOpts = methods.map(function(m){ return '<option value="'+escHtml(m)+'">'+escHtml(m)+'</option>'; }).join('');
  var tagOptList = tagOpts.map(function(t){ return '<option value="'+escHtml(t)+'">'+escHtml(t)+'</option>'; }).join('');

  var sortIcon = function(f){ return finRelSort===f ? (finRelAsc?'↑':'↓') : '↕'; };
  var th = function(f, label){
    var cls = finRelSort===f ? ' rel-active' : '';
    return '<th class="'+cls+'" onclick="finRelSortBy(\''+f+'\')">'+label+' <span style="opacity:.6">'+sortIcon(f)+'</span></th>';
  };

  section.innerHTML =
    '<div style="background:var(--surface);border:1px solid var(--border-soft);border-radius:var(--radius);padding:16px;margin-bottom:12px">' +

      // KPIs
      '<div id="fin-rel-kpis" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px"></div>' +

      // Filtros
      '<div style="background:var(--card);border:1px solid var(--border-soft);border-radius:10px;padding:12px;margin-bottom:12px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
          '<span style="font-size:11px;font-weight:700;color:var(--text)">🔍 Filtros</span>' +
          '<button onclick="finRelClear()" style="font-size:10px;padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text-muted);cursor:pointer">Limpar</button>' +
        '</div>' +
        '<div class="rel-filter-grid">' +
          '<div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:3px">📅 Data inicial</div>' +
            '<input class="form-input" style="font-size:11px" type="date" id="frel-ini" oninput="debounceRelRender()"></div>' +
          '<div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:3px">📅 Data final</div>' +
            '<input class="form-input" style="font-size:11px" type="date" id="frel-fim" oninput="debounceRelRender()"></div>' +
          '<div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:3px">⚡ Tipo</div>' +
            '<select class="form-select" style="font-size:11px" id="frel-tipo" onchange="finRelRender()"><option value="">Todos</option><option value="entrada">Entrada</option><option value="saida">Saída</option></select></div>' +
          '<div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:3px">📂 Categoria</div>' +
            '<select class="form-select" style="font-size:11px" id="frel-cat" onchange="finRelRender()"><option value="">Todas</option>'+catOpts+'</select></div>' +
          '<div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:3px">💳 Forma pgto</div>' +
            '<select class="form-select" style="font-size:11px" id="frel-method" onchange="finRelRender()"><option value="">Todas</option>'+methodOpts+'</select></div>' +
          '<div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:3px">🏷️ Tag</div>' +
            '<input class="form-input" list="frel-tag-list" style="font-size:11px" id="frel-tag" placeholder="Ex: IMPROS" oninput="debounceRelRender()">'+
            '<datalist id="frel-tag-list">'+tagOptList+'</datalist></div>' +
          '<div style="grid-column:1/-1"><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:3px">📝 Buscar em descrição / estabelecimento / observação</div>' +
            '<input class="form-input" style="font-size:11px;width:100%" id="frel-obs" placeholder="Palavra-chave..." oninput="debounceRelRender()"></div>' +
        '</div>' +
      '</div>' +

      // Ações
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<span style="font-size:11px;color:var(--muted)" id="frel-count">— lançamentos</span>' +
        '<div style="display:flex;gap:6px">' +
          '<button onclick="finRelExportCSV()" style="font-size:10px;padding:4px 12px;border-radius:7px;border:1px solid var(--border);background:var(--card);color:var(--text-muted);cursor:pointer">📥 CSV</button>' +
          '<button onclick="finRelImprimir(\'landscape\')" style="font-size:10px;padding:4px 10px;border-radius:7px;border:none;background:var(--violet);color:#fff;cursor:pointer">🖨️ Paisagem</button>' +
          '<button onclick="finRelImprimir(\'portrait\')" style="font-size:10px;padding:4px 10px;border-radius:7px;border:1px solid var(--violet);background:transparent;color:var(--violet-light);cursor:pointer">🖨️ Retrato</button>' +
        '</div>' +
      '</div>' +

      // Tabela
      '<div style="overflow-x:auto">' +
        '<table class="rel-table">' +
          '<thead><tr>' +
            th('date','Data') + th('desc','Descrição') + th('type','Tipo') + '<th>Status</th>' +
            th('category','Categoria') + th('method','Forma') + th('value','Valor') +
            '<th>Tags</th><th>Obs.</th>' +
          '</tr></thead>' +
          '<tbody id="frel-tbody"></tbody>' +
        '</table>' +
      '</div>' +

      // Totais
      '<div style="display:flex;gap:20px;justify-content:flex-end;margin-top:10px;padding-top:10px;border-top:1px solid var(--border-soft);font-size:11px">' +
        '<span>Entradas: <strong id="frel-tot-in" style="color:var(--green)">—</strong></span>' +
        '<span>Saídas: <strong id="frel-tot-out" style="color:var(--red)">—</strong></span>' +
        '<span>Saldo: <strong id="frel-tot-bal">—</strong></span>' +
      '</div>' +
    '</div>';

  // Aplica filtros pendentes (ex: vindos de orcVerNoRelatorio)
  if (window._relFiltrosPendentes) {
    var p = window._relFiltrosPendentes;
    var fIni  = document.getElementById('frel-ini');
    var fFim  = document.getElementById('frel-fim');
    var fTipo = document.getElementById('frel-tipo');
    var fCat  = document.getElementById('frel-cat');
    var fMeth = document.getElementById('frel-method');
    if (fIni)  fIni.value  = p.ini    || '';
    if (fFim)  fFim.value  = p.fim    || '';
    if (fTipo) fTipo.value = p.tipo   || '';
    if (fCat)  fCat.value  = p.cat    || '';
    if (fMeth) fMeth.value = p.method || '';
    window._relFiltrosPendentes = null;
  } else {
    // Restaura filtros salvos antes da re-renderização
    ['frel-ini','frel-fim','frel-tipo','frel-cat','frel-method','frel-tag','frel-obs'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el && _savedFilters[id]) el.value = _savedFilters[id];
    });
  }
  finRelRender();
}

function finRelFiltered() {
  var ini    = (document.getElementById('frel-ini')    || {}).value || '';
  var fim    = (document.getElementById('frel-fim')    || {}).value || '';
  var tipo   = (document.getElementById('frel-tipo')   || {}).value || '';
  var cat    = (document.getElementById('frel-cat')    || {}).value || '';
  var method = (document.getElementById('frel-method') || {}).value || '';
  var tag    = ((document.getElementById('frel-tag')   || {}).value || '').toLowerCase().trim();
  var obs    = ((document.getElementById('frel-obs')   || {}).value || '').toLowerCase().trim();

  return finances.filter(function(f) {
    if (ini && f.date < ini) return false;
    if (fim && f.date > fim) return false;
    if (tipo && f.type !== tipo) return false;
    if (cat && f.category !== cat) return false;
    if (method && f.method !== method) return false;
    if (tag && !(f.tags||[]).some(function(t){ return t.toLowerCase().includes(tag); })) return false;
    if (obs && !f.desc.toLowerCase().includes(obs) && !(f.obs||'').toLowerCase().includes(obs) && !(f.source||'').toLowerCase().includes(obs)) return false;
    return true;
  });
}

function finRelRender() {
  var data = finRelFiltered();
  var sorted = data.slice().sort(function(a,b){
    var av = a[finRelSort], bv = b[finRelSort];
    if (typeof av === 'string') { av=av.toLowerCase(); bv=bv.toLowerCase(); }
    if (av == null) av = ''; if (bv == null) bv = '';
    return finRelAsc ? (av>bv?1:-1) : (av<bv?1:-1);
  });

  var tbody = document.getElementById('frel-tbody');
  if (!tbody) return;

  tbody.innerHTML = sorted.map(function(f) {
    var tags = (f.tags||[]).map(function(t){
      return '<span style="display:inline-flex;align-items:center;gap:2px;padding:1px 4px 1px 6px;border-radius:8px;background:var(--violet-glow);border:1px solid rgba(124,58,237,.25);color:var(--violet-light);font-size:9px;font-weight:600;margin:1px">'+escHtml(t)+
        '<button onclick="event.stopPropagation();removeFinTag('+f.id+',&quot;'+escHtml(t).replace(/"/g,'&amp;quot;')+'&quot;)" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:9px;padding:0 1px;line-height:1">✕</button></span>';
    }).join(' ');
    var dateF = f.date ? new Date(f.date+'T00:00:00').toLocaleDateString('pt-BR') : '—';
    var valC  = f.type==='entrada' ? 'var(--green)' : 'var(--red)';
    var badge = f.type==='entrada'
      ? '<span style="background:rgba(16,185,129,.15);color:var(--green);border:1px solid rgba(16,185,129,.25);padding:1px 7px;border-radius:8px;font-size:9px;font-weight:700">Entrada</span>'
      : '<span style="background:rgba(239,68,68,.12);color:var(--red);border:1px solid rgba(239,68,68,.2);padding:1px 7px;border-radius:8px;font-size:9px;font-weight:700">Saída</span>';
    return '<tr style="cursor:pointer" onclick="editFinance('+f.id+')" title="Clique para editar">' +
      '<td style="font-family:monospace;color:var(--text-muted);font-size:10px;white-space:nowrap">'+dateF+'</td>' +
      '<td style="font-weight:600;max-width:200px">'+escHtml(f.desc)+(f.source?'<div style="font-size:9px;color:var(--dim)">'+escHtml(f.source)+'</div>':'')+'</td>' +
      '<td>'+badge+'</td>' +
      '<td><span class="status-badge status-'+(f.status||'pago')+'" onclick="event.stopPropagation();toggleFinStatus('+f.id+');finRelRender()" style="cursor:pointer">'+(f.type==='entrada'?(f.status==='pendente'?'⏳ A receber':'✅ Recebido'):(f.status==='pendente'?'⏳ Pendente':f.status==='parcela'?'📋 Parcela':'✅ Pago'))+'</span>'+(f.lembrete?'<span title="Lembrete ativo" style="margin-left:4px;cursor:pointer;font-size:11px" onclick="event.stopPropagation();toggleLembrete('+f.id+');finRelRender()">🔔</span>':'')+'</td>' +
      '<td><span style="font-size:10px;background:var(--border-soft);padding:2px 7px;border-radius:6px;color:var(--muted)">'+escHtml(f.category||'')+'</span></td>' +
      '<td style="color:var(--text-muted);font-size:11px;white-space:nowrap">'+escHtml(f.method||'')+'</td>' +
      '<td style="font-weight:800;color:'+valC+';font-size:12px;white-space:nowrap">'+(f.type==='entrada'?'+':'-')+fmtMoney(f.value)+'</td>' +
      '<td>'+(tags||'<span style="color:var(--dim);font-size:10px">—</span>')+'</td>' +
      '<td style="color:var(--dim);font-size:10px;max-width:120px">'+escHtml(f.obs||'—')+'</td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--dim)">Nenhum lançamento encontrado</td></tr>';

  // Totais
  var totIn  = data.filter(function(f){ return f.type==='entrada'; }).reduce(function(s,f){ return s+f.value; }, 0);
  var totOut = data.filter(function(f){ return f.type==='saida';   }).reduce(function(s,f){ return s+f.value; }, 0);
  var bal    = totIn - totOut;
  var el;
  el = document.getElementById('frel-count');    if (el) el.textContent = sorted.length + ' lançamento(s)';
  el = document.getElementById('frel-tot-in');   if (el) el.textContent = 'R$ '+fmtMoney(totIn);
  el = document.getElementById('frel-tot-out');  if (el) el.textContent = 'R$ '+fmtMoney(totOut);
  el = document.getElementById('frel-tot-bal');
  if (el) {
    el.textContent = (bal>=0?'+':'-')+'R$ '+fmtMoney(Math.abs(bal));
    el.style.color = bal>=0 ? 'var(--green)' : 'var(--red)';
  }

  // KPIs
  var kpiEl = document.getElementById('fin-rel-kpis');
  if (kpiEl) {
    var acGC = totIn>totOut?'var(--green)':'var(--red)';
    kpiEl.innerHTML =
      finRelKpi(sorted.length+'', 'var(--violet-light)', 'Lançamentos', '') +
      finRelKpi('R$ '+fmtMoney(totIn), 'var(--green)', 'Total entradas', '') +
      finRelKpi('R$ '+fmtMoney(totOut), 'var(--red)', 'Total saídas', '') +
      finRelKpi((bal>=0?'+':'-')+'R$ '+fmtMoney(Math.abs(bal)), acGC, 'Saldo filtrado', '');
  }
}

function finRelKpi(val, color, label, sub) {
  return '<div style="background:var(--card);border:1px solid var(--border-soft);border-radius:10px;padding:10px 12px">' +
    '<div style="font-size:16px;font-weight:800;color:'+color+';line-height:1">'+val+'</div>' +
    '<div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:3px">'+label+'</div>' +
  '</div>';
}

function finRelSortBy(field) {
  finRelSort = field === finRelSort ? finRelSort : field;
  finRelAsc  = field === finRelSort ? !finRelAsc : false;
  finRelSort = field;
  renderFinRelatorio();
}

function finRelClear() {
  ['frel-ini','frel-fim','frel-tag','frel-obs'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = '';
  });
  ['frel-tipo','frel-cat','frel-method'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.selectedIndex = 0;
  });
  finRelRender();
}

function finRelExportCSV() {
  var data = finRelFiltered();
  var header = ['Data','Descrição','Tipo','Categoria','Forma Pgto','Valor','Tags','Observação'];
  var rows   = data.map(function(f){
    return [f.date, f.desc, f.type==='entrada'?'Entrada':'Saída', f.category||'', f.method||'',
            f.value.toFixed(2).replace('.',','), (f.tags||[]).join(';'), f.obs||''];
  });
  var csv = [header].concat(rows).map(function(r){
    return r.map(function(v){ return '"'+String(v).replace(/"/g,'""')+'"'; }).join(',');
  }).join('\n');
  var a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = 'relatorio-financeiro.csv';
  a.click();
}

// ══ RECUPERAÇÃO DE EMERGÊNCIA — Finances ══
function recuperarLancamentos() {
  try {
    var bk = localStorage.getItem('painel_finances_backup');
    if (!bk) { alert('Nenhum backup encontrado no localStorage.'); return; }
    var obj = JSON.parse(bk);
    var dt = new Date(obj.ts).toLocaleString('pt-BR');
    if (confirm('Restaurar ' + obj.data.length + ' lançamentos do backup de ' + dt + '?')) {
      finances = obj.data;
      if (obj.nextFinId) nextFinId = obj.nextFinId;
      lsSave();
      scheduleSave();
      if (typeof renderFinance === 'function') renderFinance();
      showToast('✅ ' + obj.data.length + ' lançamentos recuperados!');
    }
  } catch(e) { alert('Erro ao recuperar: ' + e.message); }
}

// Exibe aviso se finances estiver vazio após carregar
function checkFinancesEmpty() {
  var bk = localStorage.getItem('painel_finances_backup');
  if (finances.length === 0 && bk) {
    try {
      var obj = JSON.parse(bk);
      if (obj.data && obj.data.length > 0) {
        var dt = new Date(obj.ts).toLocaleString('pt-BR');
        showToast('⚠️ Lançamentos vazios — backup disponível (' + obj.data.length + ' registros de ' + dt + ')');
        // Cria botão de recuperação temporário
        setTimeout(function() {
          var btn = document.createElement('button');
          btn.textContent = '🔄 Recuperar lançamentos';
          btn.onclick = recuperarLancamentos;
          btn.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:10px 20px;background:var(--violet);color:#fff;border:none;border-radius:10px;cursor:pointer;font-size:13px;font-weight:700;z-index:9000;box-shadow:0 4px 16px rgba(0,0,0,.4)';
          btn.id = 'btn-recover-finances';
          document.body.appendChild(btn);
          setTimeout(function(){ var b=document.getElementById('btn-recover-finances'); if(b)b.remove(); }, 30000);
        }, 2000);
      }
    } catch(e) {}
  }
}

function removeFinTag(finId, tagName) {
  var f = finances.find(function(x){ return x.id === finId; });
  if (!f || !f.tags) return;
  f.tags = f.tags.filter(function(t){ return t !== tagName; });
  lsSave();
  scheduleSave();
  renderFinance();
  if (finRelOpen) finRelRender();
  showToast('🏷️ Tag "' + tagName + '" removida');
}

function jogoSetSort(field) {
  if (jogoSort === field) { jogoSortAsc = !jogoSortAsc; }
  else { jogoSort = field; jogoSortAsc = false; }
  renderJogo();
}

// ══ FINANCEIRO — GRÁFICO DE ÁREA (Receitas vs Despesas) ══
function renderFinAreaChart() {
  var canvas = document.getElementById('fin-area-chart');
  if (!canvas || !canvas.parentElement) return;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = canvas.parentElement.clientWidth - 24;
  var H = 100;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var now = new Date();
  var monthData = [];
  for (var m = 5; m >= 0; m--) {
    var d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    var label = d.toLocaleDateString('pt-BR', {month:'short'}).replace('.','');
    var ent = 0, sai = 0;
    finances.forEach(function(f) {
      if (f.date && f.date.startsWith(key)) {
        if (f.type === 'entrada') ent += f.value;
        else if (f.type === 'saida') sai += f.value;
      }
    });
    monthData.push({label: label, ent: ent, sai: sai});
  }

  var maxV = 1;
  monthData.forEach(function(d) { maxV = Math.max(maxV, d.ent, d.sai); });
  maxV *= 1.15;

  var padL=36, padR=6, padT=8, padB=20;
  var plotW = W-padL-padR, plotH = H-padT-padB;

  // Grid
  [0, 0.5, 1].forEach(function(g) {
    var y = padT + plotH*(1-g);
    ctx.strokeStyle = 'rgba(42,42,56,.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(W-padR,y); ctx.stroke();
    ctx.fillStyle = '#4A4A68'; ctx.font = '8px Inter,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('R$' + Math.round(maxV*g/1000) + 'k', padL-3, y+3);
  });

  function getPoints(key) {
    return monthData.map(function(d, i) {
      return {x: padL + i*plotW/(monthData.length-1), y: padT + plotH*(1-d[key]/maxV)};
    });
  }

  function drawSmooth(ctx, pts, fillGrad, strokeColor) {
    // Área
    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, padT+plotH);
    ctx.lineTo(pts[0].x, pts[0].y);
    for (var i=0; i<pts.length-1; i++) {
      var cpx = (pts[i].x + pts[i+1].x)/2;
      ctx.bezierCurveTo(cpx, pts[i].y, cpx, pts[i+1].y, pts[i+1].x, pts[i+1].y);
    }
    ctx.lineTo(pts[pts.length-1].x, padT+plotH);
    ctx.closePath();
    ctx.fill();
    // Linha
    ctx.strokeStyle = strokeColor; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var j=0; j<pts.length-1; j++) {
      var cpx2 = (pts[j].x + pts[j+1].x)/2;
      ctx.bezierCurveTo(cpx2, pts[j].y, cpx2, pts[j+1].y, pts[j+1].x, pts[j+1].y);
    }
    ctx.stroke();
  }

  var gR = ctx.createLinearGradient(0,padT,0,padT+plotH);
  gR.addColorStop(0,'rgba(124,58,237,.5)'); gR.addColorStop(1,'rgba(124,58,237,.03)');
  drawSmooth(ctx, getPoints('ent'), gR, '#A78BFA');

  var gD = ctx.createLinearGradient(0,padT,0,padT+plotH);
  gD.addColorStop(0,'rgba(236,72,153,.4)'); gD.addColorStop(1,'rgba(236,72,153,.03)');
  drawSmooth(ctx, getPoints('sai'), gD, '#EC4899');

  monthData.forEach(function(d, i) {
    ctx.fillStyle = '#4A4A68'; ctx.font = '8px Inter,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.label, padL + i*plotW/(monthData.length-1), H-4);
  });
}

// ══ FINANCEIRO — TREEMAP DE CATEGORIAS ══
var tmPalette = [
  'rgba(124,58,237,.75)','rgba(6,182,212,.65)','rgba(124,58,237,.55)',
  'rgba(16,185,129,.6)','rgba(6,182,212,.45)','rgba(167,139,250,.6)',
  'rgba(245,158,11,.55)','rgba(16,185,129,.4)','rgba(124,58,237,.4)',
  'rgba(6,182,212,.35)','rgba(167,139,250,.4)','rgba(245,158,11,.4)',
  'rgba(16,185,129,.3)','rgba(124,58,237,.3)'
];

function renderFinTreemap(cats) {
  var panel = document.getElementById('fin-cats-panel');
  if (!panel || !cats || !cats.length) return;

  // Remove treemap anterior se existir
  var old = document.getElementById('fin-treemap-wrap');
  if (old) old.remove();

  // Insere o treemap no TOPO do panel (antes da lista de categorias)
  var wrap = document.createElement('div');
  wrap.id = 'fin-treemap-wrap';
  wrap.style.cssText = 'margin-bottom:14px';
  panel.insertBefore(wrap, panel.firstChild);

  var headerH = '';

  var W = panel.clientWidth || 250;
  if (W < 50) W = 250;
  var H = Math.max(220, Math.round(W * 0.65));

  // Squarify
  function sqLayout(items, rect, out) {
    if (!items.length) return;
    if (items.length === 1) { out.push({n:items[0][0],v:items[0][1],x:rect.x,y:rect.y,w:rect.w,h:rect.h}); return; }
    var total = 0; items.forEach(function(c){total+=c[1];});
    var hz = rect.w >= rect.h;
    var row = [], rSum = 0, best = 1e9;
    for (var i=0; i<items.length; i++) {
      var ns = rSum + items[i][1];
      var side = hz ? rect.h : rect.w;
      var frac = ns/total;
      var len = (hz ? rect.w : rect.h) * frac;
      var w = 0;
      var cands = row.concat([items[i]]);
      cands.forEach(function(c){ var f=c[1]/ns, d=side*f; var r=len>d?len/d:d/len; w=Math.max(w,r); });
      if (row.length && w > best) break;
      row.push(items[i]); rSum = ns; best = w;
    }
    var frac2 = rSum/total;
    var rLen = (hz ? rect.w : rect.h) * frac2;
    var cur = hz ? rect.y : rect.x;
    row.forEach(function(item) {
      var f = item[1]/rSum;
      var rw = hz ? rLen : rect.w*f;
      var rh = hz ? rect.h*f : rLen;
      out.push({n:item[0], v:item[1], x:hz?rect.x:cur, y:hz?cur:rect.y, w:rw, h:rh});
      cur += hz ? rh : rw;
    });
    var rem = items.slice(row.length);
    if (!rem.length) return;
    var nr = hz
      ? {x:rect.x+rLen, y:rect.y, w:rect.w-rLen, h:rect.h}
      : {x:rect.x, y:rect.y+rLen, w:rect.w, h:rect.h-rLen};
    sqLayout(rem, nr, out);
  }

  var sorted = cats.slice().sort(function(a,b){return b[1]-a[1];});
  var rects = [];
  sqLayout(sorted, {x:0,y:0,w:W,h:H}, rects);

  var html = headerH + '<div style="position:relative;width:'+W+'px;height:'+H+'px;border-radius:8px;overflow:hidden">';
  var GAP = 2;
  rects.forEach(function(r, i) {
    if (r.w < GAP*2 || r.h < GAP*2) return;
    var big = r.w > 120 && r.h > 60;
    var show = r.w > 50 && r.h > 32;
    html += '<div title="' + escHtml(r.n) + ': R$ ' + r.v.toLocaleString('pt-BR') + '" style="position:absolute;left:'+(r.x+GAP/2)+'px;top:'+(r.y+GAP/2)+'px;width:'+(r.w-GAP)+'px;height:'+(r.h-GAP)+'px;background:'+tmPalette[i%tmPalette.length]+';border-radius:5px;overflow:hidden;cursor:default" onmouseenter="this.style.filter=\'brightness(1.25)\'" onmouseleave="this.style.filter=\'\'">';
    if (show) {
      html += '<div style="position:absolute;inset:4px;display:flex;flex-direction:column;justify-content:flex-end;padding:4px">';
      html += '<div style="font-size:'+(big?11:9)+'px;font-weight:600;color:rgba(255,255,255,.9);line-height:1.2;word-break:break-word">' + escHtml(r.n) + '</div>';
      html += '<div style="font-size:'+(big?13:10)+'px;font-weight:800;color:#fff;margin-top:1px">R$ ' + r.v.toLocaleString('pt-BR') + '</div>';
      html += '</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  wrap.innerHTML = html;
}

// ══ IMPRESSÃO DO RELATÓRIO FINANCEIRO ══
function finRelImprimir(orientation) {
  orientation = orientation || 'landscape';
  var data = finRelFiltered();
  var sorted = data.slice().sort(function(a,b){
    var av = a[finRelSort], bv = b[finRelSort];
    if (typeof av === 'string') { av=av.toLowerCase(); bv=bv.toLowerCase(); }
    if (av==null) av=''; if (bv==null) bv='';
    return finRelAsc ? (av>bv?1:-1) : (av<bv?1:-1);
  });

  var totIn  = data.filter(function(f){return f.type==='entrada';}).reduce(function(s,f){return s+f.value;},0);
  var totOut = data.filter(function(f){return f.type==='saida';}).reduce(function(s,f){return s+f.value;},0);
  var bal    = totIn - totOut;

  // Resumo dos filtros ativos
  var filterParts = [];
  var ini = (document.getElementById('frel-ini')||{}).value;
  var fim = (document.getElementById('frel-fim')||{}).value;
  if (ini || fim) filterParts.push('Período: ' + (ini||'início') + ' → ' + (fim||'hoje'));
  var tipo = (document.getElementById('frel-tipo')||{}).value;
  if (tipo) filterParts.push('Tipo: ' + (tipo==='entrada'?'Entradas':'Saídas'));
  var cat = (document.getElementById('frel-cat')||{}).value;
  if (cat) filterParts.push('Categoria: ' + cat);
  var meth = (document.getElementById('frel-method')||{}).value;
  if (meth) filterParts.push('Forma: ' + meth);
  var tag = (document.getElementById('frel-tag')||{}).value;
  if (tag) filterParts.push('Tag: ' + tag);
  var obs = (document.getElementById('frel-obs')||{}).value;
  if (obs) filterParts.push('Busca: "' + obs + '"');

  var now = new Date().toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});

  var rows = sorted.map(function(f) {
    var dateF = f.date ? new Date(f.date+'T00:00:00').toLocaleDateString('pt-BR') : '—';
    var tags = (f.tags||[]).map(function(t){ return '<span class="tag">'+escHtml(t)+'</span>'; }).join(' ');
    var isEnt = f.type === 'entrada';
    var sinal = isEnt ? '+' : '-';
    return '<tr>' +
      '<td>' + dateF + '</td>' +
      '<td><strong>' + escHtml(f.desc) + '</strong>' + (f.source?'<br><span style="color:#888;font-size:9px">'+escHtml(f.source)+'</span>':'') + '</td>' +
      '<td class="' + (isEnt?'badge-in':'badge-out') + '">' + (isEnt?'Entrada':'Saída') + '</td>' +
      '<td>' + escHtml(f.category||'') + '</td>' +
      '<td>' + escHtml(f.method||'') + '</td>' +
      '<td class="' + (isEnt?'val-in':'val-out') + '" style="text-align:right;white-space:nowrap">' + sinal + 'R$ ' + fmtMoney(f.value) + '</td>' +
      '<td>' + (tags||'—') + '</td>' +
      '<td style="color:#888;font-size:9px">' + escHtml(f.obs||'—') + '</td>' +
    '</tr>';
  }).join('');

  var html =
    '<div id="print-header">' +
      '<div>' +
        '<h1>Relatório <span>Financeiro</span></h1>' +
        '<p>Gerado em ' + now + '</p>' +
      '</div>' +
      '<div id="print-header-badge">' + sorted.length + ' lançamento(s)</div>' +
    '</div>' +
    '<div id="print-kpis">' +
      '<div class="print-kpi"><div class="print-kpi-val">' + sorted.length + '</div><div class="print-kpi-lbl">Lançamentos</div></div>' +
      '<div class="print-kpi" style="border-top-color:#065f46"><div class="print-kpi-val" style="color:#065f46">R$ ' + fmtMoney(totIn) + '</div><div class="print-kpi-lbl">Total entradas</div></div>' +
      '<div class="print-kpi" style="border-top-color:#7f1d1d"><div class="print-kpi-val" style="color:#7f1d1d">R$ ' + fmtMoney(totOut) + '</div><div class="print-kpi-lbl">Total saídas</div></div>' +
      '<div class="print-kpi" style="border-top-color:' + (bal>=0?'#065f46':'#7f1d1d') + '"><div class="print-kpi-val" style="color:' + (bal>=0?'#065f46':'#7f1d1d') + '">' + (bal>=0?'+':'-') + 'R$ ' + fmtMoney(Math.abs(bal)) + '</div><div class="print-kpi-lbl">Saldo</div></div>' +
    '</div>' +
    (filterParts.length ? '<div id="print-filters"><strong>Filtros aplicados:</strong> ' + filterParts.join(' &nbsp;·&nbsp; ') + '</div>' : '') +
    '<table id="print-table">' +
      '<thead><tr>' +
        '<th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Forma</th><th style="text-align:right">Valor</th><th>Tags</th><th>Observação</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '<div id="print-totals">' +
      '<span>Entradas: <strong style="color:#065f46">R$ ' + fmtMoney(totIn) + '</strong></span>' +
      '<span>Saídas: <strong style="color:#7f1d1d">R$ ' + fmtMoney(totOut) + '</strong></span>' +
      '<span>Saldo: <strong style="color:' + (bal>=0?'#065f46':'#7f1d1d') + '">' + (bal>=0?'+':'-') + 'R$ ' + fmtMoney(Math.abs(bal)) + '</strong></span>' +
    '</div>' +
    '<div id="print-footer"><span>Flow — Gestão Pessoal</span><span>' + now + '</span></div>';

  var el = document.getElementById('print-relatorio');
  if (el) el.innerHTML = html;

  // Aplica orientação dinamicamente
  var styleEl = document.getElementById('print-orientation-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'print-orientation-style';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = '@media print { @page { size: A4 ' + orientation + '; } }';

  window.print();
}

function duplicateFinance(id) {
  var f = finances.find(function(x){ return x.id === id; });
  if (!f) return;

  // Abre o modal já preenchido com os dados do original
  resetFinModal();
  document.getElementById('fin-desc').value    = f.desc;
  document.getElementById('fin-value').value   = f.value;
  document.getElementById('fin-date').value    = todayLocal(); // data de hoje
  updateFinMethodSelects();
  document.getElementById('fin-method').value  = f.method  || '';
  document.getElementById('fin-source').value  = f.source  || '';
  document.getElementById('fin-obs').value     = f.obs     || '';
  document.getElementById('fin-type').value = f.type || 'saida';
  updateFinCategorySelects();
  updateFinType(); // adapta labels/visibilidade dos botões de status
  finSetStatus(f.status || 'pago'); // carrega status do lançamento
  document.getElementById('fin-category').value = f.category || '';

  // Carrega as tags e status do original
  var tw = document.getElementById('fin-tag-wrap');
  if (tw) (f.tags||[]).forEach(function(t){ finAddTagChip(t); });
  finSetStatus(f.status || 'pago');

  // Ajusta o título e o botão do modal
  document.querySelector('#modal-fin .modal-title').textContent = 'Duplicar Lançamento';
  var saveBtn = document.querySelector('#modal-fin .btn-primary');
  saveBtn.textContent = 'Salvar cópia';
  saveBtn.onclick = function() { saveFinance(); }; // sempre chama saveFinance (novo lançamento)

  openModal('modal-fin');
  setTimeout(finShowRecentTags, 100);
  showToast('⎘ Duplicando — ajuste o que precisar e salve');
}

// ══ PARCELAMENTO FINANCEIRO ══
var _fpOriginId    = null;  // ID do lançamento de origem (se convertendo)
var catPeriodo     = 1;     // Período do painel de categorias: 1=mês atual, 3, 6, 12, 0=tudo
var _fpValorParc   = null;  // Valor da parcela fixo no modo conversão

function openFinParcelado(originId) {
  _fpOriginId = originId || null;

  // Reseta o modal
  _fpValorParc = null;
  ['fp-desc','fp-total','fp-num','fp-valor','fp-obs'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) { el.value = ''; el.readOnly = false; el.style.opacity = ''; el.title = ''; }
  });
  document.getElementById('fp-inicio').value = '1';
  document.getElementById('fp-date').value   = todayLocal();
  document.getElementById('fp-preview').style.display = 'none';

  // Limpa tags
  var tw = document.getElementById('fp-tag-wrap');
  if (tw) { tw.querySelectorAll('.fin-tag-chip').forEach(function(ch){ch.remove();}); }

  // Popula selects de categoria e método
  fpPopulateSelects();

  // Origem
  var origemWrap = document.getElementById('fin-parc-origem-wrap');
  if (originId) {
    var f = finances.find(function(x){ return x.id === originId; });
    if (f && origemWrap) {
      origemWrap.style.display = 'block';
      document.getElementById('fin-parc-origem-desc').textContent = f.desc + ' — ' + fmtMoney(f.value);
      // Preenche com dados do lançamento
      document.getElementById('fp-desc').value   = f.desc;
      var valorParc = parseFloat(f.value);
      _fpValorParc = valorParc;
      document.getElementById('fp-valor').value    = valorParc.toFixed(2);
      document.getElementById('fp-valor').readOnly = true;
      document.getElementById('fp-valor').style.opacity = '0.7';
      document.getElementById('fp-valor').title = 'Valor da parcela fixo (do lançamento original)';
      document.getElementById('fp-total').value = ''; // garante vazio
      document.getElementById('fp-date').value   = f.date || todayLocal();
      document.getElementById('fp-obs').value    = f.obs || '';
      // Categoria e método
      fpPopulateSelects(f.category, f.method);
      // Tags
      (f.tags||[]).forEach(function(t){ fpAddTag(t); });
    }
  } else {
    if (origemWrap) origemWrap.style.display = 'none';
  }

  document.querySelector('#modal-fin-parcelado .modal-title').textContent =
    originId ? '⊞ Converter em Parcelamento' : '⊞ Novo Parcelamento';

  fpUpdatePreview();
  openModal('modal-fin-parcelado');
}

function openFinParceladoFromEdit() {
  // Pega o ID atual do lançamento sendo editado
  var editId = window._currentEditFinId || null;
  closeModal('modal-fin');
  setTimeout(function(){ openFinParcelado(editId); }, 200);
}

function fpPopulateSelects(selectedCat, selectedMethod) {
  var catSel = document.getElementById('fp-category');
  var methSel = document.getElementById('fp-method');
  if (!catSel || !methSel) return;

  // Categorias
  catSel.innerHTML = '<option value="">Selecione...</option>';
  (finCategories || []).forEach(function(cat) {
    var o = document.createElement('option');
    o.value = o.textContent = typeof cat === 'string' ? cat : (cat.label || cat.id || cat.name || '');
    catSel.appendChild(o);
  });
  if (selectedCat) catSel.value = selectedCat;

  // Formas de pagamento (coleta das existentes)
  var methods = {};
  finances.forEach(function(f){ if (f.method) methods[f.method] = 1; });
  methSel.innerHTML = '<option value="">Selecione...</option>';
  // Usa getPayMethods() para incluir formas customizadas
  getPayMethods().forEach(function(m) {
    var o = document.createElement('option');
    o.value = o.textContent = m;
    methSel.appendChild(o);
  });
  if (selectedMethod) methSel.value = selectedMethod;
}

function fpCalcParcela() {
  var num = parseInt(document.getElementById('fp-num').value) || 0;

  if (_fpValorParc !== null && num > 0) {
    // MODO CONVERSÃO: usa variável JS fixa, ignora campos HTML
    document.getElementById('fp-total').value = (_fpValorParc * num).toFixed(2);
    document.getElementById('fp-valor').value = _fpValorParc.toFixed(2); // reforça
  } else {
    // MODO NOVO: lê dos campos normalmente
    var totalStr = (document.getElementById('fp-total').value || '').replace(',','.');
    var valorStr = (document.getElementById('fp-valor').value || '').replace(',','.');
    var total = parseFloat(totalStr) || 0;
    var valor = parseFloat(valorStr) || 0;
    if (total > 0 && num > 0) {
      document.getElementById('fp-valor').value = (total / num).toFixed(2);
    } else if (valor > 0 && num > 0) {
      document.getElementById('fp-total').value = (valor * num).toFixed(2);
    }
  }
  fpUpdatePreview();
}

function fpCalcTotal() {
  var valor = parseFloat(document.getElementById('fp-valor').value) || 0;
  var num   = parseInt(document.getElementById('fp-num').value)     || 0;
  if (valor > 0 && num > 0) {
    document.getElementById('fp-total').value = (valor * num).toFixed(2);
  }
  fpUpdatePreview();
}

function fpGetDates() {
  var dateStr = document.getElementById('fp-date').value;
  var num     = parseInt(document.getElementById('fp-num').value)    || 0;
  var inicio  = parseInt(document.getElementById('fp-inicio').value) || 1;
  if (!dateStr || num < 1 || inicio < 1 || inicio > num) return [];

  var dates = [];
  var base  = new Date(dateStr + 'T00:00:00');
  var offset = inicio - 1; // parcelas anteriores já pagas
  var count  = num - inicio + 1; // quantas gerar

  for (var i = 0; i < count; i++) {
    var d = new Date(base.getFullYear(), base.getMonth() + i, base.getDate());
    dates.push({
      date: d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'),
      label: d.toLocaleDateString('pt-BR', {day:'2-digit', month:'short'}),
      parcNum: inicio + i,
      total: num
    });
  }
  return dates;
}

function fpUpdatePreview() {
  var dates   = fpGetDates();
  var preview = document.getElementById('fp-preview');
  var datesEl = document.getElementById('fp-preview-dates');
  var saveBtn = document.getElementById('fp-save-btn');

  if (!dates.length) {
    if (preview) preview.style.display = 'none';
    if (saveBtn) saveBtn.textContent = 'Gerar lançamentos';
    return;
  }

  if (preview) preview.style.display = 'block';
  if (saveBtn) saveBtn.textContent = 'Gerar ' + dates.length + ' lançamento(s)';

  if (datesEl) {
    datesEl.innerHTML = dates.map(function(d) {
      return '<span style="background:var(--violet-glow);border:1px solid rgba(124,58,237,.3);color:var(--violet-light);' +
        'font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px">' +
        d.parcNum + '/' + d.total + ' · ' + d.label + '</span>';
    }).join('');
  }
}

function fpTagKey(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    var val = e.target.value.replace(/,$/,'').trim();
    if (val) { fpAddTag(val); e.target.value = ''; }
  }
}
function fpTagBlur(inp) {
  setTimeout(function(){
    var val = (inp.value||'').trim();
    if (val) { fpAddTag(val); inp.value = ''; }
  }, 200);
}
function fpAddTag(txt) {
  var wrap = document.getElementById('fp-tag-wrap');
  var inp  = document.getElementById('fp-tag-inp');
  if (!wrap || !txt.trim()) return;
  var existing = Array.from(wrap.querySelectorAll('.fin-tag-chip')).map(function(c){ return c.dataset.tag; });
  if (existing.indexOf(txt.trim()) !== -1) return;
  var chip = document.createElement('span');
  chip.className = 'fin-tag-chip';
  chip.dataset.tag = txt.trim();
  chip.innerHTML = escHtml(txt.trim()) + ' <button class="fin-tag-rm" onclick="this.parentElement.remove()">✕</button>';
  wrap.insertBefore(chip, inp);
}
function fpGetTags() {
  var wrap = document.getElementById('fp-tag-wrap');
  if (!wrap) return [];
  return Array.from(wrap.querySelectorAll('.fin-tag-chip')).map(function(c){ return c.dataset.tag; });
}

function saveFinParcelado() {
  var desc     = (document.getElementById('fp-desc').value   || '').trim();
  var valor    = parseFloat(document.getElementById('fp-valor').value)  || 0;
  var category = document.getElementById('fp-category').value || '';
  var method   = document.getElementById('fp-method').value   || '';
  var obs      = (document.getElementById('fp-obs').value     || '').trim();
  var tags     = fpGetTags();
  var dates    = fpGetDates();

  if (!desc)         { showToast('⚠️ Informe a descrição'); return; }
  if (valor <= 0)    { showToast('⚠️ Informe o valor da parcela'); return; }
  if (!dates.length) { showToast('⚠️ Informe nº de parcelas e data'); return; }

  // Confirma tag digitada não fixada
  var inp = document.getElementById('fp-tag-inp');
  if (inp && inp.value.trim()) { fpAddTag(inp.value.trim()); inp.value = ''; }
  tags = fpGetTags();

  // Gera os lançamentos
  dates.forEach(function(d) {
    var label = desc + ' (' + d.parcNum + '/' + d.total + ')';
    finances.unshift({
      id: nextFinId++,
      desc: label,
      type: 'saida',
      value: valor,
      date: d.date,
      method: method,
      category: category,
      source: '',
      obs: obs,
      tags: tags.slice()
    });
  });

  // Remove o lançamento original se estiver convertendo
  if (_fpOriginId) {
    finances = finances.filter(function(f){ return f.id !== _fpOriginId; });
    _fpOriginId = null;
  }

  lsSave();
  scheduleSave();
  closeModal('modal-fin-parcelado');
  renderFinance();
  showToast('✅ ' + dates.length + ' lançamento(s) gerado(s)!');
}

// ══ STATUS DE LANÇAMENTO ══
function finSetStatus(status) {
  var inp = document.getElementById('fin-status');
  if (inp) inp.value = status || 'pago';
  document.querySelectorAll('.fin-status-opt').forEach(function(btn) {
    btn.classList.remove('active');
    if (btn.dataset.status === (status || 'pago')) btn.classList.add('active');
  });
}

function toggleFinStatus(id) {
  var f = finances.find(function(x){ return x.id === id; });
  if (!f) return;
  var cycle = f.type === 'entrada' ? ['pago','pendente'] : ['pago','pendente','parcela'];
  var cur   = cycle.indexOf(f.status || 'pago');
  if (cur === -1) cur = 0;
  f.status  = cycle[(cur + 1) % cycle.length];
  lsSave(); scheduleSave();
  renderFinance();
  if (finRelOpen) finRelRender();
  var label = f.type === 'entrada'
    ? (f.status === 'pendente' ? '⏳ A receber' : '✅ Recebido')
    : (f.status === 'pago' ? '✅ Pago' : f.status === 'pendente' ? '⏳ Pendente' : '📋 Parcela');
  showToast('Status: ' + label);
}

// ══ CATEGORIAS PADRÃO ══
function ensureDefaultCategories() {
  var needed = [
    {id:'Poupança/Reserva', label:'Poupança/Reserva', type:'saida'},
    {id:'Investimento',     label:'Investimento',     type:'saida'},
  ];
  needed.forEach(function(nc) {
    var exists = (finCategories||[]).some(function(c) {
      return (typeof c==='string'?c:c.id) === nc.id;
    });
    if (!exists) {
      finCategories = finCategories || [];
      finCategories.push(nc);
    }
  });
}

// ══ INDICADORES FINANCEIROS ══
var indOpen = true;

// Categorias consideradas essenciais (configurável via localStorage)
var indCatsEssenciais = JSON.parse(localStorage.getItem('painel_cats_essenciais') || 'null') || [
  'Alimentação/Mercado/Fruteira','Alimentação/Restaurante',
  'Concessionárias (Água/Luz/TV/Telefone)','Casa/Manut/Limpeza/Segurança',
  'Saúde','Transporte/UBER','PET','Estacionamento/Pedágio'
];

function indToggle() {
  indOpen = !indOpen;
  var body = document.getElementById('ind-body');
  var footer = document.getElementById('ind-footer');
  var lbl  = document.getElementById('ind-toggle-lbl');
  if (body) body.style.display = indOpen ? '' : 'none';
  if (footer) footer.style.display = indOpen ? '' : 'none';
  if (lbl) lbl.textContent = indOpen ? '▲' : '▼';
}

function indCard(icon, nome, pct, val, metaLow, metaHigh, detalhe, hint, status) {
  var cor = status === 'ok' ? 'var(--green)' : status === 'warn' ? 'var(--amber)' : 'var(--red)';
  var statusLabel = status === 'ok' ? '✅ Saudável' : status === 'warn' ? '⚠️ Atenção' : '❌ Crítico';
  var statusCls   = status === 'ok' ? 'ind-ok' : status === 'warn' ? 'ind-warn' : 'ind-bad';
  var barW = Math.min(pct, 100).toFixed(1);
  // Zona ideal: de metaLow% a metaHigh%
  var zoneLeft  = metaLow.toFixed(1);
  var zoneWidth = (metaHigh - metaLow).toFixed(1);
  return '<div class="ind-card-top">' +
    '<div class="ind-nome">' + nome + '</div>' +
    '<div class="ind-icon">' + icon + '</div>' +
  '</div>' +
  '<div class="ind-val" style="color:' + cor + '">' + pct.toFixed(1).replace('.',',') + '%</div>' +
  '<div class="ind-meta">' + detalhe + '</div>' +
  '<div class="ind-bar-wrap">' +
    '<div class="ind-bar-zone" style="left:' + zoneLeft + '%;width:' + zoneWidth + '%"></div>' +
    '<div class="ind-bar" style="width:' + barW + '%;background:' + cor + '"></div>' +
  '</div>' +
  '<div class="ind-legenda"><span>0%</span><span style="color:var(--green)">meta ' +
    (metaLow > 0 ? metaLow + '–' : '&lt;') + metaHigh + '%</span><span>100%</span></div>' +
  '<div class="ind-detalhe">' +
    '<div class="ind-detalhe-row"><span>' + detalhe + '</span><strong>' + fmtMoney(val) + '</strong></div>' +
    '<div class="ind-hint">' + hint + '</div>' +
  '</div>' +
  '<span class="ind-status ' + statusCls + '">' + statusLabel + '</span>';
}

function renderIndicadores() {
  // Usa o mês do calendário financeiro (sincronizado com finCalNav)
  var ano = typeof finCalYear  !== 'undefined' ? finCalYear  : new Date().getFullYear();
  var mes_num = typeof finCalMonth !== 'undefined' ? finCalMonth : new Date().getMonth();
  var mes = ano + '-' + String(mes_num + 1).padStart(2,'0');
  var mesFin = finances.filter(function(f){ return f.date && f.date.startsWith(mes); });
  var entradas = mesFin.filter(function(f){ return f.type === 'entrada'; });
  var saidas   = mesFin.filter(function(f){ return f.type === 'saida'; });
  var renda    = entradas.reduce(function(s,f){ return s+f.value; }, 0);
  var totalS   = saidas.reduce(function(s,f){ return s+f.value; }, 0);

  // Label do mês
  var meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var lbl = document.getElementById('ind-mes-label');
  if (lbl) lbl.textContent = meses[mes_num] + '/' + ano;

  if (renda === 0) {
    // Sem renda lançada — aviso
    ['ind-card-divida','ind-card-poupanca','ind-card-custo'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '<div style="font-size:10px;color:var(--dim);padding:8px 0">⚠️ Lance receitas do mês para calcular os indicadores</div>';
    });
    return;
  }

  // 1. Taxa de Endividamento — saídas com status 'parcela'
  var parcelas = saidas.filter(function(f){ return f.status === 'parcela'; });
  var valParcelas = parcelas.reduce(function(s,f){ return s+f.value; }, 0);
  var pctDivida = valParcelas / renda * 100;
  var statusDivida = pctDivida <= 20 ? 'ok' : pctDivida <= 35 ? 'warn' : 'bad';
  var hintDivida = parcelas.length === 0
    ? '💡 Marque lançamentos como "📋 Parcela" para calcular'
    : '📋 ' + parcelas.length + ' lançamento(s) marcados como parcela';

  var elD = document.getElementById('ind-card-divida');
  if (elD) elD.innerHTML = indCard('💳','Taxa de<br>Endividamento',
    pctDivida, valParcelas, 0, 20, 'parcelas do mês', hintDivida, statusDivida);

  // 2. Taxa de Poupança — saídas em Poupança/Reserva ou Investimento
  var poupSaidas = saidas.filter(function(f){
    return f.category === 'Poupança/Reserva' || f.category === 'Investimento';
  });
  var valPoup = poupSaidas.reduce(function(s,f){ return s+f.value; }, 0);
  var pctPoup = valPoup / renda * 100;
  var statusPoup = pctPoup >= 20 ? 'ok' : pctPoup >= 10 ? 'warn' : 'bad';
  var hintPoup = valPoup === 0
    ? '💡 Lance em "Poupança/Reserva" ou "Investimento"'
    : '💚 ' + poupSaidas.length + ' lançamento(s) de poupança/investimento';

  var elP = document.getElementById('ind-card-poupanca');
  if (elP) elP.innerHTML = indCard('💚','Taxa de<br>Poupança',
    pctPoup, valPoup, 10, 20, 'poupança/investimento', hintPoup, statusPoup);

  // 3. Custo de Vida Essencial
  var essenc = saidas.filter(function(f){ return indCatsEssenciais.indexOf(f.category) !== -1; });
  var valEss = essenc.reduce(function(s,f){ return s+f.value; }, 0);
  var pctEss = valEss / renda * 100;
  var statusEss = pctEss <= 50 ? 'ok' : pctEss <= 60 ? 'warn' : 'bad';
  var hintEss = '🏠 ' + essenc.length + ' lançamentos em ' + indCatsEssenciais.length + ' categorias essenciais';

  var elC = document.getElementById('ind-card-custo');
  if (elC) elC.innerHTML = indCard('🏠','Custo de Vida<br>Essencial',
    pctEss, valEss, 0, 60, 'gastos essenciais', hintEss, statusEss);

  // Footer com botão de configuração
  var footer = document.getElementById('ind-footer');
  if (footer) {
    footer.innerHTML = '<span>🏠 Essenciais:</span>' +
      indCatsEssenciais.map(function(c){ return '<span style="color:var(--muted)">'+escHtml(c)+'</span>'; }).join('<span style="color:var(--dim)">&nbsp;·&nbsp;</span>') +
      '<button onclick="openCatsEssenciais()" style="margin-left:auto;font-size:9px;padding:2px 8px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--muted);cursor:pointer">⚙️ configurar</button>';
  }
}

// ══ FASE 3 — COMPROMISSOS E LINHA DO TEMPO ══
var compOpen = true;
var tlOpen   = true;
var MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var MESES_CURTO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function compToggle() {
  compOpen = !compOpen;
  var el = document.getElementById('comp-body');
  var lbl = document.getElementById('comp-toggle-lbl');
  if (el)  el.style.display  = compOpen ? '' : 'none';
  if (lbl) lbl.textContent   = compOpen ? '▲' : '▼';
}

function tlToggle() {
  tlOpen = !tlOpen;
  var el  = document.getElementById('tl-body');
  var lbl = document.getElementById('tl-toggle-lbl');
  if (el)  el.style.display  = tlOpen ? '' : 'none';
  if (lbl) lbl.textContent   = tlOpen ? '▲' : '▼';
}

function renderCompromissos() {
  var hoje = new Date();
  var hojeStr = todayLocal();
  var fim30 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 30);
  var fim30Str = fim30.getFullYear() + '-' +
    String(fim30.getMonth()+1).padStart(2,'0') + '-' +
    String(fim30.getDate()).padStart(2,'0');

  var pending = finances.filter(function(f) {
    if (f.type !== 'saida') return false;
    if (f.status === 'pago') return false;
    var dataRef = f.due_date || f.date || '';
    return dataRef >= hojeStr && dataRef <= fim30Str;
  }).sort(function(a,b){
    var da = a.due_date||a.date||'', db = b.due_date||b.date||'';
    return da < db ? -1 : 1;
  });

  var total = pending.reduce(function(s,f){ return s+f.value; }, 0);

  // Badge
  var badge = document.getElementById('comp-badge');
  if (badge) {
    if (pending.length === 0) {
      badge.textContent = 'nenhum compromisso';
      badge.style.background = 'rgba(16,185,129,.15)';
      badge.style.color = 'var(--green)';
      badge.style.borderColor = 'rgba(16,185,129,.3)';
    } else {
      badge.textContent = pending.length + ' saídas · ' + fmtMoney(total);
      badge.style.background = '';
      badge.style.color = '';
      badge.style.borderColor = '';
    }
  }

  var list = document.getElementById('comp-list');
  if (!list) return;

  if (pending.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:14px;color:var(--dim);font-size:12px">✅ Nenhuma saída nos próximos 30 dias</div>';
    var totEl = document.getElementById('comp-total');
    if (totEl) totEl.innerHTML = '';
    renderFinNavBadge(0, 0);
    return;
  }

  // Agrupa por forma de pagamento
  var grupos = {};
  pending.forEach(function(f) {
    var m = f.method || 'Outro';
    if (!grupos[m]) grupos[m] = [];
    grupos[m].push(f);
  });

  // Ordena grupos por total decrescente
  var gruposArr = Object.keys(grupos).map(function(m) {
    var items = grupos[m];
    var tot = items.reduce(function(s,f){ return s+f.value; }, 0);
    return {method: m, items: items, total: tot};
  }).sort(function(a,b){ return b.total - a.total; });

  var fmtDt = function(f) {
    var ref = f.due_date || f.date || '';
    if (!ref) return '—';
    var d = new Date(ref+'T12:00:00');
    return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
  };

  var urgCls = function(f) {
    var ref = f.due_date || f.date || '';
    if (!ref) return '';
    var diff = Math.round((new Date(ref+'T12:00:00') - new Date()) / 86400000);
    return diff <= 3 ? 'color:var(--red);font-weight:700' : diff <= 7 ? 'color:var(--amber)' : 'color:var(--muted)';
  };

  var stBadge = function(f) {
    if (f.status==='parcela')  return '<span style="font-size:8px;padding:1px 5px;border-radius:4px;background:rgba(6,182,212,.12);color:var(--cyan);border:1px solid rgba(6,182,212,.25)">📋 Parcela</span>';
    if (f.status==='pendente') return '<span style="font-size:8px;padding:1px 5px;border-radius:4px;background:rgba(245,158,11,.12);color:var(--amber);border:1px solid rgba(245,158,11,.3)">⏳ Pendente</span>';
    return '';
  };

  list.innerHTML = gruposArr.map(function(g, gi) {
    var itemsHtml = g.items.map(function(f) {
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 12px 6px 28px;border-top:1px solid var(--border-soft);cursor:pointer" onclick="editFinance('+f.id+')">' +
        '<span style="font-size:10px;'+urgCls(f)+';min-width:44px">'+fmtDt(f)+'</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:11px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(f.desc)+'</div>' +
          '<div style="font-size:9px;color:var(--muted)">'+escHtml(f.category||'')+'</div>' +
        '</div>' +
        stBadge(f) +
        '<span style="font-size:11px;font-weight:800;color:var(--red);white-space:nowrap">-'+fmtMoney(f.value)+'</span>' +
      '</div>';
    }).join('');

    return '<div>' +
      '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;transition:background .12s" ' +
        'onclick="compToggleGroup('+gi+')" id="comp-group-'+gi+'">' +
        '<span style="font-size:13px">💳</span>' +
        '<span style="flex:1;font-size:12px;font-weight:700;color:var(--text)">'+escHtml(g.method)+'</span>' +
        '<span style="font-size:10px;color:var(--muted);margin-right:6px">'+g.items.length+' lançamento'+(g.items.length>1?'s':'')+'</span>' +
        '<span style="font-size:12px;font-weight:800;color:var(--red)">-'+fmtMoney(g.total)+'</span>' +
        '<span style="font-size:10px;color:var(--dim);margin-left:6px" id="comp-arrow-'+gi+'">▼</span>' +
      '</div>' +
      '<div id="comp-items-'+gi+'" style="display:none">'+itemsHtml+'</div>' +
    '</div>';
  }).join('');

  // Total rodapé
  var totEl = document.getElementById('comp-total');
  if (totEl) totEl.innerHTML = '<span>Total comprometido em 30 dias</span><strong>-'+fmtMoney(total)+'</strong>';

  renderFinNavBadge(pending.length, total);
}

function compToggleGroup(gi) {
  var items = document.getElementById('comp-items-'+gi);
  var arrow = document.getElementById('comp-arrow-'+gi);
  if (!items) return;
  var open = items.style.display !== 'none';
  items.style.display = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▼' : '▲';
}


function renderFinNavBadge(count, total) {
  // Procura o botão de navegação do Financeiro
  var navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(function(btn) {
    if (btn.title && btn.title.toLowerCase().includes('financeiro')) {
      var existing = btn.querySelector('.fin-nav-badge');
      if (existing) existing.remove();
      if (count > 0) {
        var badge = document.createElement('span');
        badge.className = 'fin-nav-badge';
        badge.textContent = fmtMoney(total);
        btn.appendChild(badge);
      }
    }
  });
}


// Calcula total de entradas projetadas para um mês (YYYY-MM)
// Considera: lançamentos cadastrados + a receber (due_date) + recorrentes
function tlEntradas(mesKey) {
  // 1. Lançamentos de entrada já cadastrados (recebidos ou a receber)
  var lancamentos = finances.filter(function(f) {
    if (f.type !== 'entrada') return false;
    // A receber com due_date: usa due_date
    var ref = (f.status === 'pendente' && f.due_date) ? f.due_date : f.date;
    return ref && ref.startsWith(mesKey);
  }).reduce(function(s,f){ return s+f.value; }, 0);

  // 2. Receitas recorrentes projetadas (apenas meses futuros não lançados)
  var ano = parseInt(mesKey.split('-')[0]);
  var mes = parseInt(mesKey.split('-')[1]); // 1-12
  var recorTotal = 0;
  (typeof recorrentes !== 'undefined' ? recorrentes : []).forEach(function(r) {
    // Verifica se já foi lançada neste mês
    var jaLancada = finances.some(function(f) {
      return f.type === 'entrada' &&
             f.date && f.date.startsWith(mesKey) &&
             f.desc === r.desc &&
             Math.abs(f.value - r.valor) < 0.01;
    });
    if (!jaLancada) recorTotal += r.valor;
  });

  return lancamentos + recorTotal;
}
function renderTimeline() {
  var grid   = document.getElementById('tl-grid');
  var defEl  = document.getElementById('tl-deficit');
  if (!grid) return;

  var hoje = new Date();
  var meses = [];
  for (var i = 0; i < 6; i++) {
    var d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    meses.push({
      ano: d.getFullYear(),
      mes: d.getMonth(),
      key: d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'),
      label: MESES_PT[d.getMonth()] + ' ' + d.getFullYear(),
      atual: i === 0
    });
  }

  // Calcula max para escala das barras
  var maxVal = 1;
  meses.forEach(function(m) {
    var e = tlEntradas(m.key);
    var s = finances.filter(function(f){
      if (f.type !== 'saida') return false;
      var ref = (f.status === 'pendente' && f.due_date) ? f.due_date : f.date;
      return ref && ref.startsWith(m.key);
    }).reduce(function(s,f){return s+f.value;},0);
    maxVal = Math.max(maxVal, e, s);
  });

  var acumuladoDeficit = 0;

  grid.innerHTML = meses.map(function(m) {
    var entradas = tlEntradas(m.key);
    var saidas = finances.filter(function(f){
      if (f.type !== 'saida') return false;
      // Pendentes usam due_date se tiver, senão date
      var ref = (f.status === 'pendente' && f.due_date) ? f.due_date : f.date;
      return ref && ref.startsWith(m.key);
    }).reduce(function(s,f){return s+f.value;},0);
    var saldo    = entradas - saidas;

    if (!m.atual && saldo < 0) acumuladoDeficit += saldo;

    var saldoCor = saldo >= 0 ? 'var(--green)' : 'var(--red)';
    var barE = (entradas / maxVal * 100).toFixed(1);
    var barS = (saidas   / maxVal * 100).toFixed(1);

    var aviso = '';
    if (entradas === 0 && saidas > 0) {
      aviso = '<div class="tl-aviso sem-receita">⚠️ Sem receitas lançadas — adicione salário/honorários</div>';
    } else if (saldo < 0) {
      aviso = '<div class="tl-aviso deficit">❌ Deficit de '+fmtMoney(Math.abs(saldo))+'</div>';
    } else if (entradas > 0) {
      aviso = '<div class="tl-aviso ok">✅ Mês equilibrado</div>';
    }

    var saldoStr = (saldo >= 0 ? '+' : '') + fmtMoney(Math.abs(saldo));

    return '<div class="tl-mes'+(m.atual?' atual':'')+'">'+
      '<div class="tl-mes-header">'+
        '<span class="tl-mes-label">'+m.label+(m.atual?' <span style="font-size:9px;color:var(--violet-light);font-weight:400">● atual</span>':'')+'</span>'+
        '<span class="tl-mes-saldo" style="color:'+saldoCor+'">'+(saldo>=0?'+':'-')+fmtMoney(Math.abs(saldo))+'</span>'+
      '</div>'+
      '<div class="tl-bars">'+
        '<div class="tl-bar-wrap">'+
          '<div class="tl-bar-label"><span style="color:var(--green)">↑ Entradas</span><span>'+fmtMoney(entradas)+'</span></div>'+
          '<div class="tl-bar-bg"><div class="tl-bar-fill" style="width:'+barE+'%;background:var(--green)"></div></div>'+
        '</div>'+
        '<div class="tl-bar-wrap">'+
          '<div class="tl-bar-label"><span style="color:var(--red)">↓ Saídas</span><span>'+fmtMoney(saidas)+'</span></div>'+
          '<div class="tl-bar-bg"><div class="tl-bar-fill" style="width:'+barS+'%;background:var(--red)"></div></div>'+
        '</div>'+
      '</div>'+
      aviso+
    '</div>';
  }).join('');

  // Acumulado de deficit
  if (defEl) {
    if (acumuladoDeficit < 0) {
      defEl.innerHTML = '<div class="tl-deficit"><strong>⚠️ Déficit acumulado projetado (próx. 5 meses): -'+fmtMoney(Math.abs(acumuladoDeficit))+'</strong><br>'+
        '<span style="color:var(--muted)">Baseado apenas nos lançamentos já cadastrados. Lance as receitas futuras para ver o cenário real.</span></div>';
    } else {
      defEl.innerHTML = '';
    }
  }
}

// ══ FASE 4 — RECEITAS RECORRENTES ══
var recorrentes = JSON.parse(localStorage.getItem('painel_recorrentes') || '[]');

function saveRecorrentes() {
  localStorage.setItem('painel_recorrentes', JSON.stringify(recorrentes));
}

function openRecorrentes() {
  // Popula select de método
  var methSel = document.getElementById('recor-method');
  if (methSel) {
    methSel.innerHTML = '';
    getPayMethods().forEach(function(m) {
      var o = document.createElement('option');
      o.value = o.textContent = m;
      methSel.appendChild(o);
    });
  }
  renderRecorLista();
  openModal('modal-recorrentes');
}

function renderRecorLista() {
  var el = document.getElementById('recor-lista');
  if (!el) return;
  if (!recorrentes.length) {
    el.innerHTML = '<div class="recor-empty">Nenhum lançamento recorrente cadastrado</div>';
    return;
  }
  el.innerHTML = recorrentes.map(function(r, i) {
    return '<div class="recor-item">' +
      '<div class="recor-item-info">' +
        '<div class="recor-item-desc">'+escHtml(r.desc)+'</div>' +
        '<div class="recor-item-sub">'+(r.tipo==='saida'?'📤':'📥')+' Todo dia '+r.dia+' · '+escHtml(r.category)+' · '+escHtml(r.method)+'</div>' +
      '</div>' +
      '<button class="btn-lembrete'+(r.lembrete?' ativo':'')+'" onclick="toggleLembreteRecor('+i+')" title="'+(r.lembrete?'Lembrete ativo':'Ativar lembrete')+'">🔔</button>' +
      '<span class="recor-item-val">+'+fmtMoney(r.valor)+'</span>' +
      '<div class="recor-item-acts">' +
        '<button class="btn btn-ghost btn-sm" style="padding:3px 6px;font-size:10px" onclick="lancarRecorrente('+i+')">↓ Lançar</button>' +
        '<button class="btn btn-ghost btn-sm" style="padding:3px 6px;font-size:10px;color:var(--red)" onclick="excluirRecorrente('+i+')">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function salvarRecorrente() {
  var tipo  = (document.getElementById('recor-tipo') || {}).value || 'entrada';
  var desc  = (document.getElementById('recor-desc').value || '').trim();
  var valor = parseFloat(document.getElementById('recor-valor').value) || 0;
  var dia   = parseInt(document.getElementById('recor-dia').value) || 0;
  var cat   = document.getElementById('recor-category').value || (tipo==='entrada'?'Renda fixa':'Outros');
  var meth  = document.getElementById('recor-method').value || 'TED';

  if (!desc)         { showToast('⚠️ Informe a descrição'); return; }
  if (valor <= 0)    { showToast('⚠️ Informe o valor'); return; }
  if (dia < 1 || dia > 31) { showToast('⚠️ Dia inválido (1–31)'); return; }

  recorrentes.push({id: Date.now(), desc, valor, dia, category: cat, method: meth, tipo: tipo});
  saveRecorrentes();

  // Limpa campos
  ['recor-desc','recor-valor','recor-dia'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.value = '';
  });

  renderRecorLista();
  showToast('✅ ' + (tipo==='entrada'?'Receita':'Despesa') + ' recorrente cadastrada!');
}

function excluirRecorrente(idx) {
  if (!confirm('Excluir "' + recorrentes[idx].desc + '"?')) return;
  recorrentes.splice(idx, 1);
  saveRecorrentes();
  renderRecorLista();
}

function lancarRecorrente(idx) {
  var r = recorrentes[idx];
  if (!r) return;
  // Monta data com o dia da recorrente no mês atual
  var now = new Date();
  var dia = String(r.dia).padStart(2,'0');
  var mes = String(now.getMonth()+1).padStart(2,'0');
  var ano = now.getFullYear();
  // Se o dia já passou no mês, lança no mês atual mesmo
  var dateStr = ano + '-' + mes + '-' + dia;

  var tipo = r.tipo || 'entrada';
  var novoLanc = {
    id: nextFinId++,
    desc: r.desc,
    type: tipo,
    value: r.valor,
    date: dateStr,
    method: r.method,
    category: r.category,
    source: '',
    obs: 'Lançamento automático — ' + (tipo==='entrada'?'receita':'despesa') + ' recorrente',
    tags: [],
    status: tipo==='entrada' ? 'pago' : 'pendente'
  };
  if (tipo === 'saida') applyCartaoDueDate(novoLanc);
  finances.unshift(novoLanc);
  lsSave();
  scheduleSave();
  renderFinance();
  closeModal('modal-recorrentes');
  showToast((tipo==='entrada'?'✅ ':'📤 ') + r.desc + ' lançado: ' + (tipo==='entrada'?'+':'-') + fmtMoney(r.valor));
}

// Sugestão de lançar receitas recorrentes no início do mês
function checkRecorrentesDoMes() {
  if (!recorrentes.length) return;
  var now = new Date();
  var mes = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  var sugestoes = [];

  recorrentes.forEach(function(r) {
    // Verifica se já foi lançada este mês
    var jaLancada = finances.some(function(f) {
      return f.date && f.date.startsWith(mes) &&
             f.type === 'entrada' &&
             f.desc === r.desc &&
             Math.abs(f.value - r.valor) < 0.01;
    });
    if (!jaLancada) sugestoes.push(r);
  });

  if (!sugestoes.length) return;

  // Mostra sugestão apenas se estivermos nos primeiros 10 dias do mês
  if (now.getDate() > 10) return;

  var nomes = sugestoes.map(function(r){ return r.desc; }).join(', ');
  var total = sugestoes.reduce(function(s,r){ return s+r.valor; }, 0);
  showToast('💚 Lançar receitas do mês? ' + nomes + ' (' + fmtMoney(total) + ') — acesse ↻ Recorrentes');
}

// Inclui recorrentes no lsSave/lsLoad/Firebase

// ══ GRÁFICOS FINANCEIROS ══

function finSetupCanvas(id, H) {
  var canvas = document.getElementById(id);
  if (!canvas || !canvas.parentElement) return null;
  if (canvas.offsetParent === null) return null; // invisível: pula render (economiza GPU)
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = canvas.parentElement.clientWidth - 28;
  if (W < 50) W = 200;
  canvas.width  = W * dpr; canvas.height = H * dpr;
  canvas.style.width  = W + 'px'; canvas.style.height = H + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return {ctx: ctx, W: W, H: H};
}

function finGetMonthData(n) {
  var now = new Date();
  var months = [];
  for (var i = n-1; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    var label = d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','');
    var fin = finances.filter(function(f){ return f.date && f.date.startsWith(key); });
    var ent = fin.filter(function(f){return f.type==='entrada';}).reduce(function(s,f){return s+f.value;},0);
    var sai = fin.filter(function(f){return f.type==='saida';}).reduce(function(s,f){return s+f.value;},0);
    months.push({key:key, label:label, ent:ent, sai:sai});
  }
  return months;
}

// ① Receitas vs Despesas — área suavizada
function renderFinAreaChart() {
  var r = finSetupCanvas('fin-area-chart', 250);
  if (!r) return;
  var ctx=r.ctx, W=r.W, H=r.H;
  var months = finGetMonthData(6);
  // Usa média dos valores não-zero + 30% para evitar distorção por outliers
  var allVals = [];
  months.forEach(function(m){ if(m.ent>0) allVals.push(m.ent); if(m.sai>0) allVals.push(m.sai); });
  var maxV = 1;
  if (allVals.length) {
    allVals.sort(function(a,b){return a-b;});
    // Usa o percentil 80 como teto (descarta o maior valor se for outlier)
    var p80idx = Math.min(Math.floor(allVals.length * 0.8), allVals.length-1);
    maxV = Math.max(allVals[p80idx] * 1.3, allVals[allVals.length-1] * 0.7);
    maxV = Math.max(maxV, 1);
  }
  var pL=40,pR=6,pT=10,pB=22,pw=W-pL-pR,ph=H-pT-pB;

  // Grid
  [0,.5,1].forEach(function(g){
    var y=pT+ph*(1-g);
    ctx.strokeStyle='rgba(42,42,56,.6)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(W-pR,y);ctx.stroke();
    ctx.fillStyle='#4A4A68';ctx.font='8px Inter,sans-serif';ctx.textAlign='right';
    ctx.fillText('R$'+Math.round(maxV*g/1000)+'k',pL-3,y+3);
  });
  months.forEach(function(m,i){
    ctx.fillStyle='#4A4A68';ctx.font='8px Inter,sans-serif';ctx.textAlign='center';
    ctx.fillText(m.label,pL+i*pw/(months.length-1),H-4);
  });

  function getPts(key){
    return months.map(function(m,i){
      return {x:pL+i*pw/(months.length-1),y:pT+ph*(1-m[key]/maxV)};
    });
  }
  function drawSmooth(pts,fillGrad,strokeCol){
    ctx.fillStyle=fillGrad;ctx.beginPath();
    ctx.moveTo(pts[0].x,pT+ph);ctx.lineTo(pts[0].x,pts[0].y);
    for(var i=0;i<pts.length-1;i++){var cx=(pts[i].x+pts[i+1].x)/2;ctx.bezierCurveTo(cx,pts[i].y,cx,pts[i+1].y,pts[i+1].x,pts[i+1].y);}
    ctx.lineTo(pts[pts.length-1].x,pT+ph);ctx.closePath();ctx.fill();
    ctx.strokeStyle=strokeCol;ctx.lineWidth=2;ctx.lineJoin='round';ctx.lineCap='round';
    ctx.beginPath();pts.forEach(function(p,i){i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();
  }
  var gR=ctx.createLinearGradient(0,pT,0,pT+ph);gR.addColorStop(0,'rgba(124,58,237,.5)');gR.addColorStop(1,'rgba(124,58,237,.03)');
  drawSmooth(getPts('ent'),gR,'#A78BFA');
  var gD=ctx.createLinearGradient(0,pT,0,pT+ph);gD.addColorStop(0,'rgba(236,72,153,.4)');gD.addColorStop(1,'rgba(236,72,153,.03)');
  drawSmooth(getPts('sai'),gD,'#EC4899');

  // Pontos e valores nos últimos e maiores
  function drawPoints(key, color) {
    var pts = getPts(key);
    pts.forEach(function(p,i) {
      var val = months[i][key];
      if (val === 0) return;
      // Ponto
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI*2); ctx.fill();
      // Valor acima do ponto
      var lbl = val>=1000 ? 'R$'+Math.round(val/1000)+'k' : 'R$'+Math.round(val);
      ctx.fillStyle = color;
      ctx.font = 'bold 8px Inter,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lbl, p.x, p.y - 7);
    });
  }
  drawPoints('ent','#A78BFA');
  drawPoints('sai','#EC4899');
}

// ② Saídas por categoria — barras horizontais
function renderFinCatChart() {
  var now = new Date();
  var mes = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  // Usa o mês do calendário
  if (typeof finCalYear !== 'undefined') {
    mes = finCalYear+'-'+String(finCalMonth+1).padStart(2,'0');
  }
  var saidas = finances.filter(function(f){return f.type==='saida'&&f.date&&f.date.startsWith(mes);});
  var catMap = {};
  saidas.forEach(function(f){catMap[f.category||'?']=(catMap[f.category||'?']||0)+f.value;});
  var cats = Object.entries(catMap).sort(function(a,b){return b[1]-a[1];}).slice(0,7);
  if (!cats.length) return;

  var rows = cats.length;
  var barH = 22, gap = 7;
  var H = rows*(barH+gap)+10;
  var r = finSetupCanvas('fin-cat-chart', H);
  if (!r) return;
  var ctx=r.ctx, W=r.W;
  var pL=115, pR=55;
  var maxC = cats[0][1];

  var palette = ['rgba(124,58,237,.85)','rgba(6,182,212,.8)','rgba(16,185,129,.75)',
    'rgba(245,158,11,.8)','rgba(167,139,250,.8)','rgba(6,182,212,.6)','rgba(124,58,237,.6)'];

  cats.forEach(function(cat,i){
    var y=8+i*(barH+gap);
    var w=(cat[1]/maxC)*(W-pL-pR);
    ctx.fillStyle='rgba(42,42,56,.5)';
    ctx.beginPath();ctx.roundRect(pL,y,W-pL-pR,barH,3);ctx.fill();
    ctx.fillStyle=palette[i%palette.length];
    ctx.beginPath();ctx.roundRect(pL,y,w,barH,3);ctx.fill();
    var nome=cat[0].length>18?cat[0].substring(0,17)+'…':cat[0];
    ctx.fillStyle='#9090B0';ctx.font='9px Inter,sans-serif';ctx.textAlign='right';
    ctx.fillText(nome,pL-5,y+barH/2+3);
    ctx.fillStyle='#E4E4F0';ctx.font='bold 9px Inter,sans-serif';ctx.textAlign='left';
    ctx.fillText('R$'+cat[1].toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0}),pL+w+5,y+barH/2+3);
  });
}

// ③ Saldo acumulado — linha
function renderFinSaldoChart() {
  var months = finGetMonthData(6);
  var acum = 0;
  var saldos = months.map(function(m){ acum += m.ent - m.sai; return acum; });
  var minS=Math.min.apply(null,saldos), maxS=Math.max.apply(null,saldos);
  var range=maxS-minS||1;

  var r = finSetupCanvas('fin-saldo-chart', 120);
  if (!r) return;
  var ctx=r.ctx, W=r.W, H=r.H;
  var pL=50,pR=8,pT=16,pB=22,pw=W-pL-pR,ph=H-pT-pB;

  // Zero line
  var zY=pT+ph*(1-(0-minS)/range);
  if(zY>pT&&zY<pT+ph){
    ctx.strokeStyle='rgba(239,68,68,.3)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
    ctx.beginPath();ctx.moveTo(pL,zY);ctx.lineTo(W-pR,zY);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='rgba(239,68,68,.6)';ctx.font='8px Inter,sans-serif';ctx.textAlign='right';
    ctx.fillText('0',pL-3,zY+3);
  }

  var pts=saldos.map(function(s,i){return {x:pL+i*pw/(saldos.length-1),y:pT+ph*(1-(s-minS)/range)};});
  var isPositive=saldos[saldos.length-1]>=0;
  var mainColor=isPositive?'var(--green)':'var(--red)';

  var grad=ctx.createLinearGradient(0,pT,0,pT+ph);
  grad.addColorStop(0,isPositive?'rgba(16,185,129,.35)':'rgba(239,68,68,.3)');
  grad.addColorStop(1,'rgba(0,0,0,.02)');
  ctx.fillStyle=grad;ctx.beginPath();
  ctx.moveTo(pts[0].x,pT+ph);pts.forEach(function(p){ctx.lineTo(p.x,p.y);});
  ctx.lineTo(pts[pts.length-1].x,pT+ph);ctx.closePath();ctx.fill();

  ctx.strokeStyle=mainColor;ctx.lineWidth=2.5;ctx.lineJoin='round';
  ctx.beginPath();pts.forEach(function(p,i){i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();

  pts.forEach(function(p,i){
    ctx.fillStyle=mainColor;ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#9090B0';ctx.font='8px Inter,sans-serif';ctx.textAlign='center';
    var v=saldos[i],lbl=(v>=0?'+':'')+Math.round(v/1000)+'k';
    ctx.fillText(lbl,p.x,p.y-8);
    ctx.fillText(months[i].label,p.x,H-4);
  });
}

// ④ Cashflow mensal — barras agrupadas
function renderFinCashflowChart() {
  var months = finGetMonthData(6);
  var maxV = 1;
  months.forEach(function(m){ maxV = Math.max(maxV, m.ent, m.sai); });
  // Arredonda para cima em múltiplos bonitos
  var mag = Math.pow(10, Math.floor(Math.log10(maxV)));
  maxV = Math.ceil(maxV / mag) * mag * 1.1;

  var r = finSetupCanvas('fin-cashflow-chart', 250);
  if (!r) return;
  var ctx=r.ctx,W=r.W,H=r.H;
  var pL=46,pR=8,pT=22,pB=24,pw=W-pL-pR,ph=H-pT-pB;
  var gw=pw/months.length, bw=Math.min(22,gw/2-4);

  // Grid
  [0,.33,.66,1].forEach(function(g){
    var y=pT+ph*(1-g);
    ctx.strokeStyle='rgba(42,42,56,.6)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(W-pR,y);ctx.stroke();
    var val = maxV*g;
    var lbl = val>=1000 ? 'R$'+Math.round(val/1000)+'k' : 'R$'+Math.round(val);
    ctx.fillStyle='#4A4A68';ctx.font='8px Inter,sans-serif';ctx.textAlign='right';
    ctx.fillText(lbl,pL-3,y+3);
  });

  months.forEach(function(m,i){
    var cx=pL+i*gw+gw/2;
    var xE=cx-bw-2,xS=cx+2;
    var eh=Math.max(0,(m.ent/maxV)*ph), sh=Math.max(0,(m.sai/maxV)*ph);

    // Barra entradas
    var ge=ctx.createLinearGradient(0,pT+ph-eh,0,pT+ph);
    ge.addColorStop(0,'rgba(16,185,129,.9)');ge.addColorStop(1,'rgba(16,185,129,.4)');
    ctx.fillStyle=ge;
    if(eh>0){ctx.beginPath();ctx.roundRect(xE,pT+ph-eh,bw,eh,3);ctx.fill();}

    // Barra saídas
    var gs=ctx.createLinearGradient(0,pT+ph-sh,0,pT+ph);
    gs.addColorStop(0,'rgba(239,68,68,.9)');gs.addColorStop(1,'rgba(239,68,68,.4)');
    ctx.fillStyle=gs;
    if(sh>0){ctx.beginPath();ctx.roundRect(xS,pT+ph-sh,bw,sh,3);ctx.fill();}

    // Label mês
    ctx.fillStyle='#4A4A68';ctx.font='8px Inter,sans-serif';ctx.textAlign='center';
    ctx.fillText(m.label,cx,H-6);

    // Valores acima das barras (apenas se houver valor)
    ctx.font='bold 8px Inter,sans-serif';
    if(m.ent>0){
      var lE = m.ent>=1000?'R$'+Math.round(m.ent/1000)+'k':'R$'+Math.round(m.ent);
      ctx.fillStyle='#10B981';ctx.textAlign='center';
      ctx.fillText(lE,xE+bw/2,pT+ph-eh-4);
    }
    if(m.sai>0){
      var lS = m.sai>=1000?'R$'+Math.round(m.sai/1000)+'k':'R$'+Math.round(m.sai);
      ctx.fillStyle='#EF4444';ctx.textAlign='center';
      ctx.fillText(lS,xS+bw/2,pT+ph-sh-4);
    }
  });
}

var _chartsRAF = null;
function renderAllCharts() {
  if (_chartsRAF) cancelAnimationFrame(_chartsRAF);
  _chartsRAF = requestAnimationFrame(function(){
    _chartsRAF = null;
    renderFinAreaChart();
    renderFinCashflowChart();
    // Charts analíticos em frame seguinte (divide o trabalho, evita jank)
    requestAnimationFrame(function(){
      renderFinCatChart();
      renderFinMethodChart();
      renderFinStatusChart();
    });
  });
}

// ══ PAINEL DE CATEGORIAS COM FILTRO DE PERÍODO ══
function renderFinCatPanel() {
  var panel = document.getElementById('fin-cats-panel');
  if (!panel) return;

  // Filtra saídas pelo período selecionado
  var now = new Date();
  var saidas;
  if (catPeriodo === 0) {
    saidas = finances.filter(function(f){ return f.type === 'saida'; });
  } else {
    // início: N meses atrás, fim: último dia do mês atual
    var desde = new Date(now.getFullYear(), now.getMonth() - catPeriodo + 1, 1);
    var ate   = new Date(now.getFullYear(), now.getMonth() + 1, 0); // último dia do mês atual
    var desdeStr = dateToLocal(desde);
    var ateStr   = dateToLocal(ate);
    saidas = finances.filter(function(f){
      return f.type === 'saida' && f.date && f.date >= desdeStr && f.date <= ateStr;
    });
  }

  var catMap = {};
  saidas.forEach(function(f){ catMap[f.category||'?'] = (catMap[f.category||'?']||0) + f.value; });
  var cats = Object.entries(catMap).sort(function(a,b){ return b[1]-a[1]; });
  var maxCat = cats.length ? cats[0][1] : 1;
  var catColors = ['var(--violet)','var(--amber)','var(--cyan)','var(--green)','var(--red)','var(--violet-light)'];

  var periodos = [
    {v:1,  l:'Mês'},
    {v:3,  l:'3M'},
    {v:6,  l:'6M'},
    {v:12, l:'12M'},
    {v:0,  l:'Tudo'},
  ];

  var btns = periodos.map(function(p){
    var active = catPeriodo === p.v ? ' active' : '';
    return '<button class="cat-periodo-btn'+active+'" onclick="setCatPeriodo('+p.v+')">'+p.l+'</button>';
  }).join('');

  var catItems = cats.map(function(cat, i){
    var pct = (cat[1]/maxCat*100).toFixed(0);
    return '<div class="cat-item">' +
      '<div class="cat-row"><span class="cat-name">'+escHtml(cat[0])+'</span><span class="cat-val">'+fmtMoney(cat[1])+'</span></div>' +
      '<div class="cat-bar-bg"><div class="cat-bar-fill" style="width:'+pct+'%;background:'+catColors[i%catColors.length]+'"></div></div>' +
    '</div>';
  }).join('');

  var labelPeriodo = catPeriodo === 0 ? 'todo o período' :
    catPeriodo === 1 ? 'mês atual' :
    'últimos ' + catPeriodo + ' meses';

  panel.innerHTML =
    '<div class="section-header" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">' +
      '<span class="section-title">Por categoria (saídas)</span>' +
    '</div>' +
    '<div class="cat-periodo-btns">' + btns + '</div>' +
    (cats.length ? catItems : '<p style="color:var(--text-dim);font-size:12px">Nenhuma saída registrada.</p>');
}

function setCatPeriodo(p) {
  catPeriodo = p;
  renderFinCatPanel();
}

// ══ CONFIGURAÇÃO DE CATEGORIAS ESSENCIAIS ══
function openCatsEssenciais() {
  var lista = document.getElementById('modal-ess-lista');
  if (!lista) return;

  // Coleta todas as categorias usadas nas saídas
  var todasCats = {};
  finances.filter(function(f){ return f.type === 'saida'; })
    .forEach(function(f){ if (f.category) todasCats[f.category] = true; });
  // Adiciona categorias do cadastro
  (finCategories||[]).forEach(function(c){
    var nome = typeof c === 'string' ? c : (c.label||c.id||'');
    if (nome) todasCats[nome] = true;
  });

  var cats = Object.keys(todasCats).sort();

  lista.innerHTML = cats.map(function(cat) {
    var isEss = indCatsEssenciais.indexOf(cat) !== -1;
    return '<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--card);border-radius:8px;cursor:pointer;border:1px solid '+(isEss?'rgba(16,185,129,.3)':'var(--border-soft)')+'">' +
      '<input type="checkbox" value="'+escHtml(cat)+'" '+(isEss?'checked':'')+' style="accent-color:var(--green);width:16px;height:16px">' +
      '<span style="font-size:11px;font-weight:'+(isEss?'700':'400')+';color:'+(isEss?'var(--text)':'var(--muted)')+'">'+escHtml(cat)+'</span>' +
    '</label>';
  }).join('');

  openModal('modal-cats-essenciais');
}

function salvarCatsEssenciais() {
  var checks = document.querySelectorAll('#modal-ess-lista input[type="checkbox"]');
  indCatsEssenciais = [];
  checks.forEach(function(ch){
    if (ch.checked) indCatsEssenciais.push(ch.value);
  });
  localStorage.setItem('painel_cats_essenciais', JSON.stringify(indCatsEssenciais));
  closeModal('modal-cats-essenciais');
  renderIndicadores();
  showToast('✅ Categorias essenciais salvas (' + indCatsEssenciais.length + ')');
}

// ══ SELETOR DE STATUS INLINE ══
var _vencFinId = null; // ID do lançamento aguardando data de vencimento

function finSetStatusInline(id, status) {
  if (status === 'pendente') {
    // Abre mini-modal para pedir data de vencimento
    _vencFinId = id;
    var f = finances.find(function(x){ return x.id === id; });
    var desc = f ? f.desc : '';
    var el = document.getElementById('venc-modal-desc');
    if (el) el.textContent = '"' + desc + '" — informe a data de vencimento';
    // Pré-preenche com due_date existente ou vazio
    var inp = document.getElementById('venc-date');
    if (inp) inp.value = (f && f.due_date) ? f.due_date : '';
    openModal('modal-vencimento');
    return;
  }
  // Pago ou Parcela — muda direto, limpa due_date
  var f = finances.find(function(x){ return x.id === id; });
  if (!f) return;
  f.status = status;
  f.due_date = null; // limpa vencimento em qualquer status que não seja pendente
  lsSave(); scheduleSave();
  renderFinList();
  renderFinance();
}

function cancelarVenc() {
  closeModal('modal-vencimento');
  _vencFinId = null;
}

function confirmarVenc() {
  var date = document.getElementById('venc-date').value;
  if (!date) { showToast('⚠️ Informe a data de vencimento'); return; }
  var f = finances.find(function(x){ return x.id === _vencFinId; });
  if (!f) return;
  f.status   = 'pendente';
  f.due_date = date;
  closeModal('modal-vencimento');
  _vencFinId = null;
  lsSave(); scheduleSave();
  renderFinList();
  renderFinance();
  showToast('⏳ Vencimento: ' + new Date(date+'T12:00:00').toLocaleDateString('pt-BR'));
}

// ══ SINCRONIZA FORMAS DE PAGAMENTO DOS LANÇAMENTOS ══
function syncPayMethodsFromFinances() {
  var defaults = ['PIX','Débito','Crédito','Dinheiro','TED','Outro'];
  var found = {};
  finances.forEach(function(f) {
    if (f.method && !defaults.includes(f.method)) found[f.method] = true;
  });
  var extras = Object.keys(found).sort();
  // Adiciona os que ainda não estão em customPayMethods
  extras.forEach(function(m) {
    if (!customPayMethods.includes(m)) customPayMethods.push(m);
  });
  if (extras.length > 0) {
    localStorage.setItem('painel_pay_methods', JSON.stringify(customPayMethods));
  }
}

// ══ GERENCIADOR DE FORMAS DE PAGAMENTO ══
var PAY_DEFAULTS = ['PIX','Débito','Crédito','Dinheiro','TED','Outro'];

function openPayMethods() {
  renderPayMethodList();
  openModal('modal-pay-methods');
  setTimeout(function(){ var i = document.getElementById('nova-pay-input'); if(i) i.focus(); }, 200);
}

function renderPayMethodList() {
  var list = document.getElementById('pay-method-list');
  if (!list) return;
  var html = '';
  // Padrões (não removíveis)
  PAY_DEFAULTS.forEach(function(m) {
    html += '<div class="pay-item"><span class="pay-item-name">'+escHtml(m)+'</span><span class="pay-item-tag">padrão</span></div>';
  });
  // Customizadas (removíveis)
  customPayMethods.forEach(function(m, i) {
    html += '<div class="pay-item"><span class="pay-item-name">'+escHtml(m)+'</span>'+
      '<button class="pay-item-del" onclick="removePayMethod('+i+')" title="Remover">✕</button></div>';
  });
  if (!customPayMethods.length) {
    html += '<div style="font-size:11px;color:var(--dim);padding:6px 0">Nenhuma forma customizada cadastrada</div>';
  }
  list.innerHTML = html;
}

function addPayMethod() {
  var inp = document.getElementById('nova-pay-input');
  var val = (inp ? inp.value : '').trim();
  if (!val) { showToast('⚠️ Informe o nome da forma de pagamento'); return; }
  if (PAY_DEFAULTS.includes(val) || customPayMethods.includes(val)) {
    showToast('⚠️ "' + val + '" já existe'); return;
  }
  customPayMethods.push(val);
  localStorage.setItem('painel_pay_methods', JSON.stringify(customPayMethods));
  lsSave(); scheduleSave();
  if (inp) inp.value = '';
  renderPayMethodList();
  updateFinMethodSelects();
  showToast('✅ "' + val + '" adicionado');
}

function removePayMethod(idx) {
  var nome = customPayMethods[idx];
  if (!confirm('Remover "' + nome + '"?')) return;
  customPayMethods.splice(idx, 1);
  localStorage.setItem('painel_pay_methods', JSON.stringify(customPayMethods));
  lsSave(); scheduleSave();
  renderPayMethodList();
  updateFinMethodSelects();
  showToast('🗑️ "' + nome + '" removido');
}

function renderFinCards() {
  var mes = finCalYear + '-' + String(finCalMonth+1).padStart(2,'0');
  var mesFin = finances.filter(function(f){ return f.date && f.date.startsWith(mes); });
  var saidas = mesFin.filter(function(f){ return f.type === 'saida'; });

  // Card 1 — Total pago
  var saidasPagas = saidas.filter(function(f){ return !f.status || f.status === 'pago'; });
  var totalSP = saidasPagas.reduce(function(s,f){ return s+f.value; }, 0);
  var elSaldo = document.getElementById('fin-saldo');
  if (elSaldo) { elSaldo.textContent = '-' + fmtMoney(totalSP); elSaldo.style.color = totalSP>0?'var(--red)':'var(--muted)'; }
  var elSD = document.getElementById('fin-saldo-delta');
  if (elSD) elSD.textContent = saidasPagas.length + ' pagamento(s) no mês';

  // Card 2 — Comprometimento
  var saidasPendentes = finances.filter(function(f) {
    if (f.type !== 'saida') return false;
    if (f.status !== 'pendente' && f.status !== 'parcela') return false;
    var dataRef = f.due_date || f.date || '';
    return dataRef.startsWith(mes);
  });
  var comprometido = saidasPendentes.reduce(function(s,f){ return s+f.value; }, 0);
  var elProj = document.getElementById('fin-saldo-proj');
  if (elProj) { elProj.textContent = comprometido > 0 ? '-' + fmtMoney(comprometido) : fmtMoney(0); elProj.style.color = comprometido>0?'var(--amber)':'var(--muted)'; }
  var elProjD = document.getElementById('fin-saldo-proj-delta');
  if (elProjD) elProjD.textContent = saidasPendentes.length>0 ? saidasPendentes.length+' lançamento(s) a pagar' : 'nada pendente ✅';
}

// ══ ORÇAMENTOS ══
var orcamentos = JSON.parse(localStorage.getItem('painel_orcamentos') || '[]');

function saveOrcamentos() {
  localStorage.setItem('painel_orcamentos', JSON.stringify(orcamentos));
}

// Renovação automática ao carregar
function orcRenovar() {
  var hoje = todayLocal();
  var changed = false;
  orcamentos.forEach(function(o) {
    if (!o.renovacao || o.renovacao === 'none') return;
    if (o.fim && o.fim < hoje) {
      if (o.renovacao === 'cartao' && o.tipo === 'method') {
        // Ciclo do cartão
        if (orcRenovarCartao(o)) { changed = true; return; }
      }
      var inicio = new Date(o.inicio + 'T12:00:00');
      var fim    = new Date(o.fim    + 'T12:00:00');
      var dias = o.renovacao === 'monthly'
        ? Math.round((fim - inicio) / 86400000)
        : (parseInt(o.ciclo) || 30);
      var novoinicio = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() + 1);
      var novofim    = new Date(novoinicio.getFullYear(), novoinicio.getMonth(), novoinicio.getDate() + dias);
      o.inicio = dateToLocal(novoinicio);
      o.fim    = dateToLocal(novofim);
      changed = true;
    }
  });
  if (changed) { saveOrcamentos(); }
}

// Calcula dados de um orçamento
function orcCalc(o) {
  var inicio = o.inicio, fim = o.fim;
  var hoje = todayLocal();
  var gastos = finances.filter(function(f) {
    if (f.type !== 'saida') return false;

    // Data de referência: se for cartão configurado usa due_date do ciclo, senão usa date
    // Orçamento sempre filtra por date (data da compra)
    // para cartões: o ciclo é definido pelas datas de corte, não pelo vencimento
    var dataRef = f.date;
    if (!dataRef || dataRef < inicio || dataRef > fim) return false;

    if (o.tipo === 'category') return f.category === o.filtro;
    if (o.tipo === 'method')   return f.method   === o.filtro;
    return false;
  });
  var gasto = gastos.reduce(function(s,f){ return s+f.value; }, 0);
  var limite = o.limite || 1;
  var pct    = Math.min(gasto / limite * 100, 999);

  // Dias
  var dIni = new Date(inicio + 'T12:00:00');
  var dFim = new Date(fim    + 'T12:00:00');
  var dHoje= new Date(hoje   + 'T12:00:00');
  var totalDias     = Math.max(1, Math.round((dFim - dIni) / 86400000) + 1);
  var diasDecorridos= Math.max(1, Math.min(totalDias, Math.round((dHoje - dIni) / 86400000) + 1));
  var diasRestantes = Math.max(0, Math.round((dFim - dHoje) / 86400000));
  var ritmoIdealPct = (diasDecorridos / totalDias) * 100;
  var restante      = Math.max(0, limite - gasto);
  var maxDia        = diasRestantes > 0 ? restante / diasRestantes : 0;

  // Status
  var status = pct > 100 ? 'risk' : pct > ritmoIdealPct * 1.1 ? 'warn' : 'safe';

  // Recomendação
  var rec = '';
  if (status === 'risk') {
    rec = '🚨 Orçamento estourado em ' + fmtMoney(gasto - limite) + '. Evite novos gastos até o próximo período.';
  } else if (status === 'warn') {
    rec = '⚠️ Acima do ritmo ideal. Máximo ' + fmtMoney(maxDia) + '/dia nos próximos ' + diasRestantes + ' dias para não estourar.';
  } else {
    rec = '✅ Dentro do ritmo. Pode gastar até ' + fmtMoney(maxDia) + '/dia com tranquilidade.';
  }

  return {gasto:gasto, limite:limite, pct:pct.toFixed(1), restante:restante,
          diasRestantes:diasRestantes, maxDia:maxDia, ritmoIdealPct:ritmoIdealPct,
          status:status, rec:rec};
}

function orcCard(o, idx) {
  var d = orcCalc(o);
  var cor = d.status==='safe'?'var(--green)':d.status==='warn'?'var(--amber)':'var(--red)';
  var barW = Math.min(parseFloat(d.pct), 100).toFixed(1);
  var barGrad = d.status==='safe'
    ? 'linear-gradient(90deg,var(--green),#34d399)'
    : d.status==='warn'
    ? 'linear-gradient(90deg,var(--green),var(--amber))'
    : 'linear-gradient(90deg,var(--amber),var(--red))';
  var barShadow = d.status==='risk'?'box-shadow:0 0 8px rgba(239,68,68,.3)':'';
  var idealLeft = Math.min(d.ritmoIdealPct, 100).toFixed(1);

  return '<div class="orc-row '+d.status+'" id="orc-row-'+idx+'">' +
    '<div class="orc-top">' +
      '<span class="orc-icon">'+(o.icon||'📊')+'</span>' +
      '<div style="flex:1">' +
        '<div class="orc-name" onclick="orcVerLancamentos('+idx+')" style="cursor:pointer" title="Ver lançamentos">'+escHtml(o.nome)+' <span style=\"font-size:9px;color:var(--dim)\">↗</span></div>' +
        '<div class="orc-period-lbl">'+o.inicio+' → '+o.fim+' · '+d.diasRestantes+' dias restantes</div>' +
      '</div>' +
      '<span class="orc-pct" style="color:'+cor+'">'+d.pct+'%</span>' +
      '<div class="orc-acts">' +
        '<button class="btn-act" onclick="orcToggleSim('+idx+')" title="Simular compra">🎯</button>' +
        '<button class="btn-act" onclick="openOrcModal('+idx+')" title="Editar">✏️</button>' +
        '<button class="btn-act btn-act-del" onclick="excluirOrc('+idx+')" title="Excluir">✕</button>' +
      '</div>' +
    '</div>' +
    '<div class="orc-bar-wrap" onclick="orcVerLancamentos('+idx+')" style="cursor:pointer" title="Ver lançamentos">' +
      '<div class="orc-bar-fill" style="width:'+barW+'%;background:'+barGrad+';'+barShadow+'"></div>' +
      '<div class="orc-ideal-marker" style="left:'+idealLeft+'%">' +
        '<div class="orc-ideal-badge">ideal</div>' +
      '</div>' +
    '</div>' +
    '<div class="orc-kpis">' +
      '<span>Gasto: <strong style="color:'+cor+'">'+fmtMoney(d.gasto)+'</strong></span>' +
      '<span>Restante: <strong style="color:'+(d.restante>0?'var(--green)':'var(--red)')+'">'+fmtMoney(d.restante)+'</strong></span>' +
      '<span>Dias: <strong>'+d.diasRestantes+'</strong></span>' +
      '<span>Máx/dia: <strong>'+fmtMoney(d.maxDia)+'</strong></span>' +
    '</div>' +
    '<div class="orc-rec '+d.status+'">'+d.rec+'</div>' +
    '<div class="orc-sim" id="orc-sim-'+idx+'">' +
      '<div class="orc-sim-title">🎯 Simular compra — '+escHtml(o.nome)+'</div>' +
      '<div class="orc-sim-row">' +
        '<input class="orc-sim-input" type="number" placeholder="Valor da compra (R$)" oninput="orcCalcSim(this,'+idx+')">' +
        '<button class="btn btn-primary" style="font-size:10px;padding:6px 10px">Simular</button>' +
      '</div>' +
      '<div id="orc-sim-result-'+idx+'" style="display:none">' +
        '<div class="orc-sim-kpis">' +
          '<div class="orc-sim-kpi"><div class="orc-sim-kpi-val" id="osr-pct-'+idx+'">—</div><div class="orc-sim-kpi-lbl">Novo %</div></div>' +
          '<div class="orc-sim-kpi"><div class="orc-sim-kpi-val" id="osr-rest-'+idx+'">—</div><div class="orc-sim-kpi-lbl">Restaria</div></div>' +
          '<div class="orc-sim-kpi"><div class="orc-sim-kpi-val" id="osr-dia-'+idx+'">—</div><div class="orc-sim-kpi-lbl">Máx/dia</div></div>' +
        '</div>' +
        '<div class="orc-sim-verdict" id="osr-v-'+idx+'"></div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function renderOrcamentos() {
  orcRenovar();
  var list = document.getElementById('orc-list');
  var empty = document.getElementById('orc-empty');
  if (!list) return;

  if (!orcamentos.length) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  list.innerHTML = orcamentos.map(function(o,i){ return orcCard(o,i); }).join('');

  // Atualiza alerta no Financeiro
  var emRisco = orcamentos.filter(function(o){ return orcCalc(o).status !== 'safe'; });
  var alertEl = document.getElementById('fin-orc-alert');
  var alertTxt = document.getElementById('fin-orc-alert-text');
  if (alertEl) {
    if (emRisco.length > 0) {
      alertEl.style.display = 'flex';
      if (alertTxt) alertTxt.innerHTML = '🚨 <strong>'+emRisco.length+' orçamento(s) em risco:</strong> '+
        emRisco.slice(0,3).map(function(o){ return escHtml(o.nome)+' ('+orcCalc(o).pct+'%)'; }).join(' · ');
    } else {
      alertEl.style.display = 'none';
    }
  }
}

function orcToggleSim(idx) {
  var el = document.getElementById('orc-sim-'+idx);
  if (el) el.style.display = el.style.display === 'none' || !el.style.display ? 'block' : 'none';
}

function orcCalcSim(inp, idx) {
  var val = parseFloat(inp.value) || 0;
  if (!val) return;
  var o = orcamentos[idx];
  var d = orcCalc(o);
  var novoGasto = d.gasto + val;
  var novoPct   = (novoGasto / d.limite * 100).toFixed(1);
  var novoRest  = d.limite - novoGasto;
  var novoDia   = d.diasRestantes > 0 ? Math.max(0, novoRest / d.diasRestantes) : 0;

  var pctEl  = document.getElementById('osr-pct-'+idx);
  var restEl = document.getElementById('osr-rest-'+idx);
  var diaEl  = document.getElementById('osr-dia-'+idx);
  var vEl    = document.getElementById('osr-v-'+idx);
  var resEl  = document.getElementById('orc-sim-result-'+idx);

  if (pctEl)  { pctEl.textContent = novoPct+'%'; pctEl.style.color = novoPct>100?'var(--red)':novoPct>85?'var(--amber)':'var(--green)'; }
  if (restEl) { restEl.textContent = (novoRest>=0?'':'-')+fmtMoney(Math.abs(novoRest)); restEl.style.color = novoRest>=0?'var(--green)':'var(--red)'; }
  if (diaEl)  { diaEl.textContent = fmtMoney(novoDia); }
  if (resEl)  resEl.style.display = 'block';

  if (vEl) {
    if (novoPct > 100) {
      vEl.style.cssText = 'background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#f87171;padding:6px 9px;border-radius:7px;font-size:10px;line-height:1.5';
      vEl.innerHTML = '🚨 <strong>Não recomendado.</strong> Vai estourar '+fmtMoney(Math.abs(novoRest))+'. Considere adiar ou usar outra forma.';
    } else if (novoPct > 85) {
      vEl.style.cssText = 'background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);color:var(--amber);padding:6px 9px;border-radius:7px;font-size:10px;line-height:1.5';
      vEl.innerHTML = '⚠️ <strong>Faça com cautela.</strong> Ficará dentro do limite com pouca margem. Máx '+fmtMoney(novoDia)+'/dia nos próximos '+d.diasRestantes+' dias.';
    } else {
      vEl.style.cssText = 'background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.18);color:#34d399;padding:6px 9px;border-radius:7px;font-size:10px;line-height:1.5';
      vEl.innerHTML = '✅ <strong>Seguro fazer.</strong> Restará '+fmtMoney(Math.abs(novoRest))+' e poderá gastar até '+fmtMoney(novoDia)+'/dia tranquilamente.';
    }
  }
}

function openOrcModal(idx) {
  var o = idx !== null && orcamentos[idx] ? orcamentos[idx] : null;
  document.getElementById('orc-modal-title').textContent = o ? '✏️ Editar Orçamento' : '+ Novo Orçamento';
  document.getElementById('orc-nome').value    = o ? o.nome    : '';
  document.getElementById('orc-limite').value  = o ? o.limite  : '';
  document.getElementById('orc-inicio').value  = o ? o.inicio  : todayLocal();
  document.getElementById('orc-fim').value     = o ? o.fim     : '';
  document.getElementById('orc-tipo').value    = o ? o.tipo    : 'category';
  document.getElementById('orc-renovacao').value = o ? (o.renovacao||'none') : 'monthly';
  document.getElementById('orc-icon').value    = o ? (o.icon||'') : '';
  document.getElementById('orc-ciclo').value   = o ? (o.ciclo||30) : 30;
  var cicloWrap = document.getElementById('orc-ciclo-wrap');
  if (cicloWrap) cicloWrap.style.display = (o&&o.renovacao==='custom')?'flex':'none';
  orcUpdateSelects();
  if (o) {
    document.getElementById('orc-filtro').value = o.filtro;
    orcCheckCartao();
    // Restaura período manual ao editar
    document.getElementById('orc-inicio').value = o.inicio;
    document.getElementById('orc-fim').value    = o.fim;
  }
  document.getElementById('modal-orc').dataset.editIdx = idx !== null ? idx : '';
  openModal('modal-orc');
}

function orcUpdateSelects() {
  var tipo = document.getElementById('orc-tipo').value;
  var sel  = document.getElementById('orc-filtro');
  var prevVal = sel.value;
  sel.innerHTML = '';
  var items = tipo === 'category'
    ? (finCategories||[]).map(function(c){ return typeof c==='string'?c:(c.label||c.id); })
    : getPayMethods();
  items.sort(function(a,b){ return a.localeCompare(b,'pt-BR',{sensitivity:'base'}); });
  items.forEach(function(item) {
    var o = document.createElement('option');
    o.value = o.textContent = item;
    sel.appendChild(o);
  });
  if (prevVal) sel.value = prevVal;
  var cicloWrap = document.getElementById('orc-ciclo-wrap');
  var renov = document.getElementById('orc-renovacao') ? document.getElementById('orc-renovacao').value : '';
  if (cicloWrap) cicloWrap.style.display = renov==='custom'?'flex':'none';
  orcCheckCartao();
}

function salvarOrc() {
  var nome   = (document.getElementById('orc-nome').value||'').trim();
  var limite = parseFloat(document.getElementById('orc-limite').value)||0;
  var inicio = document.getElementById('orc-inicio').value;
  var fim    = document.getElementById('orc-fim').value;
  var tipo   = document.getElementById('orc-tipo').value;
  var filtro = document.getElementById('orc-filtro').value;
  var renov  = document.getElementById('orc-renovacao').value;
  var ciclo  = parseInt(document.getElementById('orc-ciclo').value)||30;
  var icon   = (document.getElementById('orc-icon').value||'').trim() || '📊';

  if (!nome)   { showToast('⚠️ Informe o nome'); return; }
  if (!limite) { showToast('⚠️ Informe o limite'); return; }
  if (!inicio) { showToast('⚠️ Informe o início'); return; }
  if (!fim)    { showToast('⚠️ Informe o fim'); return; }

  var obj = {nome:nome, limite:limite, inicio:inicio, fim:fim, tipo:tipo, filtro:filtro,
             renovacao:renov, ciclo:ciclo, icon:icon};

  var idx = document.getElementById('modal-orc').dataset.editIdx;
  if (idx !== '' && idx !== undefined && orcamentos[parseInt(idx)]) {
    orcamentos[parseInt(idx)] = obj;
  } else {
    orcamentos.push(obj);
  }
  saveOrcamentos();
  lsSave(); scheduleSave();
  closeModal('modal-orc');
  renderOrcamentos();
  showToast('✅ Orçamento salvo!');
}

function excluirOrc(idx) {
  if (!confirm('Excluir "'+orcamentos[idx].nome+'"?')) return;
  orcamentos.splice(idx, 1);
  saveOrcamentos();
  lsSave(); scheduleSave();
  renderOrcamentos();
  showToast('🗑️ Orçamento removido');
}

// ══ ABAS DO FINANCEIRO ══
var finActiveTab = 'lancamentos';

function finSwitchTab(tab) {
  finActiveTab = tab;
  document.getElementById('fin-tab-lancamentos').classList.toggle('active', tab === 'lancamentos');
  document.getElementById('fin-tab-orcamentos').classList.toggle('active', tab === 'orcamentos');
  document.getElementById('fin-area-lancamentos').style.display = tab === 'lancamentos' ? '' : 'none';
  document.getElementById('fin-area-orcamentos').style.display  = tab === 'orcamentos'  ? '' : 'none';
  if (tab === 'orcamentos') renderOrcamentos();
}

// ══ DETALHE DE LANÇAMENTOS DO ORÇAMENTO ══
var _orcDetailIdx = null;

function orcVerLancamentos(idx) {
  var o = orcamentos[idx];
  if (!o) return;
  _orcDetailIdx = idx;

  // Filtra lançamentos do orçamento — mesma lógica do orcCalc
  var gastos = finances.filter(function(f) {
    if (f.type !== 'saida') return false;
    var cartao = getCartaoConfig(f.method);
    var dataRef;
    if (f.due_date) {
      // Tem due_date explícito: usa sempre
      dataRef = f.due_date;
    } else if (cartao && f.date && (f.status === 'pendente' || f.status === 'parcela')) {
      // Pendente/parcela com cartão configurado: calcula due_date
      dataRef = calcDueDate(f.date, cartao);
    } else {
      // Pago ou sem cartão: usa date
      dataRef = f.date;
    }
    if (!dataRef || dataRef < o.inicio || dataRef > o.fim) return false;
    if (o.tipo === 'category') return f.category === o.filtro;
    if (o.tipo === 'method')   return f.method   === o.filtro;
    return false;
  }).sort(function(a,b){
    var da = a.due_date||a.date||'', db = b.due_date||b.date||'';
    return db > da ? 1 : -1;
  });

  var total = gastos.reduce(function(s,f){ return s+f.value; }, 0);

  // Popula modal
  document.getElementById('orc-detail-title').textContent = (o.icon||'📊') + ' ' + o.nome;
  document.getElementById('orc-detail-period').textContent = o.inicio + ' → ' + o.fim + ' · ' +
    (o.tipo === 'category' ? 'Categoria: ' : 'Forma: ') + o.filtro;
  document.getElementById('orc-detail-total').textContent = '-' + fmtMoney(total);

  var list = document.getElementById('orc-detail-list');
  if (gastos.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--dim);font-size:11px">Nenhum lançamento neste período</div>';
  } else {
    list.innerHTML = gastos.map(function(f) {
      var fmtDia = f.date ? new Date(f.date+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : '—';
      return '<div class="orc-detail-row" onclick="closeModal(&quot;modal-orc-detail&quot;);editFinance('+f.id+')">' +
        '<div style="font-size:11px;font-weight:700;color:var(--muted);min-width:44px;font-family:monospace">'+fmtDia+'</div>' +
        '<div class="orc-detail-desc">' +
          '<div class="orc-detail-nome">'+escHtml(f.desc)+'</div>' +
          '<div class="orc-detail-sub">'+escHtml(f.category||'')+(f.method?' · '+escHtml(f.method):'')+'</div>' +
        '</div>' +
        '<span class="orc-detail-val">-'+fmtMoney(f.value)+'</span>' +
      '</div>';
    }).join('');
  }

  openModal('modal-orc-detail');
}

function orcVerNoRelatorio() {
  var o = _orcDetailIdx !== null ? orcamentos[_orcDetailIdx] : null;
  if (!o) return;
  closeModal('modal-orc-detail');

  // Vai para aba de Lançamentos
  finSwitchTab('lancamentos');

  // Guarda filtros pendentes para aplicar após renderizar o relatório
  window._relFiltrosPendentes = {
    ini:    o.inicio,
    fim:    o.fim,
    tipo:   'saida',
    cat:    o.tipo === 'category' ? o.filtro : '',
    method: o.tipo === 'method'   ? o.filtro : '',
  };

  setTimeout(function() {
    // Abre o relatório se estiver fechado
    if (!finRelOpen) {
      var btn = document.getElementById('btn-fin-relatorio');
      if (btn) toggleFinRelatorio(btn);
    } else {
      renderFinRelatorio();
    }
    showToast('📊 Mostrando lançamentos de ' + o.nome);
  }, 500);
}

// ══ GRÁFICO — EVOLUÇÃO POR FORMA DE PAGAMENTO (linhas, 6 meses) ══
function renderFinMethodChart() {
  var canvas = document.getElementById('fin-method-chart');
  if (!canvas) return;
  if (canvas.offsetParent === null) return; // invisível: pula

  // Gera os últimos 6 meses
  var meses = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(finCalYear, finCalMonth - i, 1);
    var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    var lbl = d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','');
    meses.push({key:key, label:lbl});
  }

  // Coleta top 5 formas pelo total do período
  var totaisPorForma = {};
  finances.forEach(function(f) {
    if (f.type !== 'saida' || !f.method || !f.date) return;
    var inRange = meses.some(function(m){ return f.date.startsWith(m.key); });
    if (!inRange) return;
    totaisPorForma[f.method] = (totaisPorForma[f.method]||0) + f.value;
  });
  var topFormas = Object.entries(totaisPorForma)
    .sort(function(a,b){ return b[1]-a[1]; })
    .slice(0,5)
    .map(function(e){ return e[0]; });

  if (!topFormas.length) { canvas.style.display='none'; return; }
  canvas.style.display='block';

  var CORES = ['#A78BFA','#06B6D4','#F59E0B','#10B981','#EC4899'];

  // Calcula valores por forma por mês
  var series = topFormas.map(function(forma, fi) {
    var vals = meses.map(function(m) {
      return finances.filter(function(f){
        return f.type==='saida' && f.method===forma && f.date && f.date.startsWith(m.key);
      }).reduce(function(s,f){ return s+f.value; }, 0);
    });
    return {nome:forma, cor:CORES[fi%CORES.length], vals:vals};
  });

  var allVals = series.flatMap(function(s){ return s.vals; });
  var maxRaw = Math.max.apply(null, allVals.concat([1]));
  var mag = Math.pow(10, Math.floor(Math.log10(maxRaw)));
  var maxV = Math.ceil(maxRaw / mag) * mag * 1.1;

  var dpr = Math.min(window.devicePixelRatio||1, 2);
  var W = canvas.parentElement.offsetWidth||400;
  var H = 224;
  canvas.width = W*dpr; canvas.height = H*dpr;
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr,dpr);

  var pL=44, pR=48, pT=16, pB=22, pw=W-pL-pR, ph=H-pT-pB;

  // Grid
  [0,.33,.66,1].forEach(function(g){
    var y=pT+ph*(1-g);
    ctx.strokeStyle='rgba(42,42,56,.5)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(W-pR,y);ctx.stroke();
    var val=maxV*g;
    var lbl=val>=1000?'R$'+Math.round(val/1000)+'k':'R$'+Math.round(val);
    ctx.fillStyle='#4A4A68';ctx.font='8px Inter,sans-serif';ctx.textAlign='right';
    ctx.fillText(lbl,pL-4,y+3);
  });
  meses.forEach(function(m,i){
    ctx.fillStyle='#4A4A68';ctx.font='8px Inter,sans-serif';ctx.textAlign='center';
    ctx.fillText(m.label,pL+i*pw/(meses.length-1),H-5);
  });

  // Linhas + área + pontos
  series.forEach(function(s){
    var pts = s.vals.map(function(v,i){
      return {x:pL+i*pw/(meses.length-1), y:pT+ph*(1-v/maxV)};
    });

    // Área
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pT+ph);
    pts.forEach(function(p){ ctx.lineTo(p.x,p.y); });
    ctx.lineTo(pts[pts.length-1].x, pT+ph);
    ctx.closePath();
    ctx.fillStyle = s.cor+'18';
    ctx.fill();

    // Linha
    ctx.strokeStyle=s.cor;ctx.lineWidth=2;ctx.lineJoin='round';ctx.lineCap='round';
    ctx.beginPath();
    pts.forEach(function(p,i){ i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y); });
    ctx.stroke();

    // Pontos
    pts.forEach(function(p,i){
      ctx.fillStyle=s.cor;ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#111118';ctx.beginPath();ctx.arc(p.x,p.y,1.5,0,Math.PI*2);ctx.fill();
    });

    // Valor último ponto
    var last=pts[pts.length-1];
    var lastVal=s.vals[s.vals.length-1];
    if (lastVal>0) {
      var lbl=lastVal>=1000?'R$'+Math.round(lastVal/1000)+'k':'R$'+Math.round(lastVal);
      ctx.fillStyle=s.cor;ctx.font='bold 8px Inter,sans-serif';ctx.textAlign='left';
      ctx.fillText(lbl,last.x+5,last.y+3);
    }
  });

  // Legenda
  var leg = document.getElementById('fin-method-legend');
  if (leg) {
    leg.innerHTML = series.map(function(s){
      return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:9px;color:#9090B0">'+
        '<span style="display:inline-block;width:12px;height:2px;border-radius:2px;background:'+s.cor+'"></span>'+
        s.nome+'</span>';
    }).join('');
  }
}

// ══ GRÁFICO — STATUS DO MÊS (DONUT + LEGENDA HORIZONTAL) ══
function renderFinStatusChart() {
  var canvas = document.getElementById('fin-status-chart');
  if (!canvas) return;
  if (canvas.offsetParent === null) return; // invisível: pula
  var mes = finCalYear + '-' + String(finCalMonth+1).padStart(2,'0');

  var pago = finances.filter(function(f){
    return f.type==='saida' && (!f.status||f.status==='pago') && f.date && f.date.startsWith(mes);
  }).reduce(function(s,f){return s+f.value;},0);

  var parcela = finances.filter(function(f){
    return f.type==='saida' && f.status==='parcela' && f.date && f.date.startsWith(mes);
  }).reduce(function(s,f){return s+f.value;},0);

  var pendente = finances.filter(function(f){
    if (f.type!=='saida' || f.status!=='pendente') return false;
    var ref = f.due_date || f.date || '';
    return ref.startsWith(mes);
  }).reduce(function(s,f){return s+f.value;},0);

  var total = pago+parcela+pendente;
  if (!total) { canvas.style.display='none'; return; }
  canvas.style.display='block';

  var data = [
    {label:'Pago',    emoji:'\u2705', val:pago,    cor:'rgba(16,185,129,.85)', corS:'#10B981'},
    {label:'Parcela', emoji:'\uD83D\uDCCB', val:parcela, cor:'rgba(6,182,212,.8)',   corS:'#06B6D4'},
    {label:'Pendente',emoji:'\u23F3', val:pendente,cor:'rgba(245,158,11,.8)',  corS:'#F59E0B'},
  ].filter(function(d){ return d.val>0; });

  var dpr=Math.min(window.devicePixelRatio||1,2);
  var W=canvas.parentElement.offsetWidth||400;
  var H=224;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  var ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);

  // Donut lado esquerdo
  var legW = Math.min(160, W*0.42);
  var donutW = W - legW;
  var r = Math.min(donutW/2 - 16, H/2 - 16);
  var cx = donutW/2, cy = H/2;

  // Fatias
  var angle = -Math.PI/2;
  data.forEach(function(d){
    var slice = (d.val/total)*Math.PI*2;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,angle,angle+slice);ctx.closePath();
    ctx.fillStyle=d.cor;ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.12)';ctx.lineWidth=1;ctx.stroke();
    angle+=slice;
  });

  // Buraco
  var ri = r*0.55;
  ctx.beginPath();ctx.arc(cx,cy,ri,0,Math.PI*2);ctx.fillStyle='#111118';ctx.fill();

  // Texto central
  var tlbl = total>=1000?'R$'+(total/1000).toFixed(1)+'k':'R$'+Math.round(total);
  ctx.fillStyle='#E4E4F0';ctx.font='bold 14px Inter,sans-serif';ctx.textAlign='center';
  ctx.fillText(tlbl,cx,cy+2);
  ctx.fillStyle='#7878A0';ctx.font='9px Inter,sans-serif';
  ctx.fillText('total',cx,cy+15);

  // Legenda lado direito — vertical centralizada
  var lx = donutW + 10;
  var itemH = Math.min(60, (H - 20) / Math.max(data.length, 1));
  var startY = (H - data.length * itemH) / 2;

  data.forEach(function(d,i){
    var y = startY + i * itemH;
    var pct = (d.val/total*100).toFixed(1)+'%';
    var vlbl = d.val>=1000?'R$'+(d.val/1000).toFixed(1)+'k':'R$'+Math.round(d.val);

    // Barra indicadora colorida
    ctx.fillStyle=d.cor;
    ctx.beginPath();ctx.roundRect(lx, y+2, 4, itemH-10, 2);ctx.fill();

    // Label
    ctx.fillStyle='#E4E4F0';ctx.font='bold 11px Inter,sans-serif';ctx.textAlign='left';
    ctx.fillText(d.label, lx+10, y+13);

    // Valor
    ctx.fillStyle=d.corS;ctx.font='bold 13px Inter,sans-serif';
    ctx.fillText(vlbl, lx+10, y+28);

    // Percentual
    ctx.fillStyle='#7878A0';ctx.font='10px Inter,sans-serif';
    ctx.fillText(pct, lx+10, y+42);
  });
}


function salvarOrcamentoMes() {
  var inp = document.getElementById('fin-saude-orcamento');
  if (!inp) return;
  var mesKey = finCalYear + '-' + String(finCalMonth+1).padStart(2,'0');
  var raw = (inp.value||'').replace(/R\$/g,'').replace(/\s/g,'').replace(/\./g,'').replace(',','.').trim();
  var val = parseFloat(raw) || 0;
  orcamentosMes[mesKey] = val;
  localStorage.setItem('painel_orc_mes', JSON.stringify(orcamentosMes));
  renderFinSaude();
}

function renderFinSaude() {
  var mesKey = finCalYear + '-' + String(finCalMonth+1).padStart(2,'0');
  var hoje   = todayLocal();

  // Label do mês
  var mesEl = document.getElementById('fin-saude-mes');
  if (mesEl) {
    var d = new Date(finCalYear, finCalMonth, 1);
    mesEl.textContent = d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  }

  // Carrega orçamento do mês
  var inp = document.getElementById('fin-saude-orcamento');
  // Se o usuário está digitando, usa o valor do campo; senão usa o salvo
  var rawInp = (inp ? inp.value : '').replace(/R\$/g,'').replace(/\s/g,'').replace(/\./g,'').replace(',','.').trim();
  var orc = parseFloat(rawInp) || orcamentosMes[mesKey] || 0;
  if (inp && document.activeElement !== inp && orc > 0) {
    inp.value = fmtMoney(orc);
  }

  // Saídas pagas do mês (igual ao card Total Pago)
  var pago = finances.filter(function(f){
    return f.type==='saida' && (!f.status||f.status==='pago') &&
           f.date && f.date.startsWith(mesKey);
  }).reduce(function(s,f){ return s+f.value; }, 0);

  // Comprometimento: pendentes/parcelas com due_date (ou date) ainda no mês
  var dFimMes = new Date(finCalYear, finCalMonth+1, 0);
  var fimMes  = dateToLocal(dFimMes);
  var comp = finances.filter(function(f){
    if (f.type !== 'saida') return false;
    if (f.status !== 'pendente' && f.status !== 'parcela') return false;
    var ref = f.due_date || f.date || '';
    return ref >= hoje && ref <= fimMes;
  }).reduce(function(s,f){ return s+f.value; }, 0);

  // Dias do mês
  var totalDias = dFimMes.getDate();
  var diaAtual  = parseInt(hoje.split('-')[2]);
  var diasRestantes = totalDias - diaAtual;

  // Atualiza cards
  var corPago = 'var(--red)';
  var corComp = 'var(--amber)';
  var corLivre= orc > 0 ? (orc - pago - comp > 0 ? 'var(--green)' : 'var(--red)') : 'var(--muted)';
  var livre   = orc > 0 ? orc - pago - comp : null;

  var el = document.getElementById('fs-pago');
  if (el) { el.textContent = '-'+fmtMoney(pago); el.style.color = corPago; }
  el = document.getElementById('fs-comp');
  if (el) { el.textContent = '-'+fmtMoney(comp); el.style.color = corComp; }
  el = document.getElementById('fs-livre');
  if (el) {
    el.textContent = livre !== null ? (livre>=0?'+':'')+fmtMoney(livre) : '—';
    el.style.color = corLivre;
  }

  // Barra de progresso
  var barWrap = document.getElementById('fs-bar-wrap');
  var barPago = document.getElementById('fs-bar-pago');
  var barComp = document.getElementById('fs-bar-comp');
  if (barWrap && orc > 0) {
    barWrap.style.display = 'block';
    var pctPago = Math.min(pago/orc*100, 100);
    var pctComp = Math.min(comp/orc*100, 100 - pctPago);
    if (barPago) { barPago.style.width = pctPago+'%'; barPago.style.background = pctPago>80?'var(--red)':'var(--cyan)'; }
    if (barComp) { barComp.style.width = pctComp+'%'; barComp.style.left = pctPago+'%'; barComp.style.background = 'var(--amber)'; }
  } else if (barWrap) {
    barWrap.style.display = 'none';
  }

  // Mensagem de ritmo
  var msgEl = document.getElementById('fs-msg');
  if (!msgEl) return;
  if (orc <= 0) {
    msgEl.style.display = 'none';
    return;
  }
  msgEl.style.display = 'block';

  var total = pago + comp;
  var projecao = diaAtual > 0 ? (pago / diaAtual) * totalDias + comp : comp;
  var maxDia   = diasRestantes > 0 ? Math.max(0, orc - pago - comp) / diasRestantes : 0;
  var pct      = (total / orc * 100).toFixed(0);

  var msg, cls;
  if (total > orc) {
    cls = 'background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#f87171';
    msg = '🚨 <strong>Orçamento estourado.</strong> Você pagou ' + fmtMoney(pago) + ' e ainda tem ' + fmtMoney(comp) +
          ' comprometido — total de ' + fmtMoney(total) + ' contra orçamento de ' + fmtMoney(orc) +
          '. Excesso de ' + fmtMoney(total - orc) + '.';
  } else if (projecao > orc * 1.05) {
    cls = 'background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);color:var(--amber)';
    msg = '⚠️ <strong>Atenção ao ritmo.</strong> Você pagou ' + fmtMoney(pago) + ' ('+pct+'% do orçamento). ' +
          'Com o comprometimento de ' + fmtMoney(comp) + ', a projeção é ' + fmtMoney(Math.round(projecao)) +
          ' — acima do limite. Reduza para no máximo ' + fmtMoney(maxDia) + '/dia nos próximos ' + diasRestantes + ' dias.';
  } else {
    cls = 'background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.18);color:#34d399';
    msg = '✅ <strong>Dentro do ritmo.</strong> Você pagou ' + fmtMoney(pago) + ' ('+pct+'% do orçamento). ' +
          'Com o comprometimento de ' + fmtMoney(comp) + ', ainda há ' + fmtMoney(Math.max(0,orc-total)) +
          ' livre. Pode gastar até ' + fmtMoney(maxDia) + '/dia nos próximos ' + diasRestantes + ' dias.';
  }
  msgEl.style.cssText = cls + ';font-size:11px;padding:9px 12px;border-radius:8px;line-height:1.6;font-weight:500';
  msgEl.innerHTML = msg;
}

// ══ CARTÕES DE CRÉDITO ══
var cartoesCredito = JSON.parse(localStorage.getItem('painel_cartoes') || '[]');
var _cartaoEditIdx = null;

function saveCartoes() {
  localStorage.setItem('painel_cartoes', JSON.stringify(cartoesCredito));
}

function getCartaoConfig(method) {
  return cartoesCredito.find(function(c){ return c.nome === method; }) || null;
}

// Calcula due_date de uma compra dado o cartão
function calcDueDate(dateStr, cartao) {
  if (!dateStr || !cartao) return null;
  var d = new Date(dateStr + 'T12:00:00');
  var dia = d.getDate();
  var fatMes, fatAno;

  if (dia <= cartao.fecha) {
    fatMes = d.getMonth(); fatAno = d.getFullYear();
  } else {
    var next = new Date(d.getFullYear(), d.getMonth()+1, 1);
    fatMes = next.getMonth(); fatAno = next.getFullYear();
  }

  // Vencimento pode ser no mesmo mês ou no seguinte
  var vencMes = fatMes, vencAno = fatAno;
  if (cartao.vence <= cartao.fecha) {
    var vnext = new Date(fatAno, fatMes+1, 1);
    vencMes = vnext.getMonth(); vencAno = vnext.getFullYear();
  }

  return vencAno + '-' + String(vencMes+1).padStart(2,'0') + '-' + String(cartao.vence).padStart(2,'0');
}

// Alerta inline no modal de lançamento
function calcFaturaAlert() {
  var dateEl   = document.getElementById('fin-date');
  var methodEl = document.getElementById('fin-method');
  var alertEl  = document.getElementById('fatura-alert-inline');
  if (!dateEl || !methodEl || !alertEl) return;

  var dateStr = dateEl.value;
  var method  = methodEl.value;
  var cartao  = getCartaoConfig(method);

  if (!cartao || !dateStr) {
    alertEl.style.display = 'none';
    return;
  }

  var d   = new Date(dateStr + 'T12:00:00');
  var dia = d.getDate();
  var pulou = dia > cartao.fecha;
  var dueDate = calcDueDate(dateStr, cartao);

  if (!dueDate) { alertEl.style.display = 'none'; return; }

  var nomes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  var dueD  = new Date(dueDate + 'T12:00:00');
  var fatMes = pulou
    ? new Date(d.getFullYear(), d.getMonth()+1, 1).getMonth()
    : d.getMonth();
  var fatLabel  = nomes[fatMes];
  var vencLabel = dueD.getDate() + '/' + nomes[dueD.getMonth()];

  alertEl.style.display = 'block';
  if (pulou) {
    alertEl.style.cssText = 'display:block;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);color:var(--amber);border-radius:8px;padding:8px 12px;font-size:11px;line-height:1.5;margin-top:6px';
    alertEl.innerHTML = '📅 Esta compra <strong>entra na fatura de '+fatLabel+'</strong> — após o fechamento (dia '+cartao.fecha+'). Vencimento calculado: <strong>'+vencLabel+'</strong>.';
  } else {
    alertEl.style.cssText = 'display:block;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);color:#34d399;border-radius:8px;padding:8px 12px;font-size:11px;line-height:1.5;margin-top:6px';
    alertEl.innerHTML = '✅ Esta compra entra na <strong>fatura de '+fatLabel+'</strong> (fecha dia '+cartao.fecha+'). Vencimento: <strong>'+vencLabel+'</strong>.';
  }
}

// Ao salvar lançamento com cartão configurado — atualiza due_date
function applyCartaoDueDate(f) {
  var cartao = getCartaoConfig(f.method);
  if (!cartao || !f.date) return;
  f.due_date = calcDueDate(f.date, cartao);
  f.status   = f.status || 'pendente';
}

// Recalcula due_date de todos os lançamentos com cartões configurados
function recalcCartoesDueDates() {
  var changed = 0;
  finances.forEach(function(f) {
    var cartao = getCartaoConfig(f.method);
    if (!cartao || !f.date || f.type !== 'saida') return;
    var newDue = calcDueDate(f.date, cartao);
    if (newDue !== f.due_date) { f.due_date = newDue; changed++; }
  });
  if (changed > 0) {
    lsSave(); scheduleSave();
    showToast('🔄 ' + changed + ' lançamento(s) com vencimento recalculado');
  }
  return changed;
}

// Tab do gerenciador
function pmSwitchTab(tab) {
  document.getElementById('pm-tab-simples').classList.toggle('active', tab==='simples');
  document.getElementById('pm-tab-cartoes').classList.toggle('active', tab==='cartoes');
  document.getElementById('pm-area-simples').style.display = tab==='simples' ? 'flex' : 'none';
  document.getElementById('pm-area-cartoes').style.display = tab==='cartoes' ? 'block' : 'none';
  if (tab === 'cartoes') renderCartaoList();
}

function toggleCartaoForm(idx) {
  var form = document.getElementById('cartao-form');
  var isOpen = form.classList.contains('open');
  if (isOpen && idx === undefined) {
    form.classList.remove('open');
    return;
  }
  _cartaoEditIdx = idx !== undefined ? idx : null;
  if (_cartaoEditIdx !== null) {
    var cc = cartoesCredito[_cartaoEditIdx];
    document.getElementById('cartao-nome').value  = cc.nome;
    document.getElementById('cartao-fecha').value = cc.fecha;
    document.getElementById('cartao-vence').value = cc.vence;
  } else {
    document.getElementById('cartao-nome').value  = '';
    document.getElementById('cartao-fecha').value = '';
    document.getElementById('cartao-vence').value = '';
  }
  form.classList.add('open');
  document.getElementById('cartao-nome').focus();
}

function salvarCartao() {
  var nome  = (document.getElementById('cartao-nome').value||'').trim();
  var fecha = parseInt(document.getElementById('cartao-fecha').value)||0;
  var vence = parseInt(document.getElementById('cartao-vence').value)||0;
  if (!nome)  { showToast('⚠️ Informe o nome do cartão'); return; }
  if (!fecha || fecha < 1 || fecha > 31) { showToast('⚠️ Dia de fechamento inválido'); return; }
  if (!vence || vence < 1 || vence > 31) { showToast('⚠️ Dia de vencimento inválido'); return; }

  var obj = {nome:nome, fecha:fecha, vence:vence};

  if (_cartaoEditIdx !== null) {
    cartoesCredito[_cartaoEditIdx] = obj;
  } else {
    // Verifica duplicata
    if (cartoesCredito.find(function(c){ return c.nome === nome; })) {
      showToast('⚠️ Cartão "'+nome+'" já cadastrado'); return;
    }
    cartoesCredito.push(obj);
    // Adiciona também como forma de pagamento se não existir
    if (!customPayMethods.includes(nome)) {
      customPayMethods.push(nome);
      localStorage.setItem('painel_pay_methods', JSON.stringify(customPayMethods));
      updateFinMethodSelects();
    }
  }

  saveCartoes();
  lsSave(); scheduleSave();
  document.getElementById('cartao-form').classList.remove('open');
  _cartaoEditIdx = null;
  renderCartaoList();
  recalcCartoesDueDates();
  showToast('✅ Cartão "'+nome+'" salvo!');
}

function toggleLembreteCartao(idx) {
  var cc = cartoesCredito[idx];
  if (!cc) return;
  cc.lembrete = !cc.lembrete;
  saveCartoes();
  lsSave(); scheduleSave();
  renderCartaoList();
  showToast(cc.lembrete ? '🔔 Lembrete de fatura ativado para '+cc.nome : '🔕 Lembrete removido');
}

function excluirCartao(idx) {
  var nome = cartoesCredito[idx].nome;
  if (!confirm('Excluir configuração de "'+nome+'"?')) return;
  cartoesCredito.splice(idx, 1);
  saveCartoes();
  lsSave(); scheduleSave();
  renderCartaoList();
  showToast('🗑️ "'+nome+'" removido');
}

function renderCartaoList() {
  var list = document.getElementById('cartao-list');
  if (!list) return;
  var nomes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  if (!cartoesCredito.length) {
    list.innerHTML = '<div style="font-size:11px;color:var(--dim);padding:8px 0;text-align:center">Nenhum cartão cadastrado</div>';
    return;
  }

  list.innerHTML = cartoesCredito.map(function(cc, i) {
    // Calcula próxima fatura
    var hoje = new Date();
    var dueDate = calcDueDate(todayLocal(), cc);
    var dueD = dueDate ? new Date(dueDate+'T12:00:00') : null;
    // Fecha da próxima fatura
    var diaHoje = hoje.getDate();
    var fechaMes = diaHoje <= cc.fecha ? hoje.getMonth() : (hoje.getMonth()+1)%12;
    var fechaAno = diaHoje <= cc.fecha ? hoje.getFullYear() : (hoje.getMonth()===11 ? hoje.getFullYear()+1 : hoje.getFullYear());
    var fechaLabel = cc.fecha + '/' + nomes[fechaMes];
    var venceLabel = dueD ? dueD.getDate()+'/'+nomes[dueD.getMonth()] : '—';

    return '<div class="cartao-item">' +
      '<div class="cartao-item-header">' +
        '<span style="font-size:16px">💳</span>' +
        '<span class="cartao-item-name">'+escHtml(cc.nome)+'</span>' +
        '<button class="btn-lembrete'+(cc.lembrete?' ativo':'')+'" onclick="toggleLembreteCartao('+i+')" title="'+(cc.lembrete?'Lembrete de fatura ativo':'Ativar lembrete de fatura')+'">🔔</button>' +
        '<button class="btn-sm" onclick="toggleCartaoForm('+i+')" title="Editar">✏️</button>' +
        '<button class="btn-sm" onclick="excluirCartao('+i+')" title="Excluir" style="color:var(--red)">✕</button>' +
      '</div>' +
      '<div class="cartao-item-dates">' +
        '<div><div class="cartao-date-lbl">Fechamento</div><div class="cartao-date-val">Dia '+cc.fecha+'</div></div>' +
        '<div><div class="cartao-date-lbl">Vencimento</div><div class="cartao-date-val">Dia '+cc.vence+'</div></div>' +
        '<div style="margin-left:auto;text-align:right">' +
          '<div class="cartao-date-lbl">Próxima fatura</div>' +
          '<div style="font-size:11px;font-weight:600;color:var(--amber)">Fecha '+fechaLabel+' · Vence '+venceLabel+'</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ══ ORÇAMENTO COM CICLO DE CARTÃO ══

// Gera lista de faturas de um cartão (últimas 2 + próximas 4)
function orcGetFaturas(cartao) {
  var faturas = [];
  var hoje = new Date();
  var nomes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  // Gera 6 ciclos: começa 2 meses atrás
  for (var i = -2; i <= 4; i++) {
    var ref = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    var ano = ref.getFullYear();
    var mes = ref.getMonth(); // 0-11

    // Período do ciclo: dia após fechamento do mês anterior até dia de fechamento deste mês
    var inicioD = new Date(ano, mes - 1, cartao.fecha + 1);
    var fimD    = new Date(ano, mes, cartao.fecha);

    // Due date (vencimento)
    var vencMes = mes, vencAno = ano;
    if (cartao.vence <= cartao.fecha) {
      vencMes = mes + 1;
      if (vencMes > 11) { vencMes = 0; vencAno++; }
    }

    var inicioStr = inicioD.getFullYear() + '-' + String(inicioD.getMonth()+1).padStart(2,'0') + '-' + String(inicioD.getDate()).padStart(2,'0');
    var fimStr    = fimD.getFullYear()    + '-' + String(fimD.getMonth()+1).padStart(2,'0')    + '-' + String(fimD.getDate()).padStart(2,'0');
    var venceStr  = vencAno + '-' + String(vencMes+1).padStart(2,'0') + '-' + String(cartao.vence).padStart(2,'0');

    var label = nomes[mes] + '/' + String(ano).slice(2) +
      ' · ' + inicioD.getDate() + '/' + nomes[inicioD.getMonth()] +
      ' → ' + fimD.getDate()    + '/' + nomes[fimD.getMonth()] +
      ' · vence ' + cartao.vence + '/' + nomes[vencMes];

    faturas.push({label:label, inicio:inicioStr, fim:fimStr, vence:venceStr, mes:mes, ano:ano});
  }
  return faturas;
}

// Popula o seletor de faturas quando tipo=method e cartão configurado
function orcCheckCartao() {
  var tipo    = document.getElementById('orc-tipo').value;
  var filtro  = document.getElementById('orc-filtro').value;
  var fatWrap = document.getElementById('orc-fatura-wrap');
  var perWrap = document.getElementById('orc-periodo-wrap');
  var renovSel= document.getElementById('orc-renovacao');

  var cartao = tipo === 'method' ? getCartaoConfig(filtro) : null;

  if (cartao) {
    // Mostra seletor de fatura, oculta período manual
    fatWrap.style.display = 'flex';
    perWrap.style.display = 'none';

    // Adiciona opção "cartao" à renovação
    var optCartao = renovSel.querySelector('option[value="cartao"]');
    if (!optCartao) {
      var o = document.createElement('option');
      o.value = 'cartao'; o.textContent = 'Ciclo do cartão (automático)';
      renovSel.insertBefore(o, renovSel.children[2]);
    }
    renovSel.value = 'cartao';

    // Popula select de faturas
    var sel = document.getElementById('orc-fatura');
    var faturas = orcGetFaturas(cartao);
    sel.innerHTML = faturas.map(function(f, i) {
      return '<option value="'+i+'">'+f.label+'</option>';
    }).join('');

    // Seleciona a fatura atual (mês corrente)
    var hoje = new Date();
    var melhor = 2; // índice padrão (mês atual)
    faturas.forEach(function(f, i) {
      if (f.mes === hoje.getMonth() && f.ano === hoje.getFullYear()) melhor = i;
    });
    sel.value = melhor;
    orcSelectFatura();

    // Auto-preenche nome se vazio
    var nomeEl = document.getElementById('orc-nome');
    if (!nomeEl.value) {
      var nomes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
      nomeEl.value = filtro + ' — ' + nomes[faturas[melhor].mes] + '/' + String(faturas[melhor].ano).slice(2);
    }
  } else {
    // Forma sem ciclo: mostra período manual
    fatWrap.style.display = 'none';
    perWrap.style.display = 'grid';
    // Remove opção cartao se existir
    var optC = renovSel.querySelector('option[value="cartao"]');
    if (optC) optC.remove();
    if (renovSel.value === 'cartao') renovSel.value = 'monthly';
  }
}

function orcSelectFatura() {
  var sel    = document.getElementById('orc-fatura');
  var filtro = document.getElementById('orc-filtro').value;
  var cartao = getCartaoConfig(filtro);
  if (!cartao || !sel) return;

  var faturas = orcGetFaturas(cartao);
  var idx = parseInt(sel.value) || 0;
  var fat = faturas[idx];
  if (!fat) return;

  document.getElementById('orc-inicio').value = fat.inicio;
  document.getElementById('orc-fim').value    = fat.fim;

  // Auto-atualiza nome
  var nomes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  var nomeEl = document.getElementById('orc-nome');
  if (!nomeEl.value || nomeEl.value.includes(' — ')) {
    nomeEl.value = filtro + ' — ' + nomes[fat.mes] + '/' + String(fat.ano).slice(2);
  }
}

// Renovação de cartão: avança um ciclo
function orcRenovarCartao(o) {
  var cartao = getCartaoConfig(o.filtro);
  if (!cartao) return false;
  var fimD = new Date(o.fim + 'T12:00:00');
  // Próximo ciclo começa no dia seguinte ao fechamento
  var novoInicio = new Date(fimD.getFullYear(), fimD.getMonth(), fimD.getDate() + 1);
  var novoFim    = new Date(novoInicio.getFullYear(), novoInicio.getMonth() + 1, cartao.fecha);
  o.inicio = novoInicio.getFullYear() + '-' + String(novoInicio.getMonth()+1).padStart(2,'0') + '-' + String(novoInicio.getDate()).padStart(2,'0');
  o.fim    = novoFim.getFullYear()    + '-' + String(novoFim.getMonth()+1).padStart(2,'0')    + '-' + String(novoFim.getDate()).padStart(2,'0');
  return true;
}

// ══ LEMBRETES ══

function toggleLembrete(id) {
  var f = finances.find(function(x){ return x.id === id; });
  if (!f) return;
  f.lembrete = !f.lembrete;
  lsSave(); scheduleSave();
  renderFinList();
  renderFinCalendar();
  showToast(f.lembrete ? '🔔 Lembrete ativado para "'+f.desc+'"' : '🔕 Lembrete removido');
}

function toggleLembreteRecor(idx) {
  var r = recorrentes[idx];
  if (!r) return;
  r.lembrete = !r.lembrete;
  saveRecorrentes();
  lsSave(); scheduleSave();
  renderRecorLista();
  showToast(r.lembrete ? '🔔 Lembrete ativado para "'+r.desc+'"' : '🔕 Lembrete removido');
}

function checkLembretes() {
  var hoje = todayLocal();
  var hojeD = new Date(hoje + 'T12:00:00');
  var avisos = [];

  // Lançamentos com lembrete ativo
  finances.forEach(function(f) {
    if (!f.lembrete) return;
    if (f.type !== 'saida') return;
    if (f.status === 'pago') return;
    var ref = f.due_date || f.date || '';
    if (!ref) return;
    var refD = new Date(ref + 'T12:00:00');
    var diff = Math.round((refD - hojeD) / 86400000);
    if (diff === 0) {
      avisos.push({urgencia: 'hoje', msg: '🔔 Vence <strong>hoje</strong> — ' + escHtml(f.desc), val: f.value, ref: ref});
    } else if (diff > 0 && diff <= 2) {
      avisos.push({urgencia: 'proximo', msg: '🔔 Vence em <strong>' + diff + ' dia'+(diff>1?'s':'')+'</strong> — ' + escHtml(f.desc), val: f.value, ref: ref});
    }
  });

  // Recorrentes com lembrete ativo
  recorrentes.forEach(function(r) {
    if (!r.lembrete) return;
    var now = new Date();
    var diaVenc = new Date(now.getFullYear(), now.getMonth(), r.dia);
    var diff = Math.round((diaVenc - hojeD) / 86400000);
    // Verifica se já foi lançada este mês
    var mesKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    var jaLancada = finances.some(function(f){
      return f.desc === r.desc && f.date && f.date.startsWith(mesKey);
    });
    if (jaLancada) return;
    if (diff === 0) {
      avisos.push({urgencia: 'hoje', msg: '🔔 Recorrente <strong>hoje</strong> — ' + escHtml(r.desc), val: r.valor, ref: hoje});
    } else if (diff > 0 && diff <= 2) {
      avisos.push({urgencia: 'proximo', msg: '🔔 Recorrente em <strong>' + diff + ' dia'+(diff>1?'s':'')+'</strong> — ' + escHtml(r.desc), val: r.valor, ref: ''});
    }
  });

  // Faturas de cartão com lembrete ativo
  cartoesCredito.forEach(function(cc) {
    if (!cc.lembrete) return;
    var dueDate = calcDueDate(hoje, cc);
    if (!dueDate) return;
    var dueD = new Date(dueDate + 'T12:00:00');
    var diff = Math.round((dueD - hojeD) / 86400000);
    if (diff === 0) {
      avisos.push({urgencia:'hoje', msg:'🔔 Fatura <strong>'+escHtml(cc.nome)+'</strong> vence <strong>hoje</strong>', val:0, ref:dueDate});
    } else if (diff > 0 && diff <= 2) {
      avisos.push({urgencia:'proximo', msg:'🔔 Fatura <strong>'+escHtml(cc.nome)+'</strong> vence em <strong>'+diff+' dia'+(diff>1?'s':'')+'</strong>', val:0, ref:dueDate});
    }
  });

  if (!avisos.length) return;

  // Mostra toasts sequenciais
  avisos.forEach(function(a, i) {
    setTimeout(function() {
      var div = document.createElement('div');
      div.style.cssText = 'position:fixed;top:'+(20+i*70)+'px;right:20px;z-index:9999;' +
        'background:var(--surface);border:1px solid ' + (a.urgencia==='hoje'?'rgba(239,68,68,.4)':'rgba(245,158,11,.4)') + ';' +
        'border-radius:10px;padding:10px 14px;font-size:11px;max-width:300px;line-height:1.5;' +
        'box-shadow:0 4px 20px rgba(0,0,0,.4);display:flex;align-items:flex-start;gap:8px;' +
        (a.urgencia==='hoje'?'background:rgba(239,68,68,.06)':'background:rgba(245,158,11,.06)');
      div.innerHTML = '<div>' + a.msg + '<br><span style="color:var(--muted)">R$' + fmtMoney(a.val) + (a.ref?' · '+new Date(a.ref+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'') + '</span></div>';
      document.body.appendChild(div);
      setTimeout(function(){ div.remove(); }, 6000);
    }, i * 800);
  });
}

// ══ DEBOUNCE (perf mobile) ══
var _debFinSaude = null;
function debounceFinSaude() {
  if (_debFinSaude) clearTimeout(_debFinSaude);
  _debFinSaude = setTimeout(renderFinSaude, 180);
}
var _debRelRender = null;
function debounceRelRender() {
  if (_debRelRender) clearTimeout(_debRelRender);
  _debRelRender = setTimeout(finRelRender, 220);
}

// ── Backlog: toggle opções ⋮ ──
function toggleBacklogOpts(id, e) {
  if (e) e.stopPropagation();
  var el = document.getElementById('opts-' + id);
  if (!el) return;
  var open = el.style.display !== 'none';
  // Fecha todos os outros abertos
  document.querySelectorAll('[id^="opts-"]').forEach(function(x){ x.style.display = 'none'; });
  el.style.display = open ? 'none' : 'flex';
}
// Fecha ao clicar fora
document.addEventListener('click', function(e) {
  if (!e.target.closest('.item-actions-wrap')) {
    document.querySelectorAll('[id^="opts-"]').forEach(function(x){ x.style.display='none'; });
  }
});

// ── Gmail bar toggle ──
function toggleGmailBar() {
  var body  = document.getElementById('gmail-bar-body');
  var arrow = document.getElementById('gmail-bar-arrow');
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (arrow) arrow.style.transform = open ? '' : 'rotate(180deg)';
}

function openNoteFromBacklog(originId, text) {
  openNoteModal(null);
  setTimeout(function() {
    var titleEl = document.getElementById('mnote-title');
    if (titleEl) titleEl.value = text || '';
    // Remove o item do backlog ao salvar
    var origSave = document.querySelector('#modal-note .btn-primary');
    if (origSave) {
      var _prev = origSave.onclick;
      origSave.onclick = function() {
        saveNoteModal();
        removeFromBacklog(originId);
      };
    }
  }, 50);
}

// ── Listas: toggle opções de item ──
function toggleListItemOpts(listId, itemId) {
  var optsId = 'li-opts-' + listId + '-' + itemId;
  var el = document.getElementById(optsId);
  if (!el) return;
  var isOpen = el.classList.contains('open');
  // Fecha todos os outros abertos desta lista
  document.querySelectorAll('.list-item-actions.open').forEach(function(x){ x.classList.remove('open'); });
  if (!isOpen) el.classList.add('open');
}

// Fecha ao clicar fora
document.addEventListener('click', function(e) {
  if (!e.target.closest('.list-item') && !e.target.closest('.list-item-actions')) {
    document.querySelectorAll('.list-item-actions.open').forEach(function(x){ x.classList.remove('open'); });
  }
});

// ── Listas: botão ➕ no footer ──
function addListItemBtn(listId) {
  var inp = document.getElementById('add-inp-' + listId);
  if (!inp) return;
  var text = inp.value.trim();
  if (!text) { inp.focus(); return; }
  var list = lists.find(function(l){ return l.id === listId; });
  if (list) list.items.push({id: nextListItemId++, text: text, tag: '', done: false});
  inp.value = '';
  inp.focus();
  lsSave(); scheduleSave();
  renderLists();
}

// ── Financeiro: toggle opções de linha ──
function finToggleOpts(id, e) {
  if (e) e.stopPropagation();
  var el = document.getElementById('fin-opts-' + id);
  if (!el) return;
  var isOpen = el.classList.contains('open');
  document.querySelectorAll('.fin-acts-menu.open').forEach(function(x){ x.classList.remove('open'); });
  if (!isOpen) el.classList.add('open');
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('.col-acts')) {
    document.querySelectorAll('.fin-acts-menu.open').forEach(function(x){ x.classList.remove('open'); });
  }
});

// ══════════════════════════════════════════
//  TEMA CLARO / ESCURO
// ══════════════════════════════════════════
var _isLight = false;

function _updateThemeIcons() {
  var icon = _isLight ? '☀️' : '🌙';
  var title = _isLight ? 'Modo Claro (clique para Escuro)' : 'Modo Escuro (clique para Claro)';
  ['theme-btn-sidebar','theme-btn-topbar'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) { el.textContent = icon; el.title = title; }
  });
}

function toggleTheme() {
  _isLight = !_isLight;
  if (_isLight) {
    document.body.classList.add('light-theme');
    document.documentElement.classList.add('light-theme-pre');
    localStorage.setItem('painel_theme', 'light');
  } else {
    document.body.classList.remove('light-theme');
    document.documentElement.classList.remove('light-theme-pre');
    localStorage.setItem('painel_theme', 'dark');
  }
  _updateThemeIcons();
  // Re-renderiza gráficos com cores corretas
  if (typeof renderAllCharts === 'function') {
    setTimeout(renderAllCharts, 50);
  }
}

// Aplica tema salvo ao carregar
(function() {
  var saved = localStorage.getItem('painel_theme');
  if (saved === 'light') {
    _isLight = true;
    document.body.classList.add('light-theme');
    document.documentElement.classList.add('light-theme-pre');
  }
  // Ícones são aplicados após DOM pronto
  document.addEventListener('DOMContentLoaded', function() {
    _updateThemeIcons();
  });
})();

// ══════════════════════════════════════════
//  ABAS PERSONALIZÁVEIS
// ══════════════════════════════════════════
var ALL_TABS = [
  { id:'inbox',    label:'Inbox',      emoji:'📥', required:true  },
  { id:'kanban',   label:'Tarefas',    emoji:'📋', required:false },
  { id:'calendar', label:'Calendário', emoji:'📅', required:false },
  { id:'finance',  label:'Financeiro', emoji:'💰', required:false },
  { id:'jogo',     label:'Quitação',   emoji:'🎮', required:false },
  { id:'lists',    label:'Listas',     emoji:'☰',  required:false },
  { id:'notes',    label:'Notas',      emoji:'📝', required:false },
  { id:'estudos',  label:'Estudos',    emoji:'📖', required:false },
];

var DEFAULT_VISIBLE = ['inbox','kanban','finance','notes'];

function tabsLoad() {
  try {
    var saved = JSON.parse(localStorage.getItem('painel_visible_tabs') || 'null');
    if (Array.isArray(saved)) return saved;
  } catch(e) {}
  return DEFAULT_VISIBLE.slice();
}

function tabsSave(arr) {
  localStorage.setItem('painel_visible_tabs', JSON.stringify(arr));
}

function tabsIsVisible(id) {
  return tabsLoad().indexOf(id) !== -1;
}

function tabsToggle(id) {
  var tab = ALL_TABS.find(function(t){ return t.id === id; });
  if (tab && tab.required) return; // Inbox sempre visível
  var vis = tabsLoad();
  var idx = vis.indexOf(id);
  if (idx === -1) vis.push(id);
  else vis.splice(idx, 1);
  // Garante que inbox sempre está
  if (vis.indexOf('inbox') === -1) vis.unshift('inbox');
  tabsSave(vis);
  applyTabVisibility();
  renderSettingsTabs();
  renderSidebarMore();
  renderBottomNavMore();
}

// Aplica visibilidade nas duas barras
function applyTabVisibility() {
  var vis = tabsLoad();

  // ── Sidebar (desktop) ──
  var navGroup = document.querySelector('.nav-group');
  if (navGroup) {
    navGroup.querySelectorAll('.nav-btn[data-view]').forEach(function(btn) {
      var v = btn.dataset.view;
      btn.style.display = vis.indexOf(v) !== -1 ? '' : 'none';
    });
    // Botão "Mais" na sidebar
    var moreBtn = document.getElementById('sidebar-more-btn');
    var hidden = ALL_TABS.filter(function(t){ return vis.indexOf(t.id) === -1; });
    if (moreBtn) moreBtn.style.display = hidden.length > 0 ? '' : 'none';
  }

  // ── Bottom-nav (mobile) ──
  var bnav = document.querySelector('.bottom-nav');
  if (bnav) {
    bnav.querySelectorAll('.bnav-btn[data-view]').forEach(function(btn) {
      var v = btn.dataset.view;
      btn.style.display = vis.indexOf(v) !== -1 ? '' : 'none';
    });
    var bnavMore = document.getElementById('bnav-more-btn');
    var hiddenM = ALL_TABS.filter(function(t){ return vis.indexOf(t.id) === -1; });
    if (bnavMore) bnavMore.style.display = hiddenM.length > 0 ? '' : 'none';
  }
}

// Renderiza os toggles no modal de settings
function renderSettingsTabs() {
  var el = document.getElementById('settings-tabs-list');
  if (!el) return;
  var vis = tabsLoad();
  el.innerHTML = ALL_TABS.map(function(tab) {
    var isVis = vis.indexOf(tab.id) !== -1;
    var isReq = tab.required;
    return '<div class="tab-toggle-row">'
      + '<div class="tab-toggle-info">'
        + '<div class="tab-toggle-icon">' + tab.emoji + '</div>'
        + '<span>' + tab.label + (isReq ? ' <span class="tab-required">(sempre visível)</span>' : '') + '</span>'
      + '</div>'
      + '<label class="tab-toggle-switch">'
        + '<input type="checkbox"' + (isVis ? ' checked' : '') + (isReq ? ' disabled' : '')
          + ' onchange="tabsToggle(\'' + tab.id + '\')">'
        + '<span class="tab-toggle-slider"></span>'
      + '</label>'
      + '</div>';
  }).join('');
}

// Renderiza menu "Mais" na sidebar (desktop)
function renderSidebarMore() {
  var vis = tabsLoad();
  var hidden = ALL_TABS.filter(function(t){ return vis.indexOf(t.id) === -1; });
  var menu = document.getElementById('sidebar-more-menu');
  if (!menu) return;
  menu.innerHTML = hidden.map(function(tab) {
    return '<div class="sidebar-more-item" onclick="switchView(\'' + tab.id + '\',null);closeSidebarMore()">'
      + '<span class="ico">' + tab.emoji + '</span>'
      + '<span>' + tab.label + '</span>'
      + '</div>';
  }).join('');
}

function toggleSidebarMore(e) {
  if (e) e.stopPropagation();
  var menu = document.getElementById('sidebar-more-menu');
  var btn  = document.getElementById('sidebar-more-btn');
  if (!menu || !btn) return;
  var isOpen = menu.classList.contains('open');
  if (isOpen) { closeSidebarMore(); return; }
  // Posiciona o menu com fixed relativo ao botão
  var rect = btn.getBoundingClientRect();
  menu.style.left = (rect.right + 8) + 'px';
  menu.style.top  = Math.max(8, rect.top - menu.offsetHeight / 2 + rect.height / 2) + 'px';
  menu.classList.add('open');
  // Após renderizar, ajusta se ultrapassar a tela
  requestAnimationFrame(function() {
    var mRect = menu.getBoundingClientRect();
    var winH = window.innerHeight;
    if (mRect.bottom > winH - 8) {
      menu.style.top = Math.max(8, winH - mRect.height - 8) + 'px';
    }
  });
  setTimeout(function(){
    document.addEventListener('click', closeSidebarMore, {once:true});
  }, 10);
}

function closeSidebarMore() {
  var menu = document.getElementById('sidebar-more-menu');
  if (menu) menu.classList.remove('open');
}

// Renderiza modal "Mais" no mobile
function renderBottomNavMore() {
  var vis = tabsLoad();
  var hidden = ALL_TABS.filter(function(t){ return vis.indexOf(t.id) === -1; });
  var body = document.getElementById('more-tabs-body');
  if (!body) return;
  body.innerHTML = hidden.map(function(tab) {
    return '<button class="more-tab-btn" onclick="switchView(\'' + tab.id + '\',null);closeModal(\'modal-more-tabs\')">'
      + '<span class="ico" style="font-size:18px">' + tab.emoji + '</span>'
      + '<span>' + tab.label + '</span>'
      + '</button>';
  }).join('') || '<p style="color:var(--muted);font-size:12px;padding:8px 14px">Todas as abas já estão visíveis.</p>';
}

function openMoreTabs() {
  renderBottomNavMore();
  openModal('modal-more-tabs');
}

// Inicializa ao carregar
(function initTabs() {
  // Garante data-view nos botões da sidebar e bottom-nav após DOM pronto
  document.addEventListener('DOMContentLoaded', function() {
    applyTabVisibility();
    renderSidebarMore();
  });
})();

// ══════════════════════════════════════════
//  FIREBASE STORAGE — UPLOAD DE IMAGEM
// ══════════════════════════════════════════

// Converte dataURL base64 em Blob
function dataURLtoBlob(dataURL) {
  var arr = dataURL.split(',');
  var mime = arr[0].match(/:(.*?);/)[1];
  var bstr = atob(arr[1]);
  var n = bstr.length;
  var u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], {type: mime});
}

// Faz upload de uma imagem Base64 para o Firebase Storage
// Retorna a URL pública de download ou null se falhar/não configurado
async function uploadImageToStorage(base64DataURL, folder) {
  // Garante que Storage está inicializado
  if (!_fbStorage) {
    await fbInit();
    if (!_fbStorage) return null; // Storage não configurado
  }
  try {
    var blob = dataURLtoBlob(base64DataURL);
    var ext  = base64DataURL.startsWith('data:image/png') ? 'png' : 'jpg';
    var path = folder + '/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
    var ref  = _fbStorage.ref(path);
    var snapshot = await ref.put(blob, {contentType: blob.type});
    var url = await snapshot.ref.getDownloadURL();
    return url;
  } catch(e) {
    console.warn('uploadImageToStorage:', e);
    return null;
  }
}

// ══════════════════════════════════════════
//  LIMPAR CACHE E FORÇAR ATUALIZAÇÃO
// ══════════════════════════════════════════
async function clearCacheAndReload() {
  var btn = document.getElementById('btn-clear-cache');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Limpando…'; }

  // 1. Desregistra Service Workers ativos
  if ('serviceWorker' in navigator) {
    try {
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function(r){ return r.unregister(); }));
    } catch(e) { console.warn('SW unregister:', e); }
  }

  // 2. Limpa Cache API (arquivos em cache pelo browser/SW)
  if ('caches' in window) {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function(k){ return caches.delete(k); }));
    } catch(e) { console.warn('Cache API clear:', e); }
  }

  // 3. Recarrega forçando download de nova versão (burla cache HTTP)
  //    localStorage é preservado — dados do usuário ficam intactos
  window.location.href = window.location.pathname
    + '?nocache=' + Date.now();
}

// ══════════════════════════════════════════
//  MODO FOCO — ESTUDOS
// ══════════════════════════════════════════
function buildFocoHTML() {
  var hoje = todayLocal();
  var mats = curriculo.map(function(m){
    return '<option value="' + m.id + '">' + escHtml(m.nome) + '</option>';
  }).join('');

  return '<div style="max-width:520px;margin:0 auto;padding:8px 0">'

    // Header
    + '<div style="text-align:center;margin-bottom:24px">'
    +   '<div style="font-size:28px;margin-bottom:6px">⚡</div>'
    +   '<div style="font-size:18px;font-weight:700;color:var(--text);letter-spacing:-.02em">Modo Foco</div>'
    +   '<div style="font-size:12px;color:var(--muted);margin-top:4px">Registre sua sessão de estudos de forma rápida</div>'
    + '</div>'

    // Card do formulário
    + '<div style="background:var(--card);border:1px solid var(--border-soft);border-radius:16px;overflow:hidden">'

      // Data + Matéria
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid var(--border-soft)">'
        + '<div style="padding:16px 18px;border-right:1px solid var(--border-soft)">'
        +   '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px">📅 Data</div>'
        +   '<input type="date" id="foco-data" value="' + hoje + '" style="width:100%;background:transparent;border:none;outline:none;font-size:14px;font-weight:600;color:var(--text);font-family:inherit">'
        + '</div>'
        + '<div style="padding:16px 18px">'
        +   '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px">📚 Matéria</div>'
        +   '<select id="foco-mat" onchange="focoUpdateMat()" style="width:100%;background:transparent;border:none;outline:none;font-size:13px;font-weight:600;color:var(--text);font-family:inherit;cursor:pointer">'
        +     '<option value="">Selecione…</option>' + mats
        +   '</select>'
        + '</div>'
      + '</div>'

      // Tempo
      + '<div style="padding:16px 18px;border-bottom:1px solid var(--border-soft)">'
      +   '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:12px">⏱ Tempo estudado</div>'
      +   '<div style="display:flex;align-items:center;justify-content:center;gap:12px">'
      +     '<div style="text-align:center">'
      +       '<input type="number" id="foco-horas" min="0" max="12" value="1" style="width:70px;text-align:center;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;font-size:24px;font-weight:700;color:var(--text);font-family:inherit">'
      +       '<div style="font-size:11px;color:var(--muted);margin-top:4px">horas</div>'
      +     '</div>'
      +     '<div style="font-size:28px;color:var(--muted);font-weight:700;margin-bottom:18px">:</div>'
      +     '<div style="text-align:center">'
      +       '<input type="number" id="foco-minutos" min="0" max="59" value="0" style="width:70px;text-align:center;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;font-size:24px;font-weight:700;color:var(--text);font-family:inherit">'
      +       '<div style="font-size:11px;color:var(--muted);margin-top:4px">minutos</div>'
      +     '</div>'
      +   '</div>'
      + '</div>'

      // Questões
      + '<div style="border-bottom:1px solid var(--border-soft)">'
      +   '<div style="padding:16px 18px 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">🎯 Questões</div>'
      +   '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0">'
      
      +     '<div style="padding:8px 18px 16px;text-align:center;border-right:1px solid var(--border-soft)">'
      +       '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Resolvidas</div>'
      +       '<input type="number" id="foco-total" min="0" value="0" oninput="focoCalcAcerto()" style="width:100%;text-align:center;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px;font-size:20px;font-weight:700;color:var(--text);font-family:inherit">'
      +     '</div>'

      +     '<div style="padding:8px 18px 16px;text-align:center;border-right:1px solid var(--border-soft)">'
      +       '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Certas</div>'
      +       '<input type="number" id="foco-certas" min="0" value="0" oninput="focoCalcAcerto()" style="width:100%;text-align:center;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px;font-size:20px;font-weight:700;color:var(--green);font-family:inherit">'
      +     '</div>'

      +     '<div style="padding:8px 18px 16px;text-align:center">'
      +       '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">% Acerto</div>'
      +       '<div id="foco-acerto-display" style="padding:8px;font-size:20px;font-weight:800;color:var(--violet-light);line-height:1.4">—</div>'
      +     '</div>'

      +   '</div>'
      + '</div>'

      // Tema opcional
      + '<div style="padding:14px 18px;border-bottom:1px solid var(--border-soft)">'
      +   '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px">📝 Assunto estudado <span style="font-weight:400;color:var(--dim)">(opcional)</span></div>'
      +   '<input type="text" id="foco-tema" placeholder="Ex: Prescrição e Decadência…" style="width:100%;background:transparent;border:none;border-bottom:1px solid var(--border-soft);outline:none;padding:4px 0;font-size:13px;color:var(--text);font-family:inherit">'
      + '</div>'

      // Botão Salvar
      + '<div style="padding:18px">'
      +   '<button onclick="focoSalvar()" style="width:100%;padding:16px;background:var(--violet);border:none;border-radius:12px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;letter-spacing:-.01em;transition:background-color .15s;touch-action:manipulation" onmouseover="this.style.background=\'var(--violet-light)\'" onmouseout="this.style.background=\'var(--violet)\'">'
      +     '✓ Registrar sessão'
      +   '</button>'
      + '</div>'

    + '</div>'

    // Últimas sessões
    + '<div style="margin-top:20px">'
    +   '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:10px">Últimas sessões</div>'
    +   '<div id="foco-historico"></div>'
    + '</div>'

    + '</div>';
}

// Calcula % de acerto em tempo real
function focoCalcAcerto() {
  var total  = parseInt(document.getElementById('foco-total').value) || 0;
  var certas = parseInt(document.getElementById('foco-certas').value) || 0;
  var disp   = document.getElementById('foco-acerto-display');
  if (!disp) return;
  if (total <= 0) { disp.textContent = '—'; disp.style.color = 'var(--violet-light)'; return; }
  if (certas > total) { certas = total; document.getElementById('foco-certas').value = total; }
  var pct = Math.round(certas / total * 100);
  disp.textContent = pct + '%';
  disp.style.color = pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
}

function focoUpdateMat() {
  // Reservado para feedback visual futuro
}

function focoSalvar() {
  var data   = document.getElementById('foco-data').value;
  var matId  = parseInt(document.getElementById('foco-mat').value) || 0;
  var horas  = parseInt(document.getElementById('foco-horas').value) || 0;
  var mins   = parseInt(document.getElementById('foco-minutos').value) || 0;
  var total  = parseInt(document.getElementById('foco-total').value) || 0;
  var certas = parseInt(document.getElementById('foco-certas').value) || 0;
  var tema   = (document.getElementById('foco-tema').value || '').trim();

  if (!data) { showToast('⚠️ Informe a data'); return; }
  if (!matId){ showToast('⚠️ Selecione a matéria'); return; }
  if (horas === 0 && mins === 0 && total === 0) { showToast('⚠️ Informe tempo ou questões'); return; }

  var mat    = curriculo.find(function(m){ return m.id === matId; });
  var nome   = mat ? mat.nome : 'Desconhecida';
  var durMin = horas * 60 + mins;
  if (certas > total) certas = total;
  var acerto = total > 0 ? Math.round(certas / total * 100) : 0;

  // ── MODO EDIÇÃO: atualiza registros existentes ──
  if (_focoEditQId !== null || _focoEditSId !== null) {
    if (_focoEditQId !== null) {
      var q = questaoSessoes.find(function(x){ return x.id === _focoEditQId; });
      if (q) {
        q.data = data; q.disciplina = nome; q.matId = matId;
        q.total = total; q.acertos = certas; q.acerto = acerto;
        q.tema = tema || 'Modo Foco — ' + nome;
      }
    }
    if (_focoEditSId !== null) {
      var s = sessoes.find(function(x){ return x.id === _focoEditSId; });
      if (s) {
        s.data = data; s.disciplina = nome; s.matId = matId;
        s.durMin = durMin;
        s.fim = s.inicio + durMin * 60000;
      }
    } else if (durMin > 0 && _focoEditQId !== null) {
      // Tinha questão mas não tinha tempo — cria sessão de tempo agora
      sessoes.push({
        id: nextSessaoId++, disciplina: nome, data: data, durMin: durMin,
        tipo: 'Modo Foco', matId: matId, fonte: 'Modo Foco',
        inicio: new Date(data + 'T08:00:00').getTime(),
        fim: new Date(data + 'T08:00:00').getTime() + durMin * 60000,
      });
    }
    lsSave(); scheduleSave();
    showToast('✏️ Registro atualizado!');
    focoCancelarEdicao();

  // ── MODO NOVO: cria registros ──
  } else {
    if (durMin > 0) {
      sessoes.push({
        id: nextSessaoId++, disciplina: nome, data: data, durMin: durMin,
        tipo: 'Modo Foco', matId: matId, fonte: 'Modo Foco',
        inicio: new Date(data + 'T08:00:00').getTime(),
        fim: new Date(data + 'T08:00:00').getTime() + durMin * 60000,
      });
    }
    if (total > 0) {
      questaoSessoes.push({
        id: nextQId++, disciplina: nome, matId: matId, data: data,
        total: total, acertos: certas, acerto: acerto,
        tema: tema || 'Modo Foco — ' + nome, fonte: 'Modo Foco',
      });
    }
    lsSave(); scheduleSave();
    showToast('✅ Sessão registrada!');

    // Reset campos apenas no modo novo
    document.getElementById('foco-total').value   = '0';
    document.getElementById('foco-certas').value  = '0';
    document.getElementById('foco-horas').value   = '1';
    document.getElementById('foco-minutos').value = '0';
    document.getElementById('foco-tema').value    = '';
    document.getElementById('foco-data').value    = todayLocal();
    focoCalcAcerto();
  }

  // Atualiza todos os cards em tempo real
  focoRenderHistorico();
  focoRenderDesempenhoEmbed();
  renderConsistencia();
}

function focoRenderHistorico() {
  var el = document.getElementById('foco-historico');
  if (!el) return;

  // Agrupa por data de registro: une questões + tempo do mesmo "lançamento" pelo id
  // Cada entrada do histórico é baseada numa questaoSessao do Modo Foco
  // e tenta encontrar a sessão de tempo com a mesma data e matéria
  var entries = [];

  questaoSessoes.filter(function(q){ return q.fonte === 'Modo Foco'; })
    .forEach(function(q){
      // Busca sessão de tempo correspondente (mesmo matId e data)
      var s = sessoes.find(function(s){
        return s.fonte === 'Modo Foco' && s.matId === q.matId && s.data === q.data;
      });
      entries.push({
        qId: q.id, sId: s ? s.id : null,
        data: q.data, disc: q.disciplina, matId: q.matId,
        tipo: 'questoes', total: q.total, acertos: q.acertos,
        acerto: q.acerto, tema: q.tema,
        durMin: s ? s.durMin : 0,
      });
    });

  // Sessões de tempo sem questão correspondente
  sessoes.filter(function(s){
    if (s.fonte !== 'Modo Foco') return false;
    return !entries.some(function(e){ return e.sId === s.id; });
  }).forEach(function(s){
    entries.push({ qId: null, sId: s.id, data: s.data, disc: s.disciplina,
      matId: s.matId, tipo: 'tempo', durMin: s.durMin, total:0, acertos:0, acerto:0, tema:'' });
  });

  entries.sort(function(a,b){ return b.data.localeCompare(a.data); });
  entries = entries.slice(0, 15);

  if (!entries.length) {
    el.innerHTML = '<p style="color:var(--dim);font-size:12px;text-align:center;padding:12px 0">Nenhuma sessão registrada ainda.</p>';
    return;
  }

  el.innerHTML = entries.map(function(e) {
    var cor = e.tipo === 'questoes'
      ? (e.acerto >= 70 ? 'var(--green)' : e.acerto >= 50 ? 'var(--amber)' : 'var(--red)')
      : 'var(--cyan)';
    var badge = e.tipo === 'questoes'
      ? e.acerto + '% (' + e.acertos + '/' + e.total + ')'
      : '';
    if (e.durMin > 0) {
      var durStr = Math.floor(e.durMin/60) + 'h' + (e.durMin%60 ? (e.durMin%60)+'min' : '');
      badge = badge ? badge + ' · ' + durStr : durStr;
    }
    var icon = e.tipo === 'questoes' ? '🎯' : '⏱';
    var qId = e.qId !== null ? e.qId : '';
    var sId = e.sId !== null ? e.sId : '';

    return '<div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--card);border:1px solid var(--border-soft);border-radius:10px;margin-bottom:6px">'
      + '<span style="font-size:13px;flex-shrink:0">' + icon + '</span>'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-size:12px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(e.disc) + '</div>'
      +   '<div style="font-size:10px;color:var(--muted)">' + e.data + (e.tema ? ' · ' + escHtml(e.tema).substring(0,35) : '') + '</div>'
      + '</div>'
      + '<div style="font-size:11px;font-weight:700;color:' + cor + ';flex-shrink:0;margin-right:4px">' + badge + '</div>'
      + '<button data-qid="' + qId + '" data-sid="' + sId + '" onclick="focoEditar(this.dataset.qid,this.dataset.sid)" '
      +   'style="flex-shrink:0;padding:4px 8px;border-radius:6px;border:1px solid var(--border);'
      +   'background:var(--surface);color:var(--muted);font-size:10px;font-weight:600;'
      +   'cursor:pointer;font-family:inherit;touch-action:manipulation;white-space:nowrap" '
      +   'title="Editar este registro">✏️</button>'
      + '<button data-qid="' + qId + '" data-sid="' + sId + '" onclick="focoExcluir(this.dataset.qid,this.dataset.sid)" '
      +   'style="flex-shrink:0;padding:4px 8px;border-radius:6px;border:1px solid rgba(239,68,68,.35);'
      +   'background:rgba(239,68,68,.08);color:var(--red);font-size:10px;font-weight:600;'
      +   'cursor:pointer;font-family:inherit;touch-action:manipulation;white-space:nowrap;margin-left:4px" '
      +   'title="Excluir este registro">✕</button>'
      + '</div>';
  }).join('');
}

function renderFocoTab() {
  var container = document.getElementById('estudos-tab-content');
  if (!container) return;

  // Layout: 2 colunas no desktop, 1 no mobile
  container.innerHTML =
    '<div id="foco-layout" style="display:grid;grid-template-columns:420px 1fr;gap:18px;align-items:start">'
    + '<div id="foco-col-form">' + buildFocoHTML() + '</div>'
    + '<div id="foco-col-right" style="display:flex;flex-direction:column;gap:16px">'
    +   '<div id="foco-desempenho-wrap"></div>'
    +   '<div id="foco-consist-wrap" style="background:var(--surface);border:1px solid var(--border-soft);border-radius:var(--radius);padding:16px">'
    +     '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:12px">📅 Constância</div>'
    +     '<div id="consist-root"></div>'
    +   '</div>'
    + '</div>'
    + '</div>';

  // MQ mobile — colapsa para 1 coluna
  if (window.innerWidth < 900) {
    var fl = document.getElementById('foco-layout');
    if (fl) fl.style.gridTemplateColumns = '1fr';
  }

  focoRenderHistorico();
  focoRenderDesempenhoEmbed();
  renderConsistencia();
}

// Renderiza card de Desempenho embutido no Modo Foco
function focoRenderDesempenhoEmbed() {
  var wrap = document.getElementById('foco-desempenho-wrap');
  if (!wrap) return;

  wrap.innerHTML =
    '<div style="background:var(--surface);border:1px solid var(--border-soft);border-radius:var(--radius);padding:16px">'
    + '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:12px">🎯 Desempenho por disciplina</div>'
    + '<div id="foco-desempenho-embed"></div>'
    + '</div>'
    + '<div style="background:var(--surface);border:1px solid var(--border-soft);border-radius:var(--radius);padding:16px;margin-top:16px">'
    +   '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:12px">⏱ Horas por disciplina</div>'
    +   '<div id="foco-horas-embed"></div>'
    + '</div>';

  focoRenderDesempenho();
  focoRenderHoras();
}

function focoRenderHoras() {
  var el = document.getElementById('foco-horas-embed');
  if (!el) return;
  if (!sessoes.length) {
    el.innerHTML = '<p style="color:var(--text-dim);font-size:12px">Nenhuma sessão de tempo registrada.</p>';
    return;
  }
  var map = {};
  sessoes.forEach(function(s) {
    if (!map[s.disciplina]) map[s.disciplina] = 0;
    map[s.disciplina] += (s.durMin || 0);
  });
  var maxMin = Math.max.apply(null, Object.values(map)) || 1;
  var sorted = Object.entries(map).sort(function(a,b){ return b[1]-a[1]; });
  el.innerHTML = sorted.map(function(entry) {
    var disc = entry[0], durMin = entry[1];
    var h = Math.floor(durMin/60), m = durMin%60;
    var label = h > 0 ? h+'h'+(m?m+'min':'') : m+'min';
    var pct = Math.round(durMin/maxMin*100);
    return '<div style="margin-bottom:7px">'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:3px">'
      +   '<span style="font-size:11px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px" title="'+escHtml(disc)+'">'+escHtml(disc)+'</span>'
      +   '<span style="font-size:11px;font-weight:700;color:var(--violet-light);flex-shrink:0;margin-left:8px">'+label+'</span>'
      + '</div>'
      + '<div style="height:5px;background:var(--border-soft);border-radius:3px;overflow:hidden">'
      +   '<div style="width:'+pct+'%;height:100%;background:var(--violet);border-radius:3px"></div>'
      + '</div>'
      + '</div>';
  }).join('');
}
// ── Modo Foco: Desempenho em barras horizontais (mesmo padrão visual que Horas) ──
function focoRenderDesempenho() {
  var el = document.getElementById('foco-desempenho-embed');
  if (!el) return;
  if (!questaoSessoes.length) {
    el.innerHTML = '<p style="color:var(--text-dim);font-size:12px">Nenhuma questão registrada ainda.</p>';
    return;
  }
  var map = {};
  questaoSessoes.forEach(function(s) {
    if (!map[s.disciplina]) map[s.disciplina] = {total:0, acertos:0};
    map[s.disciplina].total   += (s.total  || 0);
    var acerts = s.acertos != null ? s.acertos
      : (s.total && s.acerto != null ? Math.round(s.total * s.acerto / 100) : 0);
    map[s.disciplina].acertos += acerts;
  });
  var sorted = Object.entries(map).map(function(entry) {
    var disc = entry[0], v = entry[1];
    var pct = v.total ? Math.round(v.acertos / v.total * 100) : 0;
    return {disc: disc, pct: pct, total: v.total, acertos: v.acertos};
  }).sort(function(a, b) { return b.pct - a.pct; });

  el.innerHTML = sorted.map(function(row) {
    var cor = row.pct >= 70 ? 'var(--green)' : row.pct >= 50 ? 'var(--amber)' : 'var(--red)';
    return '<div style="margin-bottom:7px">'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:3px">'
      +   '<span style="font-size:11px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px" title="'+escHtml(row.disc)+'">'+escHtml(row.disc)+'</span>'
      +   '<span style="font-size:11px;font-weight:700;color:'+cor+';flex-shrink:0;margin-left:8px">'+row.pct+'% <span style="font-weight:400;color:var(--muted)">('+row.acertos+'/'+row.total+')</span></span>'
      + '</div>'
      + '<div style="height:5px;background:var(--border-soft);border-radius:3px;overflow:hidden">'
      +   '<div style="width:'+row.pct+'%;height:100%;background:'+cor+';border-radius:3px;transition:width .4s ease"></div>'
      + '</div>'
      + '</div>';
  }).join('');
}


// ══════════════════════════════════════════
//  TOGGLE MODO FOCO / MODO COMPLETO
// ══════════════════════════════════════════
var _estudosModo = localStorage.getItem('estudos_mode') || 'foco';

function setEstudosModo(modo) {
  _estudosModo = modo;
  localStorage.setItem('estudos_mode', modo);
  aplicarEstudosModo();
}

function aplicarEstudosModo() {
  var btnFoco     = document.getElementById('btn-modo-foco');
  var btnCompleto = document.getElementById('btn-modo-completo');
  var tabsCompleto = document.getElementById('estudos-tabs-completo');
  if (!btnFoco) return;

  if (_estudosModo === 'foco') {
    // Estilo botão Foco (ativo)
    btnFoco.style.background    = 'var(--violet)';
    btnFoco.style.color         = '#fff';
    btnFoco.style.boxShadow     = '0 1px 4px rgba(124,58,237,.35)';
    // Estilo botão Completo (inativo)
    btnCompleto.style.background = 'transparent';
    btnCompleto.style.color      = 'var(--muted)';
    btnCompleto.style.boxShadow  = 'none';
    // Oculta tabs do Modo Completo
    if (tabsCompleto) tabsCompleto.style.display = 'none';
    // Renderiza Modo Foco
    renderFocoTab();
  } else {
    // Estilo botão Completo (ativo)
    btnCompleto.style.background = 'var(--surface)';
    btnCompleto.style.color      = 'var(--text)';
    btnCompleto.style.boxShadow  = '0 1px 3px rgba(0,0,0,.2)';
    // Estilo botão Foco (inativo)
    btnFoco.style.background    = 'transparent';
    btnFoco.style.color         = 'var(--muted)';
    btnFoco.style.boxShadow     = 'none';
    // Exibe tabs do Modo Completo
    if (tabsCompleto) tabsCompleto.style.display = 'flex';
    // Renderiza tab padrão do Modo Completo
    var activeTab = document.querySelector('#estudos-tabs-completo .estudos-tab.active');
    if (!activeTab) {
      activeTab = document.querySelector('#estudos-tabs-completo .estudos-tab');
      if (activeTab) activeTab.classList.add('active');
    }
    var tabName = 'painel';
    if (activeTab) {
      var onclick = activeTab.getAttribute('onclick') || '';
      var m = onclick.match(/'([^']+)'/);
      if (m) tabName = m[1];
    }
    switchEstudosTab(tabName, activeTab);
  }
}

// ── Modo Foco: estado de edição ──
var _focoEditQId = null;  // id em questaoSessoes sendo editado (ou null)
var _focoEditSId = null;  // id em sessoes sendo editado (ou null)

function focoEditar(qId, sId) {
  _focoEditQId = qId !== '' ? parseInt(qId) : null;
  _focoEditSId = sId !== '' ? parseInt(sId) : null;

  // Carrega dados da questaoSessao (se existir)
  var q = _focoEditQId !== null
    ? questaoSessoes.find(function(x){ return x.id === _focoEditQId; })
    : null;

  // Carrega dados da sessão de tempo (se existir)
  var s = _focoEditSId !== null
    ? sessoes.find(function(x){ return x.id === _focoEditSId; })
    : null;

  var ref = q || s;
  if (!ref) { showToast('⚠️ Registro não encontrado'); return; }

  // Preenche o formulário com os dados do registro
  var data  = ref.data || todayLocal();
  var matId = ref.matId || '';
  var horas = 0, mins = 0;
  if (s) { horas = Math.floor(s.durMin/60); mins = s.durMin % 60; }

  var dataEl = document.getElementById('foco-data');
  var matEl  = document.getElementById('foco-mat');
  var hEl    = document.getElementById('foco-horas');
  var mEl    = document.getElementById('foco-minutos');
  var totEl  = document.getElementById('foco-total');
  var cerEl  = document.getElementById('foco-certas');
  var temaEl = document.getElementById('foco-tema');
  var saveBtn= document.querySelector('[onclick="focoSalvar()"]');

  if (dataEl)  dataEl.value  = data;
  if (matEl)   matEl.value   = matId ? String(matId) : '';
  if (hEl)     hEl.value     = horas;
  if (mEl)     mEl.value     = mins;
  if (totEl)   totEl.value   = q ? (q.total  || 0) : 0;
  if (cerEl)   cerEl.value   = q ? (q.acertos|| 0) : 0;
  if (temaEl)  temaEl.value  = q ? (q.tema || '').replace(/^Modo Foco — .*/, '') : '';

  focoCalcAcerto();

  // Altera o botão para indicar modo de edição
  if (saveBtn) {
    saveBtn.textContent = '✏️ Atualizar registro';
    saveBtn.style.background = 'var(--amber)';
    saveBtn.style.color = '#000';
  }

  // Cancela edição ao clicar fora (via botão cancelar se existir)
  var cancelLink = document.getElementById('foco-cancel-edit');
  if (!cancelLink) {
    var btnDiv = saveBtn ? saveBtn.parentElement : null;
    if (btnDiv) {
      var cl = document.createElement('button');
      cl.id = 'foco-cancel-edit';
      cl.textContent = 'Cancelar edição';
      cl.style.cssText = 'width:100%;padding:10px;background:transparent;border:1px solid var(--border);border-radius:10px;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:6px;touch-action:manipulation';
      cl.onclick = focoCancelarEdicao;
      btnDiv.appendChild(cl);
    }
  }

  // Rola até o formulário
  var card = document.querySelector('.foco-card, #foco-col-form');
  if (card) card.scrollIntoView({behavior:'smooth', block:'start'});

  showToast('✏️ Editando — ajuste e clique em Atualizar');
}

function focoCancelarEdicao() {
  _focoEditQId = null;
  _focoEditSId = null;
  var saveBtn = document.querySelector('[onclick="focoSalvar()"]');
  if (saveBtn) {
    saveBtn.textContent = '✓ Registrar sessão';
    saveBtn.style.background = 'var(--violet)';
    saveBtn.style.color = '#fff';
  }
  var cl = document.getElementById('foco-cancel-edit');
  if (cl) cl.remove();
  // Reseta campos
  var dataEl = document.getElementById('foco-data');
  var totEl  = document.getElementById('foco-total');
  var cerEl  = document.getElementById('foco-certas');
  var hEl    = document.getElementById('foco-horas');
  var mEl    = document.getElementById('foco-minutos');
  var temaEl = document.getElementById('foco-tema');
  if (dataEl) dataEl.value = todayLocal();
  if (totEl)  totEl.value  = '0';
  if (cerEl)  cerEl.value  = '0';
  if (hEl)    hEl.value    = '1';
  if (mEl)    mEl.value    = '0';
  if (temaEl) temaEl.value = '';
  focoCalcAcerto();
}

// ── Modo Foco: excluir registro ──
function focoExcluir(qId, sId) {
  qId = qId !== '' && qId !== 'null' ? parseInt(qId) : null;
  sId = sId !== '' && sId !== 'null' ? parseInt(sId) : null;
  if (!confirm('Excluir este registro de estudo?')) return;
  if (qId !== null) questaoSessoes = questaoSessoes.filter(function(x){ return x.id !== qId; });
  if (sId !== null) sessoes        = sessoes.filter(function(x){ return x.id !== sId; });
  lsSave();
  scheduleSave();
  focoRenderHistorico();
  focoRenderDesempenhoEmbed();
  renderConsistencia();
  showToast('Registro excluído');
}

// ══════════════════════════════════════════
//  BACKUP — EXPORTAR / IMPORTAR JSON
// ══════════════════════════════════════════

// Todas as chaves do painel que devem entrar no backup
var BACKUP_KEYS = [
  'painel_dados_v1',
  'painel_backlog_photos',
  'painel_visible_tabs',
  'painel_theme',
  'painel_orc_mes',
  'fb_config',
  'estudos_mode',
  'painel_cartoes',
  'painel_pay_methods',
  'painel_orcamentos',
];

function exportBackup() {
  var backup = { _version: 2, _exportedAt: new Date().toISOString() };
  BACKUP_KEYS.forEach(function(key) {
    var val = localStorage.getItem(key);
    if (val !== null) backup[key] = val;
  });
  // Inclui qualquer chave painel_ não listada explicitamente
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && k.startsWith('painel_') && !backup.hasOwnProperty(k)) {
      backup[k] = localStorage.getItem(k);
    }
  }
  var json = JSON.stringify(backup, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url;
  a.download = 'painel-backup-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 1000);
  showToast('📤 Backup exportado com sucesso!');
}

function importBackup(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      var count = 0;
      // Versão 2: chaves diretas
      if (data._version === 2) {
        Object.keys(data).forEach(function(k) {
          if (k.startsWith('_')) return;
          localStorage.setItem(k, data[k]);
          count++;
        });
      } else {
        // Versão 1 / legado: pode ser o painel_dados_v1 diretamente
        // ou um objeto com as chaves como valores parsed
        if (data.finances !== undefined || data.backlog !== undefined || data.notes !== undefined) {
          // É um painel_dados_v1 diretamente
          localStorage.setItem('painel_dados_v1', JSON.stringify(data));
          count = 1;
        } else {
          // Tenta iterar as chaves como strings
          Object.keys(data).forEach(function(k) {
            if (k.startsWith('_')) return;
            var val = typeof data[k] === 'string' ? data[k] : JSON.stringify(data[k]);
            localStorage.setItem(k, val);
            count++;
          });
        }
      }
      showToast('✅ ' + count + ' chaves importadas — recarregando…');
      setTimeout(function(){ location.reload(); }, 1200);
    } catch(err) {
      showToast('❌ Erro ao ler o arquivo: ' + err.message);
    }
  };
  reader.readAsText(file);
  input.value = '';
}

document.addEventListener('DOMContentLoaded', function() {
  ensureDefaultCategories();
  setTimeout(renderOrcamentos, 2000);
  renderFinSaude(); // atualiza alerta no Financeiro
  setTimeout(checkRecorrentesDoMes, 3000);
  setTimeout(checkLembretes, 4000);

// Calcula altura real da viewport (exclui barra do navegador em tablets)
// setAppHeight desativado — usando height:100% puro que funciona melhor em PWA
function setAppHeight() {}

  lsLoad();
  // Configura a view inicial ANTES do lock (para que fique pronta quando desbloquear)
  if (typeof switchView === 'function') switchView('inbox', null);
  // Lock screen
  var hash = lockGetHash();
  if (hash) lockShow(false);
  lockResetTimer();
  pwaInit();
  
// Normaliza finCategories para garantir que sejam sempre objetos
(function() {
  if (typeof finCategories !== "undefined") {
    finCategories = finCategories.map(function(c) {
      if (typeof c === "string") return { id: c, label: c, type: "saida" };
      if (!c.label) c.label = c.id || String(c);
      if (!c.type) c.type = "saida";
      return c;
    });
  }
})();

  lockInit();
  renderBacklog();
  renderCalendar();
  requestAnimationFrame(function() {
    var c = document.getElementById('estudos-tab-content');
    if (c && !c.querySelector('#timer-display')) {
      c.innerHTML = buildEstudosPainelHTML();
      renderEstudosPainel();
    }
  });

  // Auto-sync do Firebase se configurado
  if (fbIsConfigured()) {
    cloudSetBtn('ok', '✓ Firebase');
    // Verifica bloqueio de restauração antes de auto-carregar
    var blockTs2 = parseInt(localStorage.getItem('painel_block_cloud_load') || '0');
    if (blockTs2 && (Date.now() - blockTs2) < 300000) {
      console.log('[CLOUD] Auto-carga bloqueada — restauração recente');
      cloudSetBtn('ok', '✓ Dados locais');
      // Salva dados locais no Firebase em vez de sobrescrever
      setTimeout(function() { fbCloudSave(); }, 3000);
    } else {
      setTimeout(function() { fbCloudLoad(false); }, 1200);
    }
  }

  // Auto-reconnect Google Calendar
  if (gcalState.clientId) {
    setTimeout(gcalAutoConnect, 800);
  }
});

