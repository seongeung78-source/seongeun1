'use strict';

const sport = document.body.dataset.sport;
const labels = { baseball: '야구', soccer: '축구', basketball: '농구' };
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem('fieldline:' + key)) ?? fallback; }
  catch { return fallback; }
};
const save = (key, value) => localStorage.setItem('fieldline:' + key, JSON.stringify(value));
const find = (selector, root = document) => root.querySelector(selector);
const all = (selector, root = document) => [...root.querySelectorAll(selector)];
const buttonWith = text => all('button').find(button => button.textContent.includes(text));
const roster = load('roster', []);
const toast = document.createElement('div');
toast.className = 'fieldline-toast';
toast.setAttribute('role', 'status');
toast.hidden = true;
document.body.append(toast);
let toastTimer;

function notify(message) {
  toast.hidden = false;
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function dialog(title, fields, action, onSubmit) {
  const panel = document.createElement('dialog');
  panel.className = 'fieldline-dialog';
  const form = document.createElement('form');
  form.method = 'dialog';
  const heading = document.createElement('h2');
  heading.textContent = title;
  heading.className = 'font-bold';
  const actions = document.createElement('menu');
  actions.innerHTML = '<button value="cancel" formnovalidate>닫기</button>';
  if (action) {
    const submit = document.createElement('button');
    submit.value = 'submit';
    submit.textContent = action;
    actions.append(submit);
  }
  form.append(heading, ...fields, actions);
  panel.append(form);
  document.body.append(panel);
  panel.addEventListener('close', () => {
    if (panel.returnValue === 'submit') onSubmit(new FormData(form));
    panel.remove();
  });
  panel.showModal();
}

function field(label, name, options) {
  const wrapper = document.createElement('label');
  wrapper.textContent = label;
  const input = document.createElement(options ? 'select' : 'input');
  input.name = name;
  input.required = true;
  input.maxLength = 24;
  if (options) for (const [value, text] of options) input.add(new Option(text, value));
  wrapper.append(input);
  return wrapper;
}

if (sport === 'roster') {
  const form = find('#roster-form');
  const list = find('#roster-list');
  const render = () => {
    list.replaceChildren();
    if (!roster.length) list.textContent = '등록된 선수가 없습니다.';
    roster.forEach((player, index) => {
      const item = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = `${labels[player.sport]} · #${player.number} ${player.name}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '삭제';
      remove.setAttribute('aria-label', player.name + ' 삭제');
      remove.onclick = () => { roster.splice(index, 1); save('roster', roster); render(); };
      item.append(name, remove);
      list.append(item);
    });
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const name = data.get('name').trim();
    if (!name) return;
    roster.push({ sport: data.get('sport'), name, number: data.get('number') });
    save('roster', roster);
    form.elements.name.value = '';
    render();
    notify('선수를 등록했습니다.');
  });
  render();
} else {
  setupBoard();
}

function setupBoard() {
  const baseball = sport === 'baseball';
  const soccer = sport === 'soccer';
  const team = find('[aria-label="팀명"]');
  const dh = find('#dh-toggle');
  const rows = all('#batting-order-list > div');
  const benchButtons = all(baseball ? '[aria-label="선수 교체 투입"]' : soccer ? '.sub-chip' : '.bench-item-card');
  const pinElements = all(baseball ? 'main div.absolute.cursor-pointer.whitespace-nowrap' : soccer ? '.player-pitch-pin' : '.court-player-pin');
  const pins = pinElements.map(element => ({
    element,
    name: find(baseball ? '.font-body-sm' : soccer ? '.text-tactical-white' : '.font-headline-sm', element),
    number: baseball ? element.firstElementChild : find('.font-stat-counter', element),
    role: baseball ? element.children[1].firstElementChild.textContent.trim() : soccer ? element.dataset.posId.toUpperCase() : element.dataset.pos,
    left: element.style.left,
    top: element.style.top
  }));
  const bench = benchButtons.map(element => {
    const card = baseball ? element.parentElement : element;
    return {
      element,
      name: find(baseball ? '.font-body-md' : soccer ? '.text-tactical-white' : '.font-body-md', card),
      number: baseball ? null : find('.font-stat-counter', card)
    };
  });
  const initialPlayer = entry => ({
    name: entry.name.textContent.trim(),
    number: entry.number?.textContent.trim() ?? '',
    stat: entry.element.dataset.stat ?? '',
    task: entry.element.dataset.task ?? ''
  });
  const defaults = {
    players: pins.map(initialPlayer), bench: bench.map(initialPlayer),
    order: rows.map((_, index) => index), dh: dh?.checked ?? false,
    formation: '4-3-3', team: team?.value ?? (soccer ? 'FC 스트라이크' : '슬램덩크')
  };
  let state = load(sport, structuredClone(defaults));
  let selected = -1;
  const tabs = all('.formation-tab-btn');
  const formations = {
    '4-4-2': {gk:[50,88],lb:[16,72],lcb:[38,74],rcb:[62,74],rb:[84,72],cdm:[36,52],lcm:[16,46],rcm:[64,52],lw:[84,46],st:[36,20],rw:[64,20]},
    '3-5-2': {gk:[50,88],lb:[24,74],lcb:[50,76],rcb:[76,74],rb:[14,48],cdm:[86,48],lcm:[34,56],rcm:[50,40],lw:[66,56],st:[36,20],rw:[64,20]}
  };
  const positions = {
    '4-4-2': {CDM:'CM', LCM:'LM', RCM:'CM', LW:'RM', RW:'ST'},
    '3-5-2': {LB:'CB', LCB:'CB', RCB:'CB', RB:'LWB', CDM:'RWB', LCM:'CM', RCM:'CAM', LW:'CM', RW:'ST'}
  };
  const role = pin => positions[state.formation]?.[pin.role] ?? pin.role;
  const choose = index => { selected = index; render(); };
  const update = () => { save(sport, state); render(); renderExtras(); };

  function render() {
    if (team) team.value = state.team;
    if (dh) dh.checked = state.dh;
    pins.forEach((entry, index) => {
      const player = state.players[index];
      entry.name.textContent = player.name;
      if (!baseball) entry.number.textContent = player.number;
      entry.element.setAttribute('aria-label', role(entry) + ' ' + player.name);
      entry.element.setAttribute('aria-pressed', String(selected === index));
      entry.element.hidden = baseball && entry.role === 'DH' && !state.dh;
      if (soccer) {
        const pair = formations[state.formation]?.[entry.element.dataset.posId];
        entry.element.style.left = pair ? pair[0] + '%' : entry.left;
        entry.element.style.top = pair ? pair[1] + '%' : entry.top;
      }
    });
    if (baseball) {
      const batting = [...state.order];
      state.order.forEach(index => {
        const row = rows[index];
        const isDH = row.dataset.role === 'DH';
        const position = isDH && !state.dh ? 'P' : row.dataset.role;
        const pinIndex = pins.findIndex(pin => pin.role === position);
        const orderNumber = batting.indexOf(index) + 1;
        const name = find('.font-body-md', row);
        find('.font-stat-counter', row).textContent = orderNumber;
        if (pinIndex >= 0) {
          name.textContent = state.players[pinIndex].name;
          pins[pinIndex].number.textContent = position === 'P' && state.dh ? 'SP' : orderNumber;
        }
        if (isDH) row.querySelector('[data-position-label]').textContent = state.dh ? 'DH (지명타자)' : 'P (투수)';
        row.parentElement.append(row);
      });
      if (state.dh) pins.find(pin => pin.role === 'P').number.textContent = 'SP';
      const count = find('[data-field-count]');
      if (count) count.textContent = `ON-FIELD (${state.dh ? 10 : 9}명)`;
      const dhCount = find('[data-dh-count]');
      if (dhCount) dhCount.textContent = state.dh ? '9인+DH' : '9인';
      const active = selected < 0 ? pins.findIndex(pin => pin.role === 'P') : selected;
      find('[data-baseball-active]').textContent = state.players[active].name;
    }
    bench.forEach((entry, index) => {
      entry.name.textContent = state.bench[index].name;
      if (entry.number) entry.number.textContent = state.bench[index].number;
    });
    tabs.forEach(tab => {
      const active = tab.dataset.formation === state.formation;
      tab.setAttribute('aria-pressed', String(active));
      ['bg-pitch-turf', 'text-on-primary', 'shadow-md'].forEach(name => tab.classList.toggle(name, active));
      tab.classList.toggle('text-slate-muted', !active);
    });
    if (sport === 'basketball') {
      const index = Math.max(selected, 0);
      const { name, number, task, stat } = state.players[index];
      find('#activePinName').textContent = `${name} (${pins[index].role})`;
      find('#activePinNumBadge').textContent = number;
      find('#activePinStat').textContent = stat || '—';
      find('#activePinTask').textContent = task || '등록 선수';
    }
  }

  function swap(index) {
    if (selected < 0) { notify('경기장에서 교체할 선수를 먼저 선택하세요.'); return; }
    [state.players[selected], state.bench[index]] = [state.bench[index], state.players[selected]];
    selected = -1;
    update();
    notify('선수를 교체했습니다.');
  }

  function openSubstitution() {
    if (selected < 0) {
      if (!baseball && sport !== 'basketball') { notify('경기장에서 교체할 선수를 먼저 선택하세요.'); return; }
      selected = baseball ? pins.findIndex(pin => pin.role === 'P') : 0;
      render();
    }
    if (!state.bench.length) { notify('벤치에 선수를 먼저 추가하세요.'); return; }
    dialog('교체할 선수 선택', [
      field('벤치 선수', 'index', state.bench.map((player, index) => [index, player.name]))
    ], '교체', data => swap(Number(data.get('index'))));
  }

  function addSubstitute() {
    const candidates = roster.filter(player => player.sport === sport);
    const fields = [field('이름', 'name')];
    const number = field('등번호', 'number');
    number.lastElementChild.required = !baseball;
    fields.push(number);
    if (candidates.length) {
      const list = field('등록 선수', 'candidate', [['', '직접 입력'], ...candidates.map((player, index) => [index, player.name])]);
      list.lastElementChild.required = false;
      list.lastElementChild.addEventListener('change', event => {
        const player = candidates[event.target.value];
        if (!player) return;
        fields[0].lastElementChild.value = player.name;
        number.lastElementChild.value = player.number;
      });
      fields.unshift(list);
    }
    dialog('벤치 선수 추가', fields, '추가', data => {
      const name = data.get('name').trim();
      if (!name) return;
      state.bench.push({ name, number: data.get('number').trim(), task: '', stat: '' });
      selected = -1;
      update();
      notify('벤치에 선수를 추가했습니다.');
    });
  }

  function summary() {
    const players = baseball
      ? state.order.map((index, order) => {
        const position = rows[index].dataset.role;
        const pin = pins.findIndex(entry => entry.role === (position === 'DH' && !state.dh ? 'P' : position));
        return `${order + 1}. ${state.players[pin].name} (${pins[pin].role})`;
      }).concat(state.dh ? ['선발투수: ' + state.players[pins.findIndex(entry => entry.role === 'P')].name] : [])
      : pins.map((entry, index) => `${role(entry)}: ${state.players[index].name} #${state.players[index].number}`);
    return [`[${state.team || labels[sport]} 라인업]`, ...(soccer ? ['포메이션: ' + state.formation] : []),
      ...players, '', '벤치: ' + state.bench.map(player => player.name).join(', ')].join('\n');
  }

  async function copyLineup() {
    const content = summary();
    try {
      await navigator.clipboard.writeText(content);
      notify('라인업을 복사했습니다.');
    } catch {
      const contentBox = document.createElement('textarea');
      contentBox.value = content;
      contentBox.rows = 12;
      contentBox.readOnly = true;
      contentBox.setAttribute('aria-label', '라인업 텍스트');
      dialog('라인업 텍스트', [contentBox]);
      contentBox.select();
    }
  }

  async function exportImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    const lines = summary().split('\n');
    const board = pins[0].element.parentElement.parentElement;
    const ratio = board.clientWidth ? board.clientHeight / board.clientWidth : 1.25;
    const boardHeight = Math.round(500 * ratio);
    canvas.height = 170 + Math.max(lines.length * 44, boardHeight);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#131b18';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#a7ec55';
    ctx.fillRect(0, 0, canvas.width, 10);
    ctx.font = 'bold 46px system-ui';
    ctx.fillText(labels[sport] + ' 라인업', 54, 86);
    const boardX = 460;
    const boardY = 118;
    ctx.fillStyle = sport === 'basketball' ? '#a26232' : '#18543a';
    ctx.fillRect(boardX, boardY, 500, boardHeight);
    const artwork = board.querySelector('svg');
    if (artwork) {
      const svg = artwork.cloneNode(true);
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('width', '500');
      svg.setAttribute('height', String(boardHeight));
      svg.style.color = '#c4dcce';
      if (!baseball) svg.setAttribute('stroke', '#c4dcce');
      const graphic = new Image();
      graphic.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      try {
        await graphic.decode();
        ctx.drawImage(graphic, boardX, boardY, 500, boardHeight);
      } catch {
        ctx.strokeStyle = '#c4dcce';
        ctx.strokeRect(boardX + 12, boardY + 12, 476, boardHeight - 24);
      }
    }
    pins.forEach((pin, index) => {
      if (pin.element.hidden) return;
      const x = boardX + Number.parseFloat(pin.element.style.left) * 5;
      const y = boardY + Number.parseFloat(pin.element.style.top) * boardHeight / 100;
      if (!Number.isFinite(x + y)) return;
      ctx.fillStyle = '#18231f';
      ctx.fillRect(x - 48, y - 24, 96, 48);
      ctx.fillStyle = '#a7ec55';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(role(pin), x, y - 4, 88);
      ctx.fillStyle = '#eff7eb';
      ctx.font = '17px system-ui';
      ctx.fillText(state.players[index].name, x, y + 15, 88);
      ctx.textAlign = 'start';
    });
    lines.forEach((line, index) => {
      ctx.fillStyle = index === 0 ? '#a7ec55' : '#eff7eb';
      ctx.font = '28px system-ui';
      ctx.fillText(line, 56, 142 + index * 44, 365);
    });
    canvas.toBlob(blob => {
      if (!blob) { notify('이미지를 만들지 못했습니다.'); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'fieldline-' + sport + '.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  }

  pins.forEach(({ element }, index) => {
    element.dataset.fieldlinePin = '';
    if (!element.matches('button')) {
      element.tabIndex = 0;
      element.setAttribute('role', 'button');
      element.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); element.click(); }
      });
    }
    element.addEventListener('click', () => choose(selected === index ? -1 : index));
  });
  rows.forEach((row, index) => {
    const position = find('.whitespace-nowrap', row);
    position.dataset.positionLabel = '';
    row.dataset.role = position.textContent.split(' ')[0];
    row.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      const current = state.order.indexOf(index);
      const target = current + (button.getAttribute('aria-label') === '순서 올리기' ? -1 : 1);
      if (target < 0 || target >= rows.length) return;
      [state.order[current], state.order[target]] = [state.order[target], state.order[current]];
      update();
    });
  });
  if (baseball) {
    for (const span of all('span')) {
      if (span.textContent === 'ON-FIELD (10명)') span.dataset.fieldCount = '';
      if (span.textContent === '9인+DH') span.dataset.dhCount = '';
    }
    const activeLabel = all('span').find(span => span.classList.contains('font-body-md') && span.textContent.includes('(선발투수)'));
    activeLabel.dataset.baseballActive = '';
    team.addEventListener('input', () => { state.team = team.value; save(sport, state); });
    dh.addEventListener('change', () => { state.dh = dh.checked; selected = -1; update(); });
    buttonWith('타순 초기화').onclick = () => { state.order = [...defaults.order]; update(); };
    buttonWith('포지션 가이드').onclick = () => {
      const guide = document.createElement('p');
      guide.textContent = 'P 투수 · C 포수 · 1B 1루수 · 2B 2루수 · 3B 3루수 · SS 유격수 · LF 좌익수 · CF 중견수 · RF 우익수 · DH 지명타자';
      dialog('포지션 가이드', [guide]);
    };
  }
  tabs.forEach(tab => { tab.onclick = () => { state.formation = tab.dataset.formation; update(); }; });
  bench.forEach((entry, index) => { entry.element.onclick = () => swap(index); });
  const benchArea = find(soccer ? '#bench-chips-container' : baseball ? '[aria-label="선수 교체 투입"]' : '#benchContainer');
  const extras = document.createElement('div');
  extras.className = 'flex flex-wrap gap-2 mt-2';
  function renderExtras() {
    extras.replaceChildren();
    state.bench.slice(bench.length).forEach((player, index) => {
      const button = document.createElement('button');
      button.className = 'rounded-lg bg-slate-surface text-tactical-white px-3 py-2';
      button.textContent = player.name;
      button.onclick = () => swap(bench.length + index);
      extras.append(button);
    });
  }
  if (benchArea) {
    const anchor = baseball ? benchArea.parentElement.parentElement : benchArea;
    anchor.after(extras);
    renderExtras();
  }
  let addButton = find('#add-sub-btn') ?? buttonWith('선수 추가');
  if (!addButton && benchArea) {
    addButton = document.createElement('button');
    addButton.textContent = '벤치 선수 추가';
    addButton.className = 'rounded-lg bg-slate-surface text-primary px-3 py-2 my-2';
    extras.after(addButton);
  }
  addButton?.addEventListener('click', addSubstitute);
  (find('#substituteTriggerBtn') ?? buttonWith('교체'))?.addEventListener('click', openSubstitution);
  find('#toggleStrategyBtn')?.addEventListener('click', () => find('#strategyDrawer').scrollIntoView({behavior:'smooth'}));
  for (const button of all('#btn-copy-chat, #btn-export-text, #copyLineupBtn, #tactical-share-btn, [aria-label="공유하기"]')) button.onclick = copyLineup;
  for (const button of all('#btn-save-image, #btn-export-image, #exportImageBtn')) button.onclick = exportImage;
  find('[aria-label="초기화"]')?.addEventListener('click', () => { state = structuredClone(defaults); selected = -1; update(); notify('라인업을 초기화했습니다.'); });
  (find('#resetPinsBtn') ?? buttonWith('원위치'))?.addEventListener('click', () => { choose(-1); notify('기본 배치를 표시합니다.'); });
  render();
}
