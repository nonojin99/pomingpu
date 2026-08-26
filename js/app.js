/**
 * 포밍뿌 UI/상태 관리 — 엔진(ENGINE)만 통해 상태를 바꾼다.
 */
(function () {
  'use strict';

  var SAVE_KEY = 'pomingpu_v1';
  var state = null;
  var lastTick = nowSec();

  function nowSec() { return Math.floor(Date.now() / 1000); }
  function $(id) { return document.getElementById(id); }

  // ---------- 저장/로드 ----------
  function save() {
    if (!state) return;
    state.lastSeenAt = nowSec();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return ENGINE.migrate(JSON.parse(raw), nowSec());
    } catch (e) { return null; }
  }

  // ---------- UI ----------
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  function speak(text) {
    var s = $('speech');
    s.textContent = text;
    s.classList.add('show');
    clearTimeout(speak._t);
    speak._t = setTimeout(function () { s.classList.remove('show'); }, 1600);
  }

  function randomSpeech() {
    var c = ENGINE.CHARS[state.char];
    speak(c.speeches[Math.floor(Math.random() * c.speeches.length)]);
  }

  function bouncePet() {
    var pet = $('pet-img');
    pet.classList.remove('bounce');
    void pet.offsetWidth;
    pet.classList.add('bounce');
  }

  function fmtCooldown(sec) {
    if (sec >= 3600) return Math.ceil(sec / 3600) + '시간';
    return Math.max(1, Math.ceil(sec / 60)) + '분';
  }

  function render() {
    if (!state) return;
    var c = ENGINE.CHARS[state.char];
    $('pet-name').textContent = c.name;
    $('pet-img').src = c.img;
    $('coins').textContent = state.coins;
    $('care-points').textContent = state.carePoints;

    ['hunger', 'clean', 'love'].forEach(function (k) {
      var v = Math.round(state.stats[k]);
      $(k + '-bar').style.width = v + '%';
      $(k + '-val').textContent = v;
    });

    // 방치 비주얼(간단판): 스탯 하나라도 45 미만이면 시무룩
    var sad = Object.keys(state.stats).some(function (k) { return state.stats[k] < 45; });
    $('pet-img').classList.toggle('sad', sad);

    // 액션 버튼 상태
    var t = nowSec();
    document.querySelectorAll('.action-btn').forEach(function (btn) {
      var chk = ENGINE.canDoAction(state, btn.dataset.action, t);
      btn.classList.toggle('disabled', !chk.ok);
      var sub = btn.querySelector('.sub');
      if (!chk.ok && chk.reason === 'cooldown') sub.textContent = fmtCooldown(chk.readyAt - t);
      else if (!chk.ok && chk.reason === 'no_item') sub.textContent = '없음';
      else if (!chk.ok && chk.reason === 'full') sub.textContent = '충분해요';
      else if (btn.dataset.action === 'feed') sub.textContent = '밥 ' + (state.inventory.food || 0) + '개';
      else if (btn.dataset.action === 'snack') sub.textContent = '간식 ' + (state.inventory.snack || 0) + '개';
      else sub.textContent = '';
    });
  }

  // ---------- 시간 진행 ----------
  function tick() {
    var t = nowSec();
    var dt = t - lastTick;
    lastTick = t;
    if (dt <= 0) return;
    state = ENGINE.simulate(state, dt);
    render();
  }

  /** 시작/복귀 시 오프라인 경과 반영 */
  function catchUp() {
    var t = nowSec();
    var away = t - (state.lastSeenAt || t);
    state = ENGINE.simulate(state, away);
    lastTick = t;
    if (away >= ENGINE.AWAY_GREET_SEC) {
      state.coins += 5; // 복귀 선물 (임시 수치)
      setTimeout(function () {
        speak(ENGINE.CHARS[state.char].name + '가 보고 싶었대요!');
        toast('복귀 선물 🪙 +5');
      }, 500);
    }
    save();
    render();
  }

  // ---------- 화면 전환 ----------
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    $(id + '-screen').classList.add('active');
  }

  // ---------- 캐릭터 선택 ----------
  var selected = null;
  document.querySelectorAll('.char-card').forEach(function (card) {
    card.addEventListener('click', function () {
      document.querySelectorAll('.char-card').forEach(function (c) { c.classList.remove('selected'); });
      card.classList.add('selected');
      selected = card.dataset.char;
      $('start-btn').classList.add('enabled');
    });
  });

  $('start-btn').addEventListener('click', function () {
    if (!selected) return;
    state = ENGINE.defaultState(nowSec(), selected);
    lastTick = nowSec();
    save();
    showScreen('home');
    render();
    toast(ENGINE.CHARS[selected].name + '와 함께 시작! ♥');
    setTimeout(function () { speak('안녕!'); }, 400);
  });

  $('reset-btn').addEventListener('click', function () {
    if (confirm('정말 모든 데이터를 지울까요?')) {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    }
  });

  // ---------- 케어 액션 ----------
  document.querySelectorAll('.action-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var r = ENGINE.applyAction(state, btn.dataset.action, nowSec());
      if (!r.ok) {
        if (r.reason === 'cooldown') toast('조금 있다가 다시 해줘요');
        else if (r.reason === 'no_item') toast('아이템이 없어요! (상점은 M4에서)');
        else if (r.reason === 'full') toast('지금은 충분해요!');
        return;
      }
      state = r.state;
      bouncePet();
      randomSpeech();
      toast(r.action.msg + ' ' + r.action.emoji);
      save();
      render();
    });
  });

  $('pet-img').addEventListener('click', function () {
    bouncePet();
    randomSpeech();
  });

  // ---------- 수명주기 ----------
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) save();
    else if (state) catchUp();
  });
  window.addEventListener('pagehide', save);
  setInterval(tick, 30 * 1000);

  // ---------- 초기화 ----------
  state = load();
  if (state && state.char) {
    showScreen('home');
    catchUp();
  } else {
    state = null;
    showScreen('select');
  }

  // ---------- PWA ----------
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
