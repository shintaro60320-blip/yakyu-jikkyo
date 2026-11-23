// やさしい言葉への言い換え（文字で実況・2026-11-23）
// 手打ちの実況文（「中安　無死一塁」「三ゴロ一失策」など）を、野球を少しだけ知っとる人に分かる言葉へ置き換える。
// ・AI は使わん（対応表だけ）。表に無い漢字の言葉は unknown として返す＝それだけをサーバー側の AI に頼む
// ・AI が覚えた言葉（learned）を渡すと、それも使う
// ・ブラウザ（window.Y）でも node（require）でも同じものを使う＝見る側の画面と、サーバー側の関数で判定がずれんように
(function (root) {
  'use strict';

  const POS = {
    '投': 'ピッチャー', '捕': 'キャッチャー', '一': 'ファースト', '二': 'セカンド', 'ニ': 'セカンド',
    '三': 'サード', '遊': 'ショート', '左': 'レフト', '中': 'センター', '右': 'ライト',
  };
  const P = '[投捕一二ニ三遊左中右]';
  const OF = '[左中右]';                       // 外野だけ（「左二」＝レフトへのツーベース のような略し方）
  const KNUM = { '〇': 0, '零': 0, '一': 1, '二': 2, 'ニ': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  const NUM = '(?:[0-9０-９]+|[一二ニ三四五六七八九十]+)';

  function num(s) {
    s = String(s).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    if (/^\d+$/.test(s)) return Number(s);
    if (s === '十') return 10;
    const t = s.indexOf('十');
    if (t >= 0) return (t === 0 ? 1 : KNUM[s[0]]) * 10 + (t === s.length - 1 ? 0 : KNUM[s[s.length - 1]]);
    return KNUM[s] !== undefined ? KNUM[s] : s;
  }
  const pos = c => POS[c] || c;
  const baseList = s => s.split('').map(c => num(c) + '塁').join('と');

  // 打球の結果（守備の1文字のあとに付くもの）。p＝守備のカタカナ
  const RESULTS = [
    ['内野安打', p => p + 'への内野安打（内野で止まったヒット）'],
    ['内安', p => p + 'への内野安打（内野で止まったヒット）'],
    ['適時二塁打', p => p + 'へのタイムリーツーベース（2塁まで進むヒットで点が入る）'],
    ['適時三塁打', p => p + 'へのタイムリースリーベース（3塁まで進むヒットで点が入る）'],
    ['適時打', p => p + 'へのタイムリーヒット（点が入るヒット）'],
    ['適時安打', p => p + 'へのタイムリーヒット（点が入るヒット）'],
    ['安打', p => p + 'へのヒット'],
    ['安', p => p + 'へのヒット'],
    ['二塁打', p => p + 'へのツーベースヒット（2塁まで進む）'],
    ['三塁打', p => p + 'へのスリーベースヒット（3塁まで進む）'],
    ['本塁打', p => p + 'へのホームラン'],
    ['ゴロ併殺打', p => p + 'ゴロでダブルプレー（2人アウト）'],
    ['ゴロ併殺', p => p + 'ゴロでダブルプレー（2人アウト）'],
    ['併殺打', p => p + 'ゴロでダブルプレー（2人アウト）'],
    ['併殺', p => p + 'ゴロでダブルプレー（2人アウト）'],
    ['ゴロ', p => p + 'ゴロ（アウト）'],
    ['邪飛', p => p + 'のファウルフライ（アウト）'],
    ['犠飛', p => p + 'への犠牲フライ（打った人はアウト・その間にランナーがホームイン）'],
    ['飛', p => p + 'フライ（アウト）'],
    ['直', p => p + 'ライナー（直接とられてアウト）'],
    ['犠打', p => p + 'への送りバント（打った人はアウト・ランナーが進む）'],
    ['野選', p => p + 'のフィルダースチョイス（別のランナーをアウトにしにいって、みんなセーフ）'],
    ['悪送球', p => p + 'の送球ミス'],
    ['失策', p => p + 'のエラー'],
    ['失', p => p + 'のエラー'],
  ];
  // 外野だけに許す短い書き方（内野の「一二」「二三」は塁の並びと紛れるので外す）
  const OF_RESULTS = [
    ['二塁', p => p + 'へのツーベースヒット（2塁まで進む）'],
    ['三塁', p => p + 'へのスリーベースヒット（3塁まで進む）'],
    ['二', p => p + 'へのツーベースヒット（2塁まで進む）'],
    ['三', p => p + 'へのスリーベースヒット（3塁まで進む）'],
    ['本', p => p + 'へのホームラン'],
  ];

  // 決まった言葉（長い方が先に当たる＝下で最長一致にしとる）
  const WORDS = {
    '空振り三振': '空振りの三振（アウト）', '空振三振': '空振りの三振（アウト）', '見逃し三振': '見逃しの三振（アウト）', '見逃三振': '見逃しの三振（アウト）',
    '三振': '三振（アウト）', '振り逃げ': '振り逃げ（三振やけどキャッチャーがとれず1塁へ）',
    '四球': 'フォアボール（1塁へ）', '死球': 'デッドボール（体に当たって1塁へ）', '敬遠': 'わざとフォアボール（敬遠）',
    '打撃妨害': '打撃妨害（キャッチャーのミットがバットに当たって1塁へ）', '走塁妨害': '走塁妨害（守る人がランナーのじゃまをして進塁）',
    '盗塁悪送球': '盗塁して、送球ミスでさらに進む', '盗塁死': '盗塁失敗（アウト）', '盗塁失敗': '盗塁失敗（アウト）',
    '盗塁': '盗塁（次の塁へ走ってセーフ）', '重盗': 'ダブルスチール（2人同時に盗塁）',
    '牽制死': 'けん制でアウト', '牽制悪送球': 'けん制の送球ミスで進む', '走塁死': '走っとる途中でアウト',
    '暴投': 'ワイルドピッチ（ピッチャーの球がそれて進む）', '捕逸': 'パスボール（キャッチャーが後ろにそらして進む）',
    'ボーク': 'ボーク（ピッチャーの反則でランナーが進む）',
    '犠打': '送りバント（打った人はアウト・ランナーが進む）', '犠飛': '犠牲フライ（打った人はアウト・その間にランナーがホームイン）',
    '野選': 'フィルダースチョイス（別のランナーをアウトにしにいって、みんなセーフ）',
    '併殺打': 'ダブルプレー（2人アウト）', '併殺': 'ダブルプレー（2人アウト）', '三重殺': 'トリプルプレー（3人アウト）',
    '押し出し': '押し出し（フォアボールで点が入る）', '適時打': 'タイムリーヒット（点が入るヒット）',
    '本塁打': 'ホームラン', '三塁打': 'スリーベースヒット（3塁まで進む）', '二塁打': 'ツーベースヒット（2塁まで進む）',
    '安打': 'ヒット', '単打': 'ヒット', '長打': '長打（2塁より先まで進むヒット）', '内野安打': '内野安打（内野で止まったヒット）',
    '失策': 'エラー', '悪送球': '送球ミス', '好捕': 'ナイスキャッチ', '好守': 'ナイスプレー', '好返球': 'ナイス送球',
    '本塁死': 'ホームでアウト', '本塁憤死': 'ホームでアウト', '本塁': 'ホーム', '生還': 'ホームイン（1点）',
    '進塁': '次の塁へ進む', '残塁': '残塁（ランナーを残して攻撃終了）', '三者凡退': '3人で攻撃終了',
    '三者三振': '3人連続三振', '走者なし': 'ランナーなし', '走者': 'ランナー', '打者': 'バッター', '先頭打者': '先頭バッター',
    '投手交代': 'ピッチャー交代', '選手交代': '選手の交代', '守備交代': '守る人の交代', '守備変更': '守る位置の入れ替え',
    '代打': '代打（打つ人の交代）', '代走': '代走（走る人の交代）', 'リエントリー': 'リエントリー（一度下がった選手がもう一度出る）',
    '三死チェンジ': 'スリーアウトで攻守交代', '三死ゲームセット': 'スリーアウトで試合終了', 'チェンジ': '攻守交代',
    'ゲームセット': '試合終了', '試合終了': '試合終了', 'コールド': 'コールドゲーム（点差で試合終了）', 'サヨナラ': 'サヨナラ（後攻の勝ちで試合終了）',
    '先制': '先に点を取った', '同点': '同点', '逆転': '逆転', '勝ち越し': '勝ち越し（リードした）', '追加点': '追加の点',
    '投手': 'ピッチャー', '捕手': 'キャッチャー', '一塁手': 'ファースト', '二塁手': 'セカンド', '三塁手': 'サード', '遊撃手': 'ショート',
    '左翼手': 'レフト', '中堅手': 'センター', '右翼手': 'ライト', '左翼': 'レフト', '中堅': 'センター', '右翼': 'ライト',
    '左中間': 'レフトとセンターの間', '右中間': 'センターとライトの間', '三遊間': 'サードとショートの間', '二遊間': 'セカンドとショートの間',
    '一二塁間': 'ファーストとセカンドの間', '内野': '内野', '外野': '外野', '初球': '1球目', '先発': '先発（最初に投げる）',
    '完投': '最後まで1人で投げた', '続投': 'そのまま投げ続ける', '継投': 'ピッチャーをつなぐ', '球審': '審判',
    '無死': 'ノーアウト', '一死': 'ワンアウト', '二死': 'ツーアウト', 'ニ死': 'ツーアウト', '三死': 'スリーアウト',
    '満塁': 'ランナー満塁（全部の塁にランナー）',
    'EDH': 'EDH（守らずに打つだけの選手）', '指名打者': '指名打者（守らずに打つだけの選手）',
    '規定時間': '決められた時間になったので', '時間切れ': '時間切れ',
  };

  // 調べんでよい漢字（大会の見出しなどに出る普通の言葉）
  const PLAIN = new Set(['開始', '日目', '月', '日', '時', '分', '大会', '試合', '今日', '本日', '応援', '球場', '回戦', '決勝', '準決勝', '練習試合', '先攻', '後攻', '点', '対', '番', '回', '表', '裏', '杯', '戦', '選手', '庄原']);

  const OUTS = '(無|一|二|ニ|ノー|ワン|ツー)(?:死|アウト)';
  const BASES = '(満塁|走者なし|[一二ニ三]{1,3}塁)';
  const RULES = [];
  // k＝言葉の種類（画面で並べ方を変えるため）：play＝何をした／sit＝アウトと塁／num＝打順／score＝点／inning＝回／raw＝そのまま
  const rule = (src, fn, k) => RULES.push({ re: new RegExp(src, 'y'), fn, k: k || 'play' });

  // アウトと塁（「無死一三塁」「二死走者なし」「一死満塁」）
  // sep＝前の言葉にくっついとったら（「盗塁二死三塁」）間を空ける
  RULES.push({ re: new RegExp(OUTS + '[\\s　]*' + BASES, 'y'), fn: m => outsWord(m[1]) + '　' + basesWord(m[2]), sep: true, k: 'sit' });
  RULES.push({ re: /(無|一|二|ニ|三)死(?!球)/y, fn: m => ({ '無': 'ノーアウト', '一': 'ワンアウト', '二': 'ツーアウト', 'ニ': 'ツーアウト', '三': 'スリーアウト' })[m[1]], sep: true, k: 'sit' });
  rule('([一二ニ三]{2,3})塁', m => 'ランナー' + baseList(m[1]), 'sit');
  rule('([一二ニ三])塁(?![手間打])', m => num(m[1]) + '塁');
  // ランナー（「二走」「二走者本塁死」）
  rule('([一二ニ三])走者?(本塁死|本塁憤死|死|アウト)', m => num(m[1]) + '塁ランナーが' + (m[2] === '死' || m[2] === 'アウト' ? 'アウト' : 'ホームでアウト'));
  rule('([一二ニ三])走者?', m => num(m[1]) + '塁ランナー');
  // 回（「一回表」「五回」「四回戦」）
  rule('(' + NUM + ')回(表|裏)', m => num(m[1]) + '回の' + m[2], 'inning');
  rule('(' + NUM + ')回戦', m => num(m[1]) + '回戦', 'raw');
  rule('(' + NUM + ')回(?![表裏戦])', m => num(m[1]) + '回', 'raw');
  // 点（「＋１」「1失点」「3安打」）
  rule('[+＋](' + NUM + ')', m => '（' + num(m[1]) + '点）', 'score');
  rule('(' + NUM + ')失点', m => num(m[1]) + '点を取られた');
  rule('(' + NUM + ')安打', m => 'ヒット' + num(m[1]) + '本');
  rule('(' + NUM + ')打点', m => num(m[1]) + '打点（バッターが入れた点）');
  // 打順の丸数字（「①谷原」＝1番バッター）
  rule('([①-⑳])', m => (m[1].charCodeAt(0) - 0x245F) + '番　', 'num');
  rule('([0-9０-９]{1,2})番(?![目手])[\\s　]*', m => num(m[1]) + '番　', 'num');   // 「4番寺上」の「番」を名前から切り離す
  // 打球のあとにエラー（「三ゴロ一失策」＝サードゴロをファーストがエラー）
  rule('(' + P + ')(ゴロ|飛|直|邪飛)(' + P + ')?(失策|失|悪送球)', m => {
    const kind = { 'ゴロ': 'ゴロ', '飛': 'フライ', '直': 'ライナー', '邪飛': 'ファウルフライ' }[m[2]];
    return pos(m[1]) + kind + '、' + pos(m[3] || m[1]) + 'のエラーでセーフ';
  });
  // 守備＋結果（「中安」「遊直」「左二塁打」）
  for (const [w, fn] of RESULTS) rule('(' + P + ')' + w, m => fn(pos(m[1])));
  for (const [w, fn] of OF_RESULTS) rule('(' + OF + ')' + w + '(?![塁手間])', m => fn(pos(m[1])));
  // 交代の守備（「右　延近→横川」「一→寺上」）＝行の頭や空白のあと・矢印の前の1文字
  // 守備の1文字のすぐあとは空白か矢印（「三宅→」の「三」は名前の一部なので当てん）
  RULES.push({ re: new RegExp('(' + P + ')(?=[\\s　]+[^\\s　→]{1,8}→|→)', 'y'), fn: m => pos(m[1]), headOnly: true });
  // 決まった言葉
  const SIT_WORDS = new Set(['無死', '一死', '二死', 'ニ死', '三死', '満塁', '走者なし', '三死チェンジ', '三死ゲームセット', 'チェンジ', 'ゲームセット', '試合終了']);
  for (const w of Object.keys(WORDS)) rule(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), () => WORDS[w], SIT_WORDS.has(w) ? 'sit' : 'play');

  function outsWord(o) { return { '無': 'ノーアウト', 'ノー': 'ノーアウト', '一': 'ワンアウト', 'ワン': 'ワンアウト', '二': 'ツーアウト', 'ニ': 'ツーアウト', 'ツー': 'ツーアウト' }[o]; }
  function basesWord(b) {
    if (b === '満塁') return 'ランナー満塁（全部の塁にランナー）';
    if (b === '走者なし') return 'ランナーなし';
    return 'ランナー' + baseList(b.slice(0, -1));
  }

  const HAN = /[㐀-鿿豈-﫿々]+/g;
  // 名前とみなす場所（AI に送らん）：打順の丸数字・「1番」のあと／交代の矢印の前後／代打・代走のあと
const NAME_BEFORE = /([①-⑳→🆚↔]|[0-9０-９]番|代打|代走)[\s　]*$/;

  // text を置き換える。learned＝{ 言葉: 言い換え }（AI が覚えた分）
  // 返す物：{ text: 置き換えた文, unknown: [調べたい言葉], changed: 置き換えが起きたか }
  function convert(text, learned) {
    learned = learned || {};
    const src = String(text || '');
    const out = [];
    const unknown = [];
    let plain = '', plainStart = 0, changed = false;
    const flush = (end) => {
      if (!plain) return;
      out.push({ k: 'raw', s: fixPlain(plain, plainStart, src, learned, unknown) });
      plain = '';
    };
    let i = 0;
    while (i < src.length) {
      const head = i === 0 || /[\s　\n]/.test(src[i - 1]);
      let best = null;
      for (const r of RULES) {
        if (r.headOnly && !head) continue;
        r.re.lastIndex = i;
        const m = r.re.exec(src);
        if (m && m[0].length && (!best || m[0].length > best.m[0].length)) best = { r, m };
      }
      if (best) {
        flush(i);
        if (best.r.sep && i > 0 && !/[\s　]/.test(src[i - 1])) out.push({ k: 'raw', s: '　' });
        out.push({ k: best.r.k || 'play', s: best.r.fn(best.m) });
        changed = true;
        i += best.m[0].length;
      } else {
        if (!plain) plainStart = i;
        plain += src[i];
        i++;
      }
    }
    flush(src.length);
    const res = out.map(p => p.s).join('');
    return { text: res, parts: out, unknown: Array.from(new Set(unknown)), changed: changed || res !== src };
  }

  // 置き換わらんかった所：AI が覚えた言葉を当て、残った漢字の言葉を unknown に集める
  function fixPlain(s, start, src, learned, unknown) {
    return s.replace(HAN, (w, off) => {
      if (PLAIN.has(w) || w.length < 2 || w.length > 8) return w;   // 1文字（「西ノ島」の西など）は当て推量になるので調べん
      const before = src.slice(Math.max(0, start + off - 6), start + off);
      const after = src[start + off + w.length] || '';
      const rest = src.slice(start + off + w.length, start + off + w.length + 4);
      if (NAME_BEFORE.test(before) || after === '→') return w;
      if (/^[ \t　]+[0-9０-９×xX]/.test(rest)) return w;   // 同じ行の中だけ（次の行の「4番」は見ん）   // スコア表の「鳥取　１０２２」＝チーム名   // 名前（打順の丸数字のあと・交代の矢印の前後）は調べん
      // 覚えた言葉は名前・チーム名の場所には当てん（よそで覚えた「鳥取」がスコア表で化けんように）
      if (Object.prototype.hasOwnProperty.call(learned, w)) return learned[w];
      unknown.push(w);
      return w;
    });
  }

  // 見る人の画面用：1行ずつ「誰が（打順と名前）／何をした／点／今の状況」に分ける（とと 2026-11-23「パッと見た時の見やすさを優先」）
  // 返す物：[{ type:'raw'|'heading'|'play', text, who, what, score, sit }]
  function layout(text, learned) {
    const res = [];
    const tidy = s => s.replace(/[\s　]+/g, ' ').trim();
    for (const line of String(text || '').split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parts = convert(line, learned).parts;
      const kinds = new Set(parts.filter(p => p.k !== 'raw' || p.s.trim()).map(p => p.k));
      const isPlay = ['play', 'sit', 'num', 'score'].some(k => kinds.has(k));
      if (!isPlay) {
        const whole = parts.map(p => p.s).join('');
        if (kinds.has('inning') && kinds.size === 1) res.push({ type: 'heading', text: tidy(whole) });
        else res.push({ type: 'raw', text: whole.replace(/\s+$/, '') });
        continue;
      }
      let who = '', what = '', i = 0;
      const score = [], sit = [];
      if (parts[0] && parts[0].k === 'num') {
        who = tidy(parts[0].s); i = 1;
        // 打順のすぐあとの名前（「谷原　」）。名前のあとに続く言葉は「何をした」へ
        if (parts[1] && parts[1].k === 'raw') {
          const m = parts[1].s.match(/^[\s　]*([^\s　]+)(?:[\s　]+([\s\S]*))?$/);
          if (m && (m[2] !== undefined || parts.length > 2)) { who += ' ' + m[1]; what += (m[2] || ''); i = 2; }
        }
      }
      for (; i < parts.length; i++) {
        const p = parts[i];
        if (p.k === 'score') score.push(p.s.replace(/[（）]/g, ''));
        else if (p.k === 'sit') sit.push(tidy(p.s).replace(/ /g, '・'));
        else what += (p.k === 'raw' ? p.s : ' ' + p.s + ' ');
      }
      // 交代の「ピッチャー → 谷原」は1組ずつ行を分ける
      // 「EDH フォアボール」の EDH は打った人の側に出す
      if (!who) { const e = tidy(what).match(/^(EDH（[^）]*）)\s*(.*)$/); if (e) { who = e[1]; what = e[2]; } }
      what = tidy(what).replace(/ ?→ ?/g, ' → ').replace(/ (?=[^ ]+ → )/g, '\n');
      res.push({ type: 'play', who, what, score: score.join('・'), sit: sit.join('・') });
    }
    return res;
  }

  // サーバーの辞書のキーに使えん文字（. $ # [ ] /）をよける
  function dictKey(w) { return String(w).replace(/[.$#[\]/%]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()); }
  function fromDict(dict) {
    const o = {};
    for (const k of Object.keys(dict || {})) {
      const v = dict[k];
      if (v && typeof v.from === 'string' && typeof v.to === 'string') o[v.from] = v.to;
    }
    return o;
  }

  const Y = { convert, layout, dictKey, fromDict, WORDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Y;
  else root.Y = Y;
})(typeof window !== 'undefined' ? window : globalThis);
