/**
 * 포밍뿌 틱 엔진 — 순수 함수, DOM 접근 금지.
 * simulate(state, elapsedSec) -> newState 가 유일한 시간 진행 경로.
 * 브라우저(window.ENGINE)와 Node(require) 양쪽에서 동작 (M1 단위 테스트용).
 */
(function (root) {
  'use strict';

  var SAVE_VERSION = 1;
  var STAT_FLOOR = 30;              // 오프라인/방치 하한 — 죽음 없음
  var OFFLINE_CAP_SEC = 8 * 3600;   // 오프라인 경과 반영 상한
  var AWAY_GREET_SEC = 3 * 3600;    // 이 이상 비웠다 돌아오면 "보고 싶었어" 연출

  // 감소 속도: (100→30까지 걸리는 시간) 기준 — 기획서 §2-1
  var DECAY_PER_SEC = {
    hunger: 70 / (8 * 3600),   // 포만감: 8시간
    love:   70 / (12 * 3600),  // 애정: 12시간
    clean:  70 / (24 * 3600)   // 청결: 24시간
  };

  // 케어 액션 정의 — care: 케어 포인트, trait: 성향 분기 축(M3)
  var ACTIONS = {
    feed:  { stat: 'hunger', amount: 35, cooldownSec: 0,        item: 'food',  care: 3, trait: 'food',  label: '밥주기',   emoji: '🍚', msg: '맛있게 먹었어요!' },
    snack: { stat: 'hunger', amount: 15, cooldownSec: 1800,     item: 'snack', care: 1, trait: 'food',  label: '간식',     emoji: '🍭', msg: '달콤해~' },
    bath:  { stat: 'clean',  amount: 45, cooldownSec: 4 * 3600, item: null,    care: 3, trait: 'clean', label: '목욕',     emoji: '🛁', msg: '깨끗해졌어요!' },
    brush: { stat: 'clean',  amount: 15, cooldownSec: 2 * 3600, item: null,    care: 1, trait: 'clean', label: '양치',     emoji: '🪥', msg: '이가 반짝!' },
    play:  { stat: 'love',   amount: 30, cooldownSec: 3600,     item: null,    care: 3, trait: 'play',  label: '놀아주기', emoji: '🎾', msg: '신나게 놀았어요!' },
    pet:   { stat: 'love',   amount: 10, cooldownSec: 1800,     item: null,    care: 1, trait: 'play',  label: '쓰다듬기', emoji: '🤗', msg: '포근해요~' }
  };

  var CHARS = {
    porongi: { name: '포롱이', img: 'assets/characters/porongi.png',
      speeches: ['포롱~ ♥', '꽃이 좋아!', '고마워~', '히히', '배고파~', '깨끗하다!'] },
    mingttu: { name: '밍뚜', img: 'assets/characters/mingttu.png',
      speeches: ['보잉보잉!', '재미있다!', '또 놀자!', '우와~', '배불러!', '신난다!'] },
    pubi:    { name: '뿌비', img: 'assets/characters/pubi.png',
      speeches: ['뿌우~', '좋아좋아', '안아줘~', '뿌비야~', '맛있다!', '졸려...'] }
  };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function defaultState(nowSec, charId) {
    return {
      version: SAVE_VERSION,
      char: charId || null,
      createdAt: nowSec,
      lastSeenAt: nowSec,
      stats: { hunger: 80, clean: 80, love: 80 },
      carePoints: 0,
      careCounts: { food: 0, play: 0, clean: 0 }, // 성향 분기 집계 (M3)
      stage: 'baby',                              // 성장은 M3에서 — M0은 고정
      coins: 50,
      inventory: { food: 3, snack: 1 },
      cooldowns: {}                               // actionId -> readyAt(epoch sec)
    };
  }

  /** 시간 경과 적용. elapsedSec는 음수 클램프 + 8시간 캡. 스탯은 하한 30. */
  function simulate(state, elapsedSec) {
    var dt = clamp(elapsedSec || 0, 0, OFFLINE_CAP_SEC);
    var s = JSON.parse(JSON.stringify(state));
    Object.keys(DECAY_PER_SEC).forEach(function (k) {
      var v = s.stats[k] - DECAY_PER_SEC[k] * dt;
      // 이미 하한 아래인 값은 더 깎지 않되 올리지도 않음
      s.stats[k] = Math.max(Math.min(s.stats[k], STAT_FLOOR), v < STAT_FLOOR ? STAT_FLOOR : v);
    });
    return s;
  }

  /** 액션 가능 여부. { ok, reason } */
  function canDoAction(state, id, nowSec) {
    var a = ACTIONS[id];
    if (!a) return { ok: false, reason: 'unknown' };
    if ((state.cooldowns[id] || 0) > nowSec) return { ok: false, reason: 'cooldown', readyAt: state.cooldowns[id] };
    if (a.item && (state.inventory[a.item] || 0) <= 0) return { ok: false, reason: 'no_item', item: a.item };
    if (state.stats[a.stat] >= 100) return { ok: false, reason: 'full' };
    return { ok: true };
  }

  /** 액션 적용. { state, ok, reason?, action } */
  function applyAction(state, id, nowSec) {
    var check = canDoAction(state, id, nowSec);
    if (!check.ok) return { state: state, ok: false, reason: check.reason, action: ACTIONS[id] };
    var a = ACTIONS[id];
    var s = JSON.parse(JSON.stringify(state));
    s.stats[a.stat] = clamp(s.stats[a.stat] + a.amount, 0, 100);
    s.carePoints += a.care;
    s.careCounts[a.trait] += 1;
    if (a.item) s.inventory[a.item] -= 1;
    if (a.cooldownSec > 0) s.cooldowns[id] = nowSec + a.cooldownSec;
    return { state: s, ok: true, action: a };
  }

  /** 저장 스키마 마이그레이션 (버전 상승 시 여기에 순차 추가) */
  function migrate(save, nowSec) {
    if (!save || typeof save !== 'object' || !save.version) return null;
    // v1 → v2 가 생기면: if (save.version === 1) { ...; save.version = 2; }
    if (save.version !== SAVE_VERSION) return null;
    return save;
  }

  var ENGINE = {
    SAVE_VERSION: SAVE_VERSION,
    STAT_FLOOR: STAT_FLOOR,
    OFFLINE_CAP_SEC: OFFLINE_CAP_SEC,
    AWAY_GREET_SEC: AWAY_GREET_SEC,
    DECAY_PER_SEC: DECAY_PER_SEC,
    ACTIONS: ACTIONS,
    CHARS: CHARS,
    defaultState: defaultState,
    simulate: simulate,
    canDoAction: canDoAction,
    applyAction: applyAction,
    migrate: migrate,
    clamp: clamp
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ENGINE;
  else root.ENGINE = ENGINE;
})(typeof self !== 'undefined' ? self : this);
