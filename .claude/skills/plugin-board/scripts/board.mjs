#!/usr/bin/env node
// plugin-board: file, update and close issues for this repository and keep the Plugins project board in step.
// Everything goes through the GitHub CLI (`gh`), using the person's own login. Needs the `project` scope:
//   gh auth refresh -s project
// Field and option names are read live from the board, so a renamed option or a new plugin needs no code change.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const REPO = 'production-ai-eng/claude-plugins';
const OWNER = 'production-ai-eng';
const PROJECT = '4';

// Board field names. The "type" field may be called Type or ItemType (GitHub reserves "Type" in some orgs).
const FIELD = { status: ['Status'], plugin: ['Plugin'], type: ['ItemType', 'Type'], priority: ['Priority'], due: ['Due', 'Target date'] };
// Repository label added alongside the board's Type, so the issue reads right outside the board too.
const TYPE_LABEL = { bug: 'bug', feature: 'enhancement', docs: 'documentation' };

function gh(args, { json = false, input } = {}) {
  let out;
  try {
    out = execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    const msg = (e.stderr || e.message || '').toString().trim();
    if (/scope|project/i.test(msg) && /permission|scope|resource not accessible/i.test(msg)) {
      die(`${msg}\n\nThe gh login needs the project scope: run  gh auth refresh -s project`);
    }
    die(msg || `gh ${args[0]} failed`);
  }
  return json ? JSON.parse(out) : out;
}

function die(msg) { console.error(`plugin-board: ${msg}`); process.exit(1); }

function parseArgs(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) opt[k] = true; else { opt[k] = next; i++; }
  }
  return { pos, opt };
}

// ---- the board ----

let _board;
function board() {
  if (_board) return _board;
  const id = gh(['project', 'view', PROJECT, '--owner', OWNER, '--format', 'json'], { json: true }).id;
  const fields = gh(['project', 'field-list', PROJECT, '--owner', OWNER, '--format', 'json', '--limit', '100'], { json: true }).fields;
  _board = { id, fields };
  return _board;
}

function field(key) {
  const f = board().fields.find((x) => FIELD[key].includes(x.name));
  if (!f) die(`the board has no ${FIELD[key].join(' / ')} field. Run: fields`);
  return f;
}

function option(key, value) {
  const f = field(key);
  const want = String(value).trim().toLowerCase();
  const o = (f.options || []).find((x) => x.name.toLowerCase() === want);
  if (!o) die(`"${value}" is not a ${f.name} option. Options: ${(f.options || []).map((x) => x.name).join(', ')}`);
  return { field: f, option: o };
}

// Validate every requested field value before anything is written, so a typo creates nothing.
function resolveFields(opt) {
  const sets = [];
  for (const key of ['status', 'plugin', 'type', 'priority']) {
    if (opt[key] === undefined) continue;
    const { field: f, option: o } = option(key, opt[key]);
    sets.push({ name: f.name, value: o.name, args: ['--field-id', f.id, '--single-select-option-id', o.id] });
  }
  if (opt.due !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(opt.due)) die(`--due must be YYYY-MM-DD, got "${opt.due}"`);
    const f = field('due');
    sets.push({ name: f.name, value: opt.due, args: ['--field-id', f.id, '--date', opt.due] });
  }
  return sets;
}

// The issue's card on this board. The board's auto-add workflow usually puts a new issue there first, and adding
// it again can fail with "Content already exists", so look the card up before adding it.
function itemFor(num) {
  const [owner, name] = REPO.split('/');
  const q = 'query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){issue(number:$n){projectItems(first:50){nodes{id project{id}}}}}}';
  const find = () => {
    const res = gh(['api', 'graphql', '-f', `query=${q}`, '-F', `o=${owner}`, '-F', `r=${name}`, '-F', `n=${num}`], { json: true });
    const issue = res.data.repository.issue;
    if (!issue) die(`#${num} is not an issue in ${REPO}`);
    const node = issue.projectItems.nodes.find((x) => x.project.id === board().id);
    return node && node.id;
  };
  const found = find();
  if (found) return found;
  const url = `https://github.com/${REPO}/issues/${num}`;
  try {
    return JSON.parse(execFileSync('gh', ['project', 'item-add', PROJECT, '--owner', OWNER, '--url', url, '--format', 'json'],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })).id;
  } catch (e) {
    const again = find(); // added by the workflow between the lookup and the add
    if (again) return again;
    die((e.stderr || e.message || '').toString().trim());
  }
}

function applyFields(num, sets) {
  if (!sets.length) return;
  const item = itemFor(num);
  for (const s of sets) gh(['project', 'item-edit', '--project-id', board().id, '--id', item, ...s.args]);
  console.log(`#${num}: ${sets.map((s) => `${s.name}=${s.value}`).join(', ')}`);
}

function body(opt) {
  if (opt['body-file']) return fs.readFileSync(opt['body-file'], 'utf8');
  if (typeof opt.text === 'string') return opt.text;
  return null;
}

// ---- commands ----

const cmds = {
  fields() {
    for (const f of board().fields) {
      if (!f.options) continue;
      console.log(`${f.name}: ${f.options.map((o) => o.name).join(', ')}`);
    }
    const d = board().fields.find((x) => FIELD.due.includes(x.name));
    console.log(d ? `${d.name}: date (YYYY-MM-DD)` : 'Due: (no date field on the board)');
  },

  find({ pos }) {
    if (!pos.length) die('find needs some title words');
    const rows = gh(['issue', 'list', '-R', REPO, '--state', 'all', '--limit', '20', '--search', pos.join(' '),
      '--json', 'number,title,state,url'], { json: true });
    if (!rows.length) return console.log('no matching issues');
    for (const r of rows) console.log(`#${r.number}  [${r.state.toLowerCase()}]  ${r.title}  ${r.url}`);
  },

  create({ opt }) {
    if (typeof opt.title !== 'string') die('create needs --title');
    for (const k of ['plugin', 'type', 'priority']) if (opt[k] === undefined) die(`create needs --${k} (run: fields)`);
    const text = body(opt);
    if (!text) die('create needs --body-file (or --text)');
    if (opt.status === undefined) opt.status = 'Backlog';
    const sets = resolveFields(opt); // fails here, before the issue exists, on any bad value
    const args = ['issue', 'create', '-R', REPO, '--title', opt.title, '--body-file', '-'];
    const label = TYPE_LABEL[String(opt.type).toLowerCase()];
    if (label) args.push('--label', label);
    const url = gh(args, { input: text }).trim().split('\n').pop();
    const num = url.split('/').pop();
    console.log(`created #${num}  ${url}`);
    applyFields(num, sets);
  },

  set({ pos, opt }) {
    const num = pos[0];
    if (!/^\d+$/.test(num || '')) die('set needs an issue number');
    const sets = resolveFields(opt);
    if (!sets.length) die('set needs at least one of --status --plugin --type --priority --due');
    applyFields(num, sets);
  },

  note({ pos, opt }) {
    const num = pos[0];
    if (!/^\d+$/.test(num || '')) die('note needs an issue number');
    const text = body(opt);
    if (!text) die('note needs --text or --body-file');
    gh(['issue', 'comment', num, '-R', REPO, '--body-file', '-'], { input: text });
    console.log(`#${num}: comment added`);
  },

  close({ pos, opt }) {
    const num = pos[0];
    if (!/^\d+$/.test(num || '')) die('close needs an issue number');
    const text = body(opt);
    if (!text) die('close needs --text "what shipped, in which plugin version"');
    const reason = opt['not-planned'] ? 'not planned' : 'completed';
    gh(['issue', 'close', num, '-R', REPO, '--reason', reason, '--comment', text]);
    console.log(`#${num}: closed (${reason})`);
    applyFields(num, resolveFields({ status: 'Done' }));
  },

  list({ opt }) {
    const data = gh(['project', 'item-list', PROJECT, '--owner', OWNER, '--format', 'json', '--limit', '500'], { json: true });
    const get = (it, key) => { for (const n of FIELD[key]) { const k = n.charAt(0).toLowerCase() + n.slice(1).replace(/ (\w)/g, (_, c) => c.toUpperCase()); if (it[k] !== undefined) return it[k]; } return ''; };
    let rows = data.items.filter((it) => it.content && it.content.number);
    if (!opt.all) rows = rows.filter((it) => get(it, 'status') !== 'Done');
    if (opt.plugin) rows = rows.filter((it) => String(get(it, 'plugin')).toLowerCase() === String(opt.plugin).toLowerCase());
    if (!rows.length) return console.log('nothing on the board matches');
    const order = (p) => { const m = /(\d)/.exec(String(p)); return m ? +m[1] : 9; };
    rows.sort((a, b) => order(get(a, 'priority')) - order(get(b, 'priority')) || a.content.number - b.content.number);
    for (const it of rows) {
      const f = ['status', 'plugin', 'type', 'priority', 'due'].map((k) => get(it, k) || '-');
      console.log(`#${it.content.number}  ${f.join(' | ')}  ${it.content.title}`);
    }
  },
};

const [cmd, ...rest] = process.argv.slice(2);
if (!cmds[cmd]) {
  console.log(`usage: node .claude/skills/plugin-board/scripts/board.mjs <command>
  fields                                   the board's fields and their options (read live)
  find <words>                             issues (open and closed) whose text matches
  create --title T --plugin P --type T --priority P [--status S] [--due YYYY-MM-DD] --body-file F
  set N [--status S] [--plugin P] [--type T] [--priority P] [--due YYYY-MM-DD]
  note N --text T | --body-file F          add a comment
  close N --text T [--not-planned]         comment, close, set Status=Done
  list [--plugin P] [--all]                what is on the board, highest priority first`);
  process.exit(cmd ? 1 : 0);
}
cmds[cmd](parseArgs(rest));
