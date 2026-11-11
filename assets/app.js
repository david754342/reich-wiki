/*!
 * Reich Wiki – internes Wissen für das Team der Reich Haustechnik GmbH
 * Daten: Supabase (Anmeldung, Datenbank, Anhänge) · KI: Claude über die Funktion "frage"
 */
(function () {
  'use strict';

  var CFG = window.REICH_WIKI_CONFIG || {};
  var DOMAIN = CFG.usernameDomain || 'wiki.reich-haustechnik.de';
  var MAX_UPLOAD_MB = 15;
  var app = document.getElementById('app');

  /* ============================== Hilfen ============================== */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'; }
  function fmtDateTime(iso) {
    return iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr' : '–';
  }
  function initials(name) {
    var p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  function debounce(fn, ms) { var t; return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); }; }
  function snippet(text, n) {
    var s = String(text || '').replace(/[*#`>]/g, '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + ' …' : s;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function errText(e) {
    var map = {
      'Invalid login credentials': 'Benutzername oder Passwort stimmt nicht.',
      nicht_angemeldet: 'Bitte melde dich erneut an.',
      zugang_gesperrt: 'Dein Zugang ist gesperrt. Bitte wende dich an den Chef.',
      nur_chef: 'Das darf nur der Chef.',
      frage_zu_kurz: 'Bitte formuliere deine Frage etwas ausführlicher.',
      benutzername_ungueltig: 'Benutzername: 3–32 Zeichen, nur Kleinbuchstaben, Zahlen, Punkt, Minus oder Unterstrich.',
      benutzername_vergeben: 'Dieser Benutzername ist schon vergeben.',
      passwort_zu_kurz: 'Das Passwort muss mindestens 10 Zeichen lang sein.',
      letzter_chef: 'Es muss mindestens ein aktiver Chef-Zugang bleiben.',
      nicht_selbst_sperren: 'Du kannst deinen eigenen Zugang nicht sperren.'
    };
    var code = (e && (e.code || e.message)) || '';
    return map[code] || (e && e.message) || 'Da ist etwas schiefgelaufen. Bitte versuche es noch einmal.';
  }

  var ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  /* Einfaches, sicheres Markdown: Absätze, Listen, **fett**, *kursiv*, `code`, Links */
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  }
  function md(src) {
    var lines = esc(src).replace(/\r/g, '').split('\n');
    var out = [], list = null, para = [];
    function flushPara() { if (para.length) { out.push('<p>' + inline(para.join('<br>')) + '</p>'); para = []; } }
    function flushList() {
      if (list) { out.push('<' + list.type + '>' + list.items.map(function (i) { return '<li>' + inline(i) + '</li>'; }).join('') + '</' + list.type + '>'); list = null; }
    }
    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, ''), m;
      if (!line.trim()) { flushPara(); flushList(); return; }
      if ((m = line.match(/^\s*#{1,4}\s+(.*)$/))) { flushPara(); flushList(); out.push('<h4>' + inline(m[1]) + '</h4>'); return; }
      if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { flushPara(); if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; } list.items.push(m[1]); return; }
      if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushPara(); if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; } list.items.push(m[1]); return; }
      if (list && /^\s{2,}\S/.test(raw)) { list.items[list.items.length - 1] += ' ' + line.trim(); return; }
      flushList(); para.push(line);
    });
    flushPara(); flushList();
    return out.join('');
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  /* Dialog: resolves mit dem "value" des gedrückten Buttons (oder null) */
  function dialog(opts) {
    return new Promise(function (resolve) {
      var back = document.createElement('div');
      back.className = 'dialog-backdrop';
      back.innerHTML = '<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title"><h2 id="dlg-title">' + esc(opts.title) + '</h2>' +
        '<div class="dialog__body">' + (opts.html || '') + '</div><p class="alert alert--error" data-err hidden></p><div class="form-actions">' +
        (opts.actions || [{ label: 'OK', value: true }]).map(function (a, i) {
          return '<button type="button" class="btn ' + (a.kind === 'ghost' ? 'btn--ghost' : a.kind === 'danger' ? 'btn--danger' : '') + '" data-i="' + i + '">' + esc(a.label) + '</button>';
        }).join('') + '</div></div>';
      document.body.appendChild(back);
      var dlg = $('.dialog', back);
      var actions = opts.actions || [{ label: 'OK', value: true }];
      function close(v) { back.remove(); document.removeEventListener('keydown', onKey); resolve(v); }
      function onKey(e) { if (e.key === 'Escape') close(null); }
      document.addEventListener('keydown', onKey);
      back.addEventListener('click', function (e) { if (e.target === back) close(null); });
      $$('[data-i]', dlg).forEach(function (b) {
        b.addEventListener('click', async function () {
          var a = actions[+b.getAttribute('data-i')];
          if (a.validate) {
            var problem = await a.validate(dlg);
            if (problem) { var p = $('[data-err]', dlg); p.textContent = problem; p.hidden = false; return; }
          }
          close(typeof a.value === 'function' ? a.value(dlg) : a.value);
        });
      });
      if (opts.onOpen) opts.onOpen(dlg);
      var first = $('input, select, textarea', dlg) || $('.btn:last-child', dlg);
      if (first) first.focus();
    });
  }
  function confirmDlg(title, text, okLabel, danger) {
    return dialog({ title: title, html: '<p>' + esc(text) + '</p>', actions: [{ label: 'Abbrechen', kind: 'ghost', value: false }, { label: okLabel || 'OK', kind: danger ? 'danger' : '', value: true }] });
  }

  var WORDS = ['Kessel', 'Rohr', 'Ventil', 'Pumpe', 'Speicher', 'Flansch', 'Muffe', 'Brenner', 'Fitting', 'Zange', 'Messer', 'Lot', 'Bogen', 'Hahn', 'Filter', 'Dichtung', 'Schelle', 'Wanne', 'Sockel', 'Fliese'];
  function genPassword() {
    var r = new Uint32Array(4);
    crypto.getRandomValues(r);
    var w1 = WORDS[r[0] % WORDS.length], w2 = WORDS[r[1] % WORDS.length];
    if (w2 === w1) w2 = WORDS[(r[1] + 7) % WORDS.length];
    return w1 + '-' + String(1000 + (r[2] % 9000)) + '-' + w2 + String(10 + (r[3] % 90));
  }
  function shrinkImage(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return resolve(file);
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 2000, w = img.naturalWidth, hh = img.naturalHeight, s = Math.min(1, max / Math.max(w, hh));
        if (s === 1 && file.size < 1.5 * 1048576) { URL.revokeObjectURL(url); return resolve(file); }
        var c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(hh * s);
        var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          if (!b || b.size >= file.size) return resolve(file);
          resolve(new File([b], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  /* ============================== Daten (Supabase) ============================== */
  function createApi() {
    var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'reich-wiki-auth' }
    });
    function toEmail(u) { return String(u || '').trim().toLowerCase() + '@' + DOMAIN; }
    function unwrap(res) { if (res.error) throw res.error; return res.data; }
    function safeName(n) { return String(n || 'datei').normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-80); }
    async function fn(name, body) {
      var res = await sb.functions.invoke(name, { body: body });
      if (res.error) {
        var detail = null;
        try { detail = await res.error.context.json(); } catch (x) { /* keine Details */ }
        var e = new Error((detail && detail.error) || res.error.message);
        e.code = detail && detail.error;
        throw e;
      }
      return res.data;
    }
    return {
      session: async function () { return (await sb.auth.getSession()).data.session; },
      onAuth: function (cb) { sb.auth.onAuthStateChange(function (ev, s) { cb(ev, s); }); },
      signIn: async function (u, p) { var r = await sb.auth.signInWithPassword({ email: toEmail(u), password: p }); if (r.error) throw r.error; return r.data.session; },
      signOut: async function () { await sb.auth.signOut(); },
      changePassword: async function (pw) { var r = await sb.auth.updateUser({ password: pw }); if (r.error) throw r.error; },
      me: async function (uid) { return unwrap(await sb.from('profiles').select('*').eq('id', uid).maybeSingle()); },
      profiles: async function () { return unwrap(await sb.from('profiles').select('id, username, display_name, role, active')); },
      categories: async function () { return unwrap(await sb.from('categories').select('*').order('sort').order('name')); },
      addCategory: async function (name) { return unwrap(await sb.from('categories').insert({ name: name }).select().single()); },
      search: async function (q, n) { return unwrap(await sb.rpc('search_entries', { q: q, max_results: n || 6 })); },
      entries: async function () {
        return unwrap(await sb.from('entries').select('id, title, answer, category_id, keywords, attachments, is_example, updated_at, created_at').order('updated_at', { ascending: false }));
      },
      entry: async function (id) { return unwrap(await sb.from('entries').select('*').eq('id', id).maybeSingle()); },
      saveEntry: async function (e, uid) {
        var row = { title: e.title, answer: e.answer, category_id: e.category_id || null, keywords: e.keywords || '', attachments: e.attachments || [], is_example: !!e.is_example, updated_by: uid };
        if (e.id) return unwrap(await sb.from('entries').update(row).eq('id', e.id).select().single());
        row.created_by = uid;
        return unwrap(await sb.from('entries').insert(row).select().single());
      },
      deleteEntry: async function (id) { return unwrap(await sb.from('entries').delete().eq('id', id)); },
      upload: async function (file) {
        var path = 'eintraege/' + crypto.randomUUID() + '-' + safeName(file.name);
        unwrap(await sb.storage.from('anhaenge').upload(path, file, { contentType: file.type, upsert: false }));
        return { path: path, name: file.name, type: file.type, size: file.size };
      },
      removeFiles: async function (paths) { if (paths && paths.length) await sb.storage.from('anhaenge').remove(paths); },
      signedUrls: async function (paths) {
        if (!paths.length) return {};
        var data = unwrap(await sb.storage.from('anhaenge').createSignedUrls(paths, 3600)), map = {};
        (data || []).forEach(function (d) { if (d.signedUrl) map[d.path] = d.signedUrl; });
        return map;
      },
      ask: function (q) { return fn('frage', { question: q }); },
      myQuestions: async function (uid) { return unwrap(await sb.from('questions').select('*').eq('asked_by', uid).order('created_at', { ascending: false }).limit(100)); },
      question: async function (id) { return unwrap(await sb.from('questions').select('*').eq('id', id).maybeSingle()); },
      questions: async function (status) { return unwrap(await sb.from('questions').select('*').eq('status', status).order('created_at', { ascending: status === 'offen' }).limit(200)); },
      openCount: async function () {
        var r = await sb.from('questions').select('id', { count: 'exact', head: true }).eq('status', 'offen');
        if (r.error) throw r.error; return r.count || 0;
      },
      setQuestion: async function (id, patch) { return unwrap(await sb.from('questions').update(patch).eq('id', id)); },
      users: function (action, payload) { return fn('zugaenge', Object.assign({ action: action }, payload || {})); }
    };
  }

  /* ============================== Zustand ============================== */
  var api = null;
  var S = { session: null, me: null, people: {}, categories: [], openCount: 0 };
  function isChef() { return S.me && S.me.role === 'chef'; }
  function catName(id) { var c = S.categories.filter(function (x) { return x.id === id; })[0]; return c ? c.name : 'Ohne Kategorie'; }
  /* Foto und Funktion aus assets/team.js (nach Benutzername); ohne Foto: Initialen */
  function teamInfo(p) { var t = window.REICH_TEAM || {}; return (p && t[p.username]) || {}; }
  function avatarHtml(p, cls) {
    var t = teamInfo(p), c = 'avatar' + (cls ? ' ' + cls : '');
    if (t.photo) return '<span class="' + c + ' avatar--photo" aria-hidden="true"><img src="' + esc(t.photo) + '" alt="" width="96" height="96"></span>';
    return '<span class="' + c + '" aria-hidden="true">' + esc(initials(p && p.display_name)) + '</span>';
  }
  function roleLabel(p) { return teamInfo(p).title || (p && p.role === 'chef' ? 'Chef' : 'Mitarbeiter'); }
  function personName(id) { var p = S.people[id]; return p ? p.display_name : 'Ehemaliger Zugang'; }
  async function loadPeople() { try { (await api.profiles()).forEach(function (p) { S.people[p.id] = p; }); } catch (e) { /* optional */ } }
  async function loadCategories() { S.categories = await api.categories(); }
  async function refreshOpenCount() {
    if (!isChef()) return;
    try { S.openCount = await api.openCount(); renderNavBadge(); } catch (e) { /* egal */ }
  }

  /* ============================== Grundgerüst ============================== */
  function navItems() {
    var items = [['#/fragen', 'Fragen'], ['#/wissen', 'Wissen'], ['#/meine-fragen', 'Meine Fragen']];
    if (isChef()) items.push(['sep'], ['#/offene-fragen', 'Offene Fragen'], ['#/pflegen', 'Einträge pflegen'], ['#/zugaenge', 'Zugänge']);
    return items;
  }
  function renderShell() {
    var me = S.me;
    app.innerHTML =
      '<header class="topbar"><div class="topbar__inner">' +
      '<a class="brand" href="#/fragen" aria-label="Reich Wiki Startseite"><img src="assets/img/reich-logo.png" alt="Reich" width="118" height="34"><span class="brand__tag">Wiki</span></a>' +
      '<nav class="nav" aria-label="Hauptmenü">' + navItems().map(function (i) {
        if (i[0] === 'sep') return '<span class="nav__sep" aria-hidden="true"></span>';
        return '<a href="' + i[0] + '" data-nav="' + i[0] + '">' + esc(i[1]) + (i[0] === '#/offene-fragen' ? '<span class="badge-count" data-open-count hidden></span>' : '') + '</a>';
      }).join('') +
      '<span class="nav__sep nav__mobile-only" aria-hidden="true"></span>' +
      '<a class="nav__mobile-only" href="#/konto" data-nav="#/konto">Passwort ändern</a>' +
      '<a class="nav__mobile-only" href="#/abmelden">Abmelden (' + esc(me.display_name) + ')</a></nav>' +
      '<div class="usermenu"><button type="button" class="usermenu__btn" aria-expanded="false" aria-haspopup="true">' +
      avatarHtml(me) + '<span class="usermenu__name">' + esc(me.display_name) +
      '<small>' + esc(roleLabel(me)) + '</small></span></button>' +
      '<div class="usermenu__panel" hidden><a href="#/konto">Passwort ändern</a><button type="button" data-logout>Abmelden</button></div></div>' +
      '<button type="button" class="menu-toggle" aria-label="Menü öffnen" aria-expanded="false">' + ICON.menu + '</button>' +
      '</div></header><main class="main" id="main" tabindex="-1"></main>';

    var top = $('.topbar'), toggle = $('.menu-toggle'), ubtn = $('.usermenu__btn'), panel = $('.usermenu__panel');
    toggle.addEventListener('click', function () {
      var open = !top.classList.contains('is-open');
      top.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.innerHTML = open ? ICON.close : ICON.menu;
    });
    ubtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = panel.hidden; panel.hidden = !open; ubtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function () { panel.hidden = true; ubtn.setAttribute('aria-expanded', 'false'); });
    $('[data-logout]').addEventListener('click', logout);
    renderNavBadge();
  }
  function renderNavBadge() {
    var b = $('[data-open-count]');
    if (!b) return;
    b.textContent = S.openCount > 99 ? '99+' : String(S.openCount);
    b.hidden = !S.openCount;
  }
  function setActiveNav(hash) {
    $$('[data-nav]').forEach(function (a) {
      var target = a.getAttribute('data-nav');
      var on = hash === target || hash.indexOf(target + '/') === 0 || hash.indexOf(target + '?') === 0;
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var top = $('.topbar');
    if (top && top.classList.contains('is-open')) { top.classList.remove('is-open'); $('.menu-toggle').innerHTML = ICON.menu; }
  }
  async function logout() {
    await api.signOut();
    S.session = null; S.me = null;
    location.hash = '#/fragen';
    renderLogin();
  }

  /* ============================== Anmeldung ============================== */
  function renderLogin(message) {
    document.title = 'Anmelden – Reich Wiki';
    app.innerHTML =
      '<div class="login"><form class="card login__card" novalidate>' +
      '<img class="login__logo" src="assets/img/reich-logo.png" alt="Reich Haustechnik" width="170" height="49">' +
      '<h1>Reich Wiki</h1><p class="login__sub">Internes Wissen für das Reich-Team</p>' +
      (message ? '<p class="alert alert--info">' + esc(message) + '</p>' : '') +
      '<label class="field"><span class="field__label">Benutzername</span><input class="input" name="u" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>' +
      '<label class="field"><span class="field__label">Passwort</span><input class="input" name="p" type="password" autocomplete="current-password" required></label>' +
      '<p class="alert alert--error" data-err hidden style="margin-top:16px"></p>' +
      '<button class="btn" type="submit">Anmelden</button>' +
      '<p class="login__foot">Zugang vergessen? Bitte beim Chef melden.</p></form></div>';
    var form = $('form', app), err = $('[data-err]', app);
    form.u.focus();
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      err.hidden = true;
      var u = form.u.value.trim(), p = form.p.value;
      if (!u || !p) { err.textContent = 'Bitte Benutzername und Passwort eingeben.'; err.hidden = false; return; }
      var btn = $('button', form); btn.disabled = true; btn.textContent = 'Anmelden …';
      try {
        var s = await api.signIn(u, p);
        await startSession(s);
      } catch (x) {
        err.textContent = errText(x); err.hidden = false;
        btn.disabled = false; btn.textContent = 'Anmelden';
      }
    });
  }

  async function startSession(session) {
    S.session = session;
    var me = null;
    try { me = await api.me(session.user.id); } catch (e) { me = null; }
    if (!me || !me.active) {
      await api.signOut();
      renderLogin('Dein Zugang ist gesperrt oder noch nicht eingerichtet. Bitte wende dich an den Chef.');
      return;
    }
    S.me = me;
    S.people[me.id] = me;
    await Promise.all([loadCategories(), loadPeople()]);
    renderShell();
    refreshOpenCount();
    route();
  }

  /* ============================== Router ============================== */
  var ROUTES = [
    [/^#\/fragen$/, viewAsk],
    [/^#\/wissen$/, viewKnowledge],
    [/^#\/wissen\/(\d+)$/, viewEntry],
    [/^#\/meine-fragen$/, viewMine],
    [/^#\/offene-fragen$/, viewOpen, true],
    [/^#\/pflegen$/, viewManage, true],
    [/^#\/pflegen\/neu$/, viewEditor, true],
    [/^#\/pflegen\/(\d+)$/, viewEditor, true],
    [/^#\/zugaenge$/, viewUsers, true],
    [/^#\/konto$/, viewAccount]
  ];
  var renderToken = 0;
  function query() {
    var q = (location.hash.split('?')[1] || ''), o = {};
    q.split('&').forEach(function (kv) { if (kv) { var p = kv.split('='); o[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); } });
    return o;
  }
  function route() {
    if (!S.me) return;
    var full = location.hash || '#/fragen';
    if (full === '#/abmelden') { logout(); return; }
    var path = full.split('?')[0];
    var main = $('#main');
    if (!main) return;
    var hit = null;
    ROUTES.some(function (r) { var m = path.match(r[0]); if (m) { hit = { view: r[1], chef: r[2], args: m.slice(1) }; } return !!m; });
    if (!hit) { location.replace('#/fragen'); return; }
    if (hit.chef && !isChef()) { location.replace('#/fragen'); return; }
    setActiveNav(path);
    var token = ++renderToken;
    main.innerHTML = '<div class="thinking"><span class="spinner" aria-hidden="true"></span><span>Lädt …</span></div>';
    window.scrollTo(0, 0);
    Promise.resolve(hit.view.apply(null, [main, token].concat(hit.args))).catch(function (e) {
      if (token !== renderToken) return;
      console.error(e);
      main.innerHTML = '<div class="alert alert--error">' + esc(errText(e)) + '</div>';
    });
  }
  window.addEventListener('hashchange', route);

  /* ============================== Bausteine ============================== */
  function filesHtml(list, editable) {
    if (!list || !list.length) return '';
    return '<div class="files">' + list.map(function (f, i) {
      var isImg = /^image\//.test(f.type || '');
      return '<a class="file" href="#" data-file="' + esc(f.path) + '" target="_blank" rel="noopener">' +
        (isImg ? '<img alt="" data-thumb="' + esc(f.path) + '">' : '<span class="file__pdf">PDF</span>') +
        '<span class="file__name" title="' + esc(f.name) + '">' + esc(f.name) + '</span>' +
        (editable ? '<button type="button" class="file__rm" data-rm="' + i + '" aria-label="' + esc(f.name) + ' entfernen">×</button>' : '') + '</a>';
    }).join('') + '</div>';
  }
  async function hydrateFiles(root) {
    var paths = $$('[data-file]', root).map(function (a) { return a.getAttribute('data-file'); });
    if (!paths.length) return;
    try {
      var urls = await api.signedUrls(paths);
      $$('[data-file]', root).forEach(function (a) {
        var u = urls[a.getAttribute('data-file')];
        if (u) a.href = u;
        var img = $('img[data-thumb]', a);
        if (img && u) img.src = u;
      });
    } catch (e) { /* Vorschau nicht verfügbar */ }
  }
  function entryMeta(e) {
    return '<p class="answer__meta">' + esc(e.category || catName(e.category_id)) + ' · aktualisiert am ' + fmtDate(e.updated_at) +
      (e.is_example ? ' · <span class="tag tag--example">Beispiel</span>' : '') + '</p>';
  }
  function relatedHtml(list) {
    if (!list || !list.length) return '';
    return '<div class="related"><h3>Passt vielleicht auch:</h3>' + list.map(function (e) {
      return '<a href="#/wissen/' + e.id + '">' + esc(e.title) + '</a>';
    }).join('') + '</div>';
  }
  function entryCard(e, opts) {
    opts = opts || {};
    return '<article class="card answer">' +
      '<span class="answer__badge answer__badge--chef">' + ICON.check + 'Antwort vom Chef</span>' +
      '<h2 class="answer__title">' + esc(e.title) + '</h2>' + entryMeta(e) +
      '<div class="prose">' + md(e.answer) + '</div>' + filesHtml(e.attachments) +
      (opts.edit && isChef() ? '<div class="item__actions"><a class="btn btn--ghost btn--small" href="#/pflegen/' + e.id + '">Bearbeiten</a></div>' : '') +
      relatedHtml(opts.related) + '</article>';
  }
  function itemHtml(e) {
    return '<a class="item" href="#/wissen/' + e.id + '"><div class="item__top"><h3 class="item__title">' + esc(e.title) + '</h3>' +
      (e.is_example ? '<span class="tag tag--example">Beispiel</span>' : '') + '</div>' +
      '<p class="item__snippet">' + esc(snippet(e.answer, 180)) + '</p>' +
      '<div class="item__meta"><span>' + esc(e.category || catName(e.category_id)) + '</span><span>' + fmtDate(e.updated_at) + '</span>' +
      ((e.attachments || []).length ? '<span>' + plural(e.attachments.length, 'Anhang', 'Anhänge') + '</span>' : '') + '</div></a>';
  }

  /* ============================== Ansicht: Fragen ============================== */
  var SAMPLE_QUESTIONS = ['Wie entlüfte ich einen Heizkörper?', 'Was tun bei Gasgeruch?', 'Welcher Heizungsdruck ist normal?', 'Wer darf eine Klimaanlage befüllen?'];

  async function viewAsk(main, token, _x, preset) {
    document.title = 'Fragen – Reich Wiki';
    var entries = [];
    try { entries = await api.entries(); } catch (e) { entries = []; }
    if (token !== renderToken) return;
    var dn = String(S.me.display_name || '').trim();
    var generic = /^(chef|mitarbeiter\s*\d*)$/i.test(dn) || !dn;
    var greeting = generic ? 'Hallo! Was möchtest du wissen?' : 'Hallo ' + dn.split(/\s+/)[0] + ', was möchtest du wissen?';
    var chips = SAMPLE_QUESTIONS.slice();
    var latest = entries.slice(0, 5);

    main.innerHTML =
      '<div class="grid-2"><div>' +
      '<section class="card ask"><p class="eyebrow">Reich Wiki</p><h1>' + esc(greeting) + '</h1>' +
      '<p class="ask__sub">Stell deine Frage ganz normal. Steht die Antwort schon im Wiki, bekommst du die Antwort vom Chef. Sonst hilft dir die KI weiter, und der Chef ergänzt das Wiki.</p>' +
      '<form class="ask__form" novalidate><label class="sr-only" for="ask-q">Deine Frage</label>' +
      '<textarea id="ask-q" class="ask__input" rows="1" maxlength="1000" placeholder="z. B. Wie entlüfte ich einen Heizkörper?"></textarea>' +
      '<button class="btn" type="submit">' + ICON.send + 'Frage stellen</button></form>' +
      '<div class="chips" aria-label="Beispielfragen">' + chips.map(function (c) { return '<button type="button" class="chip" data-chip>' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<div data-suggest></div></section>' +
      '<div class="result" data-result aria-live="polite"></div></div>' +
      '<aside class="side stack"><section class="card"><h2>Neu im Wiki</h2><div class="list">' +
      (latest.length ? latest.map(function (e) { return '<a class="item" href="#/wissen/' + e.id + '"><h3 class="item__title">' + esc(e.title) + '</h3><div class="item__meta"><span>' + esc(catName(e.category_id)) + '</span></div></a>'; }).join('')
        : '<p class="muted">Noch keine Einträge.</p>') +
      '</div></section><section class="card"><h2>Kategorien</h2><div class="cat-list">' +
      S.categories.map(function (c) { return '<a class="chip" href="#/wissen?kat=' + c.id + '">' + esc(c.name) + '</a>'; }).join('') +
      '</div></section></aside></div>';

    var form = $('form', main), input = $('#ask-q', main), suggest = $('[data-suggest]', main), result = $('[data-result]', main);
    function autosize() {
      input.style.height = 'auto';
      var needed = input.scrollHeight + 4; // + Rahmen
      input.style.height = Math.min(220, needed) + 'px';
      input.style.overflowY = needed > 220 ? 'auto' : 'hidden';
    }
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });

    var asked = false; // nach dem Absenden keine Vorschläge mehr einblenden, bis neu getippt wird
    var lookup = debounce(async function (q) {
      if (asked) return;
      if (q.length < 4) { suggest.innerHTML = ''; return; }
      try {
        var hits = (await api.search(q, 4)).filter(function (h) { return h.score > 0.1; });
        if (asked || input.value.trim() !== q) return;
        suggest.innerHTML = hits.length ? '<div class="suggest"><div class="suggest__head">Direkt im Wiki gefunden</div>' + hits.map(function (h) {
          return '<a href="#/wissen/' + h.id + '"><span>' + esc(h.title) + '</span><small>' + esc(h.category || '') + '</small></a>';
        }).join('') + '</div>' : '';
      } catch (e) { suggest.innerHTML = ''; }
    }, 350);
    input.addEventListener('input', function (e) { if (e.isTrusted !== false) asked = false; lookup(input.value.trim()); });

    $$('[data-chip]', main).forEach(function (b) {
      b.addEventListener('click', function () { input.value = b.textContent; autosize(); form.requestSubmit(); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim().replace(/\s+/g, ' ');
      if (q.length < 3) { input.focus(); return; }
      asked = true;
      suggest.innerHTML = '';
      runAsk(q, result, $('button[type=submit]', form));
    });
    var pre = query().frage;
    if (pre) { input.value = pre; autosize(); form.requestSubmit(); } else { input.focus(); }
  }

  async function runAsk(q, result, btn) {
    btn.disabled = true;
    result.innerHTML = '<div class="card thinking"><span class="spinner" aria-hidden="true"></span><div><strong data-step>Ich suche im Wiki …</strong><div class="muted small">Das dauert meist nur ein paar Sekunden.</div></div></div>';
    var stepTimer = setTimeout(function () {
      var s = $('[data-step]', result);
      if (s) s.textContent = 'Die KI prüft das Wiki und formuliert eine Antwort …';
    }, 1800);
    try {
      var r = await api.ask(q);
      clearTimeout(stepTimer);
      if (r.type === 'entry') {
        result.innerHTML = entryCard(r.entry, { related: r.related, edit: true });
      } else if (r.type === 'ai') {
        result.innerHTML = '<article class="card answer"><span class="answer__badge answer__badge--ai">' + ICON.spark + (r.demo ? 'Demo-KI-Antwort · vorbereitet, nicht vom Chef geprüft' : 'KI-Antwort · noch nicht vom Chef geprüft') + '</span>' +
          '<p class="answer__q">Deine Frage: <strong>' + esc(q) + '</strong></p>' +
          '<div class="prose">' + md(r.answer) + '</div>' +
          '<p class="alert alert--info" style="margin-top:20px">Deine Frage ist beim Chef gelandet. Sobald er sie beantwortet hat, findest du seine Antwort unter <a href="#/meine-fragen">Meine Fragen</a>. Im Zweifel immer den Meister fragen.</p>' +
          relatedHtml(r.related) + '</article>';
        refreshOpenCount();
      } else {
        var why = {
          ki_nicht_eingerichtet: 'Die KI ist noch nicht eingerichtet.',
          ki_demo: 'In dieser Demo antwortet die KI nur auf ausgewählte Fragen – im echten Betrieb beantwortet sie jede Frage.',
          tageslimit: 'Du hast heute schon sehr viele Fragen gestellt – die KI pausiert bis morgen.',
          ki_fehler: 'Die KI ist gerade nicht erreichbar.',
          ki_abgelehnt: 'Die KI kann diese Frage nicht beantworten.'
        }[r.reason] || '';
        result.innerHTML = '<article class="card answer"><span class="answer__badge answer__badge--ai">Noch keine Antwort</span>' +
          '<p class="answer__q">Deine Frage: <strong>' + esc(q) + '</strong></p>' +
          '<p>Dazu steht noch nichts im Wiki. ' + esc(why) + ' <strong>Deine Frage wurde an den Chef weitergeleitet.</strong> Seine Antwort findest du später unter <a href="#/meine-fragen">Meine Fragen</a>.</p>' +
          relatedHtml(r.related) + '</article>';
        refreshOpenCount();
      }
      hydrateFiles(result);
    } catch (e) {
      clearTimeout(stepTimer);
      result.innerHTML = '<div class="alert alert--error">' + esc(errText(e)) + '</div>';
    } finally {
      btn.disabled = false;
    }
  }

  /* ============================== Ansicht: Wissen ============================== */
  async function viewKnowledge(main, token) {
    document.title = 'Wissen – Reich Wiki';
    var entries = await api.entries();
    if (token !== renderToken) return;
    var q = query(), cat = q.kat ? +q.kat : 0;
    main.innerHTML =
      '<div class="page-head"><div><p class="eyebrow">Wissen</p><h1>Alles im Wiki</h1><p>' + plural(entries.length, 'Eintrag', 'Einträge') + ' vom Chef</p></div>' +
      (isChef() ? '<a class="btn" href="#/pflegen/neu">' + ICON.plus + 'Neuer Eintrag</a>' : '') + '</div>' +
      '<div class="toolbar"><label class="sr-only" for="k-q">Im Wiki suchen</label><input id="k-q" class="input" type="search" placeholder="Im Wiki suchen …"></div>' +
      '<div class="chips" style="margin:0 0 20px" data-cats><button type="button" class="chip" data-cat="0">Alle</button>' +
      S.categories.map(function (c) { return '<button type="button" class="chip" data-cat="' + c.id + '">' + esc(c.name) + '</button>'; }).join('') + '</div>' +
      '<div class="list" data-list></div>';
    var list = $('[data-list]', main), input = $('#k-q', main);
    function render() {
      var term = input.value.trim().toLowerCase();
      var shown = entries.filter(function (e) {
        if (cat && e.category_id !== cat) return false;
        if (!term) return true;
        return (e.title + ' ' + e.keywords + ' ' + e.answer).toLowerCase().indexOf(term) >= 0;
      });
      $$('[data-cat]', main).forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-cat') === cat)); });
      list.innerHTML = shown.length ? shown.map(itemHtml).join('') :
        '<div class="empty">Nichts gefunden. ' + (term ? 'Stell die Frage doch direkt unter <a href="#/fragen?frage=' + encodeURIComponent(input.value.trim()) + '">Fragen</a>.' : '') + '</div>';
    }
    $$('[data-cat]', main).forEach(function (b) { b.addEventListener('click', function () { cat = +b.getAttribute('data-cat'); render(); }); });
    input.addEventListener('input', debounce(render, 150));
    render();
  }

  async function viewEntry(main, token, id) {
    var e = await api.entry(+id);
    if (token !== renderToken) return;
    if (!e) { main.innerHTML = '<div class="empty">Dieser Eintrag existiert nicht mehr. <a href="#/wissen">Zurück zum Wiki</a></div>'; return; }
    document.title = e.title + ' – Reich Wiki';
    var related = [];
    try { related = (await api.search(e.title + ' ' + e.keywords, 5)).filter(function (x) { return x.id !== e.id; }).slice(0, 3); } catch (x) { /* egal */ }
    if (token !== renderToken) return;
    main.innerHTML = '<p style="margin:0 0 16px"><a href="#/wissen">← Zurück zum Wiki</a></p>' + entryCard(e, { edit: true, related: related });
    hydrateFiles(main);
  }

  /* ============================== Ansicht: Meine Fragen ============================== */
  async function viewMine(main, token) {
    document.title = 'Meine Fragen – Reich Wiki';
    var list = await api.myQuestions(S.me.id);
    if (token !== renderToken) return;
    main.innerHTML = '<div class="page-head"><div><p class="eyebrow">Meine Fragen</p><h1>Fragen, die noch nicht im Wiki standen</h1>' +
      '<p>Hier siehst du, ob der Chef deine Frage schon beantwortet hat.</p></div><a class="btn" href="#/fragen">Neue Frage</a></div>' +
      '<div class="list">' + (list.length ? list.map(function (q) {
        var st = q.status;
        return '<div class="item"><div class="item__top"><h3 class="item__title">' + esc(q.question) + '</h3>' +
          '<span class="status status--' + st + '">' + (st === 'offen' ? 'Wartet auf den Chef' : st === 'erledigt' ? 'Vom Chef beantwortet' : 'Geschlossen') + '</span></div>' +
          '<div class="item__meta"><span>Gefragt am ' + fmtDateTime(q.created_at) + '</span></div>' +
          (st === 'erledigt' && q.entry_id ? '<div class="item__actions"><a class="btn btn--small" href="#/wissen/' + q.entry_id + '">Antwort vom Chef ansehen</a></div>' : '') +
          (q.ai_answer && st !== 'erledigt' ? '<details class="ai"><summary>KI-Antwort (noch nicht geprüft) anzeigen</summary><div class="prose">' + md(q.ai_answer) + '</div></details>' : '') +
          '</div>';
      }).join('') : '<div class="empty">Du hast noch keine offenen Fragen. Alles, was du gefragt hast, stand schon im Wiki.</div>') + '</div>';
  }

  /* ============================== Ansicht: Offene Fragen (Chef) ============================== */
  async function viewOpen(main, token) {
    document.title = 'Offene Fragen – Reich Wiki';
    var tab = query().status || 'offen';
    if (['offen', 'erledigt', 'verworfen'].indexOf(tab) < 0) tab = 'offen';
    var list = await api.questions(tab);
    if (token !== renderToken) return;
    var tabs = [['offen', 'Offen'], ['erledigt', 'Beantwortet'], ['verworfen', 'Verworfen']];
    main.innerHTML = '<div class="page-head"><div><p class="eyebrow">Für den Chef</p><h1>Offene Fragen</h1>' +
      '<p>Fragen aus dem Team, die das Wiki noch nicht beantworten konnte. Übernimm sie als Eintrag – dann bekommt das Team künftig deine Antwort.</p></div></div>' +
      '<div class="chips" style="margin:0 0 20px">' + tabs.map(function (t) {
        return '<a class="chip" href="#/offene-fragen?status=' + t[0] + '" aria-pressed="' + (t[0] === tab) + '">' + t[1] + '</a>';
      }).join('') + '</div><div class="list">' +
      (list.length ? list.map(function (q) {
        return '<div class="item" data-q="' + q.id + '"><div class="item__top"><h3 class="item__title">' + esc(q.question) + '</h3>' +
          '<span class="status status--' + q.status + '">' + (q.status === 'offen' ? 'Offen' : q.status === 'erledigt' ? 'Beantwortet' : 'Verworfen') + '</span></div>' +
          '<div class="item__meta"><span class="person">' + avatarHtml(S.people[q.asked_by] || null, 'avatar--xs') + esc(personName(q.asked_by)) + '</span><span>' + fmtDateTime(q.created_at) + '</span></div>' +
          (q.ai_answer ? '<details class="ai"' + (tab === 'offen' ? ' open' : '') + '><summary>Antwort der KI</summary><div class="prose">' + md(q.ai_answer) + '</div></details>' : '<p class="muted small" style="margin:10px 0 0">Die KI hat keine Antwort geliefert.</p>') +
          '<div class="item__actions">' +
          (q.status === 'offen' ? '<a class="btn btn--small" href="#/pflegen/neu?frage=' + q.id + '">Beantworten &amp; ins Wiki</a><button type="button" class="btn btn--ghost btn--small" data-discard>Verwerfen</button>' : '') +
          (q.status === 'erledigt' && q.entry_id ? '<a class="btn btn--ghost btn--small" href="#/wissen/' + q.entry_id + '">Eintrag ansehen</a>' : '') +
          (q.status === 'verworfen' ? '<button type="button" class="btn btn--ghost btn--small" data-reopen>Wieder öffnen</button>' : '') +
          '</div></div>';
      }).join('') : '<div class="empty">' + (tab === 'offen' ? 'Keine offenen Fragen – das Wiki hat auf alles eine Antwort.' : 'Hier ist noch nichts.') + '</div>') + '</div>';

    $$('[data-discard]', main).forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = +b.closest('[data-q]').getAttribute('data-q');
        if (!(await confirmDlg('Frage verwerfen?', 'Die Frage verschwindet aus der Liste „Offen“. Du kannst sie später wieder öffnen.', 'Verwerfen'))) return;
        await api.setQuestion(id, { status: 'verworfen', resolved_at: new Date().toISOString(), resolved_by: S.me.id });
        toast('Frage verworfen'); refreshOpenCount(); route();
      });
    });
    $$('[data-reopen]', main).forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = +b.closest('[data-q]').getAttribute('data-q');
        await api.setQuestion(id, { status: 'offen', resolved_at: null, resolved_by: null });
        toast('Frage wieder geöffnet'); refreshOpenCount(); route();
      });
    });
  }

  /* ============================== Ansicht: Einträge pflegen (Chef) ============================== */
  async function viewManage(main, token) {
    document.title = 'Einträge pflegen – Reich Wiki';
    var entries = await api.entries();
    if (token !== renderToken) return;
    main.innerHTML = '<div class="page-head"><div><p class="eyebrow">Für den Chef</p><h1>Einträge pflegen</h1><p>' + plural(entries.length, 'Eintrag', 'Einträge') + ' im Wiki</p></div>' +
      '<a class="btn" href="#/pflegen/neu">' + ICON.plus + 'Neuer Eintrag</a></div>' +
      '<div class="toolbar"><label class="sr-only" for="m-q">Einträge filtern</label><input id="m-q" class="input" type="search" placeholder="Einträge filtern …">' +
      '<label class="sr-only" for="m-c">Kategorie</label><select id="m-c" class="select" style="max-width:260px"><option value="0">Alle Kategorien</option>' +
      S.categories.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') + '</select></div><div class="list" data-list></div>';
    var list = $('[data-list]', main), input = $('#m-q', main), sel = $('#m-c', main);
    function render() {
      var term = input.value.trim().toLowerCase(), cat = +sel.value;
      var shown = entries.filter(function (e) {
        return (!cat || e.category_id === cat) && (!term || (e.title + ' ' + e.keywords + ' ' + e.answer).toLowerCase().indexOf(term) >= 0);
      });
      list.innerHTML = shown.length ? shown.map(function (e) {
        return '<div class="item" data-id="' + e.id + '"><div class="item__top"><h3 class="item__title">' + esc(e.title) + '</h3>' +
          (e.is_example ? '<span class="tag tag--example">Beispiel</span>' : '') + '</div>' +
          '<div class="item__meta"><span>' + esc(catName(e.category_id)) + '</span><span>aktualisiert ' + fmtDate(e.updated_at) + '</span>' +
          ((e.attachments || []).length ? '<span>' + plural(e.attachments.length, 'Anhang', 'Anhänge') + '</span>' : '') + '</div>' +
          '<div class="item__actions"><a class="btn btn--small" href="#/pflegen/' + e.id + '">Bearbeiten</a><a class="btn btn--ghost btn--small" href="#/wissen/' + e.id + '">Ansehen</a>' +
          '<button type="button" class="btn btn--danger btn--small" data-del>Löschen</button></div></div>';
      }).join('') : '<div class="empty">Keine Einträge gefunden.</div>';
      $$('[data-del]', list).forEach(function (b) {
        b.addEventListener('click', async function () {
          var id = +b.closest('[data-id]').getAttribute('data-id');
          var e = entries.filter(function (x) { return x.id === id; })[0];
          if (!(await confirmDlg('Eintrag löschen?', '„' + e.title + '“ wird mit allen Anhängen endgültig gelöscht.', 'Endgültig löschen', true))) return;
          await api.deleteEntry(id);
          await api.removeFiles((e.attachments || []).map(function (a) { return a.path; }));
          entries = entries.filter(function (x) { return x.id !== id; });
          toast('Eintrag gelöscht'); render();
        });
      });
    }
    input.addEventListener('input', debounce(render, 150));
    sel.addEventListener('change', render);
    render();
  }

  async function viewEditor(main, token, id) {
    var q = query();
    var entry = { id: null, title: '', answer: '', category_id: null, keywords: '', attachments: [], is_example: false };
    var fromQuestion = null;
    if (id) {
      var loaded = await api.entry(+id);
      if (!loaded) { main.innerHTML = '<div class="empty">Eintrag nicht gefunden.</div>'; return; }
      entry = loaded;
    } else if (q.frage) {
      fromQuestion = await api.question(+q.frage);
      if (fromQuestion) { entry.title = fromQuestion.question; entry.answer = fromQuestion.ai_answer || ''; }
    }
    if (token !== renderToken) return;
    document.title = (entry.id ? 'Eintrag bearbeiten' : 'Neuer Eintrag') + ' – Reich Wiki';
    var attachments = (entry.attachments || []).slice();
    var uploadedNow = [], removedExisting = [];

    main.innerHTML = '<p style="margin:0 0 16px"><a href="' + (fromQuestion ? '#/offene-fragen' : '#/pflegen') + '">← Zurück</a></p>' +
      '<form class="card" novalidate><p class="eyebrow">' + (entry.id ? 'Eintrag bearbeiten' : fromQuestion ? 'Frage aus dem Team beantworten' : 'Neuer Eintrag') + '</p>' +
      (fromQuestion ? '<p class="alert alert--warn">Gefragt von <strong>' + esc(personName(fromQuestion.asked_by)) + '</strong> am ' + fmtDateTime(fromQuestion.created_at) +
        '. Die Antwort unten ist der Vorschlag der KI – bitte prüfen und anpassen. Nach dem Speichern bekommt das Team deine Antwort.</p>' : '') +
      '<label class="field"><span class="field__label">Frage / Thema *</span><input class="input" name="title" maxlength="300" required value="' + esc(entry.title) + '"><span class="field__hint">So, wie ein Mitarbeiter fragen würde – z. B. „Wie entlüfte ich einen Heizkörper?“</span></label>' +
      '<label class="field"><span class="field__label">Kategorie</span><select class="select" name="cat"><option value="">Ohne Kategorie</option>' +
      S.categories.map(function (c) { return '<option value="' + c.id + '"' + (c.id === entry.category_id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') +
      '<option value="__new">+ Neue Kategorie …</option></select></label>' +
      '<label class="field"><span class="field__label">Stichworte</span><input class="input" name="keywords" value="' + esc(entry.keywords) + '" placeholder="z. B. entlüften, gluckert, wird nicht warm"><span class="field__hint">Andere Wörter, mit denen jemand danach suchen könnte. Hilft der Suche sehr.</span></label>' +
      '<div class="field"><span class="field__label" id="ans-l">Antwort *</span><div class="editor-toolbar" role="toolbar" aria-label="Formatierung">' +
      '<button type="button" data-fmt="bold" title="Fett"><strong>F</strong></button><button type="button" data-fmt="ul" title="Liste">• Liste</button>' +
      '<button type="button" data-fmt="ol" title="Nummerierte Liste">1. Schritte</button><button type="button" data-fmt="preview" aria-pressed="false">Vorschau</button></div>' +
      '<textarea class="textarea" name="answer" aria-labelledby="ans-l" maxlength="20000" required>' + esc(entry.answer) + '</textarea>' +
      '<div class="preview prose" data-preview hidden></div><span class="field__hint">Absatz = Leerzeile · Liste = Zeile mit „- “ · Schritte = „1. “ · **fett** mit zwei Sternchen</span></div>' +
      '<div class="field"><span class="field__label">Fotos &amp; PDFs</span><label class="dropzone" data-drop>' + ICON.upload +
      '<span><strong>Dateien auswählen</strong> oder hierher ziehen<br><span class="muted small">Fotos (JPG, PNG) und PDFs bis ' + MAX_UPLOAD_MB + ' MB – Fotos werden automatisch verkleinert</span></span>' +
      '<input type="file" class="sr-only" multiple accept="image/jpeg,image/png,image/webp,application/pdf"></label><div data-files></div><p class="muted small" data-upl hidden>Wird hochgeladen …</p></div>' +
      '<label class="check" style="margin-top:18px"><input type="checkbox" name="example"' + (entry.is_example ? ' checked' : '') + '> Als „Beispiel“ kennzeichnen</label>' +
      '<p class="alert alert--error" data-err hidden style="margin-top:18px"></p>' +
      '<div class="form-actions"><button class="btn" type="submit">Speichern</button><a class="btn btn--ghost" href="' + (fromQuestion ? '#/offene-fragen' : '#/pflegen') + '" data-cancel>Abbrechen</a>' +
      (entry.id ? '<button type="button" class="btn btn--danger" data-delete style="margin-left:auto">Löschen</button>' : '') + '</div></form>';

    var form = $('form', main), err = $('[data-err]', main), ta = form.answer, preview = $('[data-preview]', main);
    var filesBox = $('[data-files]', main), fileInput = $('input[type=file]', main), drop = $('[data-drop]', main), upl = $('[data-upl]', main);

    function renderFiles() {
      filesBox.innerHTML = filesHtml(attachments, true);
      $$('[data-rm]', filesBox).forEach(function (b) {
        b.addEventListener('click', function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          var f = attachments.splice(+b.getAttribute('data-rm'), 1)[0];
          if (uploadedNow.indexOf(f.path) >= 0) { api.removeFiles([f.path]); uploadedNow = uploadedNow.filter(function (p) { return p !== f.path; }); }
          else removedExisting.push(f.path);
          renderFiles();
        });
      });
      hydrateFiles(filesBox);
    }
    renderFiles();

    async function addFiles(list) {
      var files = Array.prototype.slice.call(list || []);
      if (!files.length) return;
      upl.hidden = false; err.hidden = true;
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type)) { err.textContent = '„' + f.name + '“: nur Fotos (JPG, PNG, WEBP) und PDFs.'; err.hidden = false; continue; }
        f = await shrinkImage(f);
        if (f.size > MAX_UPLOAD_MB * 1048576) { err.textContent = '„' + f.name + '“ ist größer als ' + MAX_UPLOAD_MB + ' MB.'; err.hidden = false; continue; }
        try { var meta = await api.upload(f); attachments.push(meta); uploadedNow.push(meta.path); renderFiles(); }
        catch (x) { err.textContent = 'Hochladen fehlgeschlagen: ' + errText(x); err.hidden = false; }
      }
      upl.hidden = true; fileInput.value = '';
    }
    fileInput.addEventListener('change', function () { addFiles(fileInput.files); });
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('is-over'); }); });
    drop.addEventListener('drop', function (e) { addFiles(e.dataTransfer && e.dataTransfer.files); });

    form.cat.addEventListener('change', async function () {
      if (form.cat.value !== '__new') return;
      var name = await dialog({
        title: 'Neue Kategorie', html: '<label class="field"><span class="field__label">Name</span><input class="input" name="n" maxlength="60"></label>',
        actions: [{ label: 'Abbrechen', kind: 'ghost', value: null }, {
          label: 'Anlegen', value: function (d) { return $('input', d).value.trim(); },
          validate: function (d) { return $('input', d).value.trim().length < 2 ? 'Bitte einen Namen eingeben.' : null; }
        }]
      });
      if (!name) { form.cat.value = entry.category_id || ''; return; }
      try {
        var c = await api.addCategory(name);
        await loadCategories();
        var opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name;
        form.cat.insertBefore(opt, form.cat.querySelector('option[value="__new"]'));
        form.cat.value = c.id;
      } catch (x) { form.cat.value = entry.category_id || ''; toast('Kategorie gibt es schon oder konnte nicht angelegt werden.'); }
    });

    $$('[data-fmt]', main).forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-fmt');
        if (f === 'preview') {
          var on = preview.hidden; preview.hidden = !on; ta.hidden = on; b.setAttribute('aria-pressed', String(on));
          preview.innerHTML = md(ta.value) || '<p class="muted">Noch kein Text.</p>'; return;
        }
        var s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e), rep;
        if (f === 'bold') rep = '**' + (sel || 'wichtig') + '**';
        else {
          var linesSel = (sel || 'Punkt').split('\n');
          rep = linesSel.map(function (l, i) { return (f === 'ul' ? '- ' : (i + 1) + '. ') + l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''); }).join('\n');
          if (s > 0 && ta.value[s - 1] !== '\n') rep = '\n' + rep;
        }
        ta.setRangeText(rep, s, e, 'end'); ta.focus();
      });
    });

    var saved = false;
    $('[data-cancel]', main).addEventListener('click', function () { if (!saved && uploadedNow.length) api.removeFiles(uploadedNow); });
    var del = $('[data-delete]', main);
    if (del) del.addEventListener('click', async function () {
      if (!(await confirmDlg('Eintrag löschen?', '„' + entry.title + '“ wird mit allen Anhängen endgültig gelöscht.', 'Endgültig löschen', true))) return;
      await api.deleteEntry(entry.id);
      await api.removeFiles((entry.attachments || []).map(function (a) { return a.path; }).concat(uploadedNow));
      saved = true; toast('Eintrag gelöscht'); location.hash = '#/pflegen';
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault(); err.hidden = true;
      var titleInput = form.elements.namedItem('title'), title = titleInput.value.trim(), answer = ta.value.trim();
      if (title.length < 3) { err.textContent = 'Bitte eine Frage bzw. ein Thema eingeben.'; err.hidden = false; titleInput.focus(); return; }
      if (!answer) { err.textContent = 'Bitte eine Antwort eingeben.'; err.hidden = false; ta.hidden = false; preview.hidden = true; ta.focus(); return; }
      var btn = $('button[type=submit]', form); btn.disabled = true; btn.textContent = 'Speichert …';
      try {
        var catVal = form.cat.value && form.cat.value !== '__new' ? +form.cat.value : null;
        var savedEntry = await api.saveEntry({
          id: entry.id, title: title, answer: answer, category_id: catVal, keywords: form.keywords.value.trim(),
          attachments: attachments, is_example: form.example.checked
        }, S.me.id);
        saved = true;
        if (removedExisting.length) api.removeFiles(removedExisting);
        if (fromQuestion) {
          await api.setQuestion(fromQuestion.id, { status: 'erledigt', entry_id: savedEntry.id, resolved_at: new Date().toISOString(), resolved_by: S.me.id });
          refreshOpenCount();
        }
        toast('Gespeichert – das Team sieht jetzt deine Antwort.');
        location.hash = '#/wissen/' + savedEntry.id;
      } catch (x) {
        err.textContent = errText(x); err.hidden = false; btn.disabled = false; btn.textContent = 'Speichern';
      }
    });
  }

  /* ============================== Ansicht: Zugänge (Chef) ============================== */
  async function viewUsers(main, token) {
    document.title = 'Zugänge – Reich Wiki';
    var res = await api.users('list');
    if (token !== renderToken) return;
    var users = res.users || [];
    users.forEach(function (u) { S.people[u.id] = u; });
    main.innerHTML = '<div class="page-head"><div><p class="eyebrow">Für den Chef</p><h1>Zugänge</h1><p>' + plural(users.filter(function (u) { return u.active; }).length, 'aktiver Zugang', 'aktive Zugänge') + '</p></div>' +
      '<button type="button" class="btn" data-new>' + ICON.plus + 'Neuer Zugang</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Benutzername</th><th>Name</th><th>Rolle</th><th>Status</th><th>Letzte Anmeldung</th><th><span class="sr-only">Aktionen</span></th></tr></thead><tbody>' +
      users.map(function (u) {
        return '<tr data-id="' + u.id + '"><td><strong>' + esc(u.username) + '</strong>' + (u.id === S.me.id ? ' <span class="tag">du</span>' : '') + '</td><td><span class="person">' + avatarHtml(u, 'avatar--sm') + '<span>' + esc(u.display_name) + '<small>' + esc(teamInfo(u).title || '') + '</small></span></span></td>' +
          '<td>' + (u.role === 'chef' ? '<span class="tag tag--chef">Chef</span>' : 'Mitarbeiter') + '</td>' +
          '<td>' + (u.active ? '<span class="status status--erledigt">Aktiv</span>' : '<span class="status status--verworfen">Gesperrt</span>') + '</td>' +
          '<td>' + (u.last_sign_in_at ? fmtDateTime(u.last_sign_in_at) : '<span class="muted">noch nie</span>') + '</td>' +
          '<td style="white-space:nowrap"><button type="button" class="btn btn--ghost btn--small" data-edit>Bearbeiten</button><button type="button" class="btn btn--ghost btn--small" data-pw>Passwort</button>' +
          (u.id !== S.me.id ? '<button type="button" class="btn ' + (u.active ? 'btn--danger' : '') + ' btn--small" data-lock>' + (u.active ? 'Sperren' : 'Entsperren') + '</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="muted small" style="margin-top:14px">Passwörter werden verschlüsselt gespeichert – niemand kann sie nachsehen. Wer seins vergessen hat, bekommt hier ein neues.</p>';

    function byId(id) { return users.filter(function (u) { return u.id === id; })[0]; }
    function rowUser(b) { return byId(b.closest('[data-id]').getAttribute('data-id')); }
    async function showPassword(title, username, pw) {
      await dialog({
        title: title, html: '<p>Bitte notieren und persönlich weitergeben. Das Passwort wird nur jetzt angezeigt.</p>' +
          '<p style="margin:14px 0 4px"><strong>Benutzername:</strong> ' + esc(username) + '</p><div class="secret"><span style="flex:1" data-secret>' + esc(pw) + '</span>' +
          '<button type="button" class="btn btn--ghost btn--small" data-copy>Kopieren</button></div>',
        actions: [{ label: 'Fertig', value: true }],
        onOpen: function (d) {
          $('[data-copy]', d).addEventListener('click', function () {
            if (navigator.clipboard) navigator.clipboard.writeText(pw).then(function () { toast('Kopiert'); });
          });
        }
      });
    }

    $('[data-new]', main).addEventListener('click', async function () {
      var pw = genPassword();
      var data = await dialog({
        title: 'Neuer Zugang',
        html: '<label class="field"><span class="field__label">Benutzername</span><input class="input" name="u" autocapitalize="none" spellcheck="false" placeholder="z. B. max.muster"></label>' +
          '<label class="field"><span class="field__label">Name</span><input class="input" name="n" placeholder="z. B. Max Muster"></label>' +
          '<label class="field"><span class="field__label">Rolle</span><select class="select" name="r"><option value="mitarbeiter">Mitarbeiter (fragen &amp; lesen)</option><option value="chef">Chef (alles pflegen)</option></select></label>' +
          '<label class="field"><span class="field__label">Passwort</span><input class="input" name="p" value="' + esc(pw) + '"><span class="field__hint">Vorschlag – du kannst es ändern (mind. 10 Zeichen).</span></label>',
        actions: [{ label: 'Abbrechen', kind: 'ghost', value: null }, {
          label: 'Anlegen',
          validate: async function (d) {
            try {
              await api.users('create', { username: $('[name=u]', d).value.trim().toLowerCase(), display_name: $('[name=n]', d).value.trim(), role: $('[name=r]', d).value, password: $('[name=p]', d).value });
              return null;
            } catch (x) { return errText(x); }
          },
          value: function (d) { return { u: $('[name=u]', d).value.trim().toLowerCase(), p: $('[name=p]', d).value }; }
        }]
      });
      if (!data) return;
      await showPassword('Zugang angelegt', data.u, data.p);
      route();
    });

    $$('[data-edit]', main).forEach(function (b) {
      b.addEventListener('click', async function () {
        var u = rowUser(b);
        var ok = await dialog({
          title: 'Zugang bearbeiten',
          html: '<label class="field"><span class="field__label">Benutzername</span><input class="input" name="u" value="' + esc(u.username) + '" autocapitalize="none" spellcheck="false"></label>' +
            '<label class="field"><span class="field__label">Name</span><input class="input" name="n" value="' + esc(u.display_name) + '"></label>' +
            '<label class="field"><span class="field__label">Rolle</span><select class="select" name="r"><option value="mitarbeiter"' + (u.role !== 'chef' ? ' selected' : '') + '>Mitarbeiter</option><option value="chef"' + (u.role === 'chef' ? ' selected' : '') + '>Chef</option></select></label>',
          actions: [{ label: 'Abbrechen', kind: 'ghost', value: false }, {
            label: 'Speichern', value: true,
            validate: async function (d) {
              try {
                var nu = $('[name=u]', d).value.trim().toLowerCase();
                if (nu !== u.username) await api.users('rename', { id: u.id, username: nu });
                await api.users('update', { id: u.id, display_name: $('[name=n]', d).value.trim(), role: $('[name=r]', d).value });
                return null;
              } catch (x) { return errText(x); }
            }
          }]
        });
        if (ok) { toast('Gespeichert'); if (u.id === S.me.id) { S.me = await api.me(S.me.id); renderShell(); } route(); }
      });
    });

    $$('[data-pw]', main).forEach(function (b) {
      b.addEventListener('click', async function () {
        var u = rowUser(b), pw = genPassword();
        if (!(await confirmDlg('Neues Passwort?', 'Für „' + u.username + '“ wird ein neues Passwort erzeugt. Das alte gilt dann nicht mehr.', 'Neues Passwort erzeugen'))) return;
        try { await api.users('reset_password', { id: u.id, password: pw }); await showPassword('Neues Passwort', u.username, pw); }
        catch (x) { toast(errText(x)); }
      });
    });

    $$('[data-lock]', main).forEach(function (b) {
      b.addEventListener('click', async function () {
        var u = rowUser(b), lock = u.active;
        if (!(await confirmDlg(lock ? 'Zugang sperren?' : 'Zugang entsperren?', lock ? '„' + u.username + '“ kann sich dann nicht mehr anmelden. Einträge und Fragen bleiben erhalten.' : '„' + u.username + '“ kann sich wieder anmelden.', lock ? 'Sperren' : 'Entsperren', lock))) return;
        try { await api.users('update', { id: u.id, active: !lock }); toast(lock ? 'Zugang gesperrt' : 'Zugang entsperrt'); route(); }
        catch (x) { toast(errText(x)); }
      });
    });
  }

  /* ============================== Ansicht: Konto ============================== */
  function viewAccount(main) {
    document.title = 'Passwort ändern – Reich Wiki';
    main.innerHTML = '<div class="page-head"><div><p class="eyebrow">Mein Zugang</p><h1>Passwort ändern</h1><p>Angemeldet als <strong>' + esc(S.me.username) + '</strong></p></div></div>' +
      '<form class="card" style="max-width:520px" novalidate>' +
      '<label class="field"><span class="field__label">Neues Passwort</span><input class="input" type="password" name="p1" autocomplete="new-password" minlength="10"><span class="field__hint">Mindestens 10 Zeichen.</span></label>' +
      '<label class="field"><span class="field__label">Neues Passwort wiederholen</span><input class="input" type="password" name="p2" autocomplete="new-password"></label>' +
      '<p class="alert" data-msg hidden style="margin-top:18px"></p><div class="form-actions"><button class="btn" type="submit">Passwort speichern</button></div></form>';
    var form = $('form', main), msg = $('[data-msg]', main);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      function show(kind, text) { msg.className = 'alert alert--' + kind; msg.textContent = text; msg.hidden = false; }
      if (form.p1.value.length < 10) return show('error', 'Das Passwort muss mindestens 10 Zeichen lang sein.');
      if (form.p1.value !== form.p2.value) return show('error', 'Die beiden Passwörter stimmen nicht überein.');
      var btn = $('button', form); btn.disabled = true;
      try { await api.changePassword(form.p1.value); form.reset(); show('ok', 'Dein Passwort wurde geändert.'); }
      catch (x) { show('error', errText(x)); }
      btn.disabled = false;
    });
  }

  /* ============================== Start ============================== */
  async function boot() {
    if (window.ReichWikiMockApi) api = window.ReichWikiMockApi;
    else if (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase) api = createApi();
    else {
      app.innerHTML = '<div class="login"><div class="card login__card"><img class="login__logo" src="assets/img/reich-logo.png" alt="Reich" width="170" height="49">' +
        '<h1>Reich Wiki</h1><p class="login__sub">Das Wiki ist noch nicht mit der Datenbank verbunden.</p>' +
        '<p class="alert alert--info">Bitte in <code>assets/config.js</code> die Supabase-Adresse und den öffentlichen Schlüssel eintragen.</p></div></div>';
      return;
    }
    api.onAuth(function (ev) {
      if (ev === 'SIGNED_OUT' && S.me) { S.me = null; renderLogin('Du wurdest abgemeldet.'); }
    });
    var session = null;
    try { session = await api.session(); } catch (e) { session = null; }
    if (session) await startSession(session); else renderLogin();
  }
  boot();
})();
