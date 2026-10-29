
const fs = require('node:fs');
const path = require('node:path');
const full = require('moment-timezone/data/packed/latest.json');
const presets = ['Asia/Shanghai', 'UTC', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Tokyo', 'Asia/Singapore', 'Asia/Kolkata', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney'];
const graph = new Map();
for (const link of full.links) { const [a,b] = link.split('|'); for (const [x,y] of [[a,b],[b,a]]) { if(!graph.has(x)) graph.set(x, new Set()); graph.get(x).add(y); } }
const selected = new Set(presets);
const queue = [...selected];
for (const name of queue) for (const other of graph.get(name) || []) if (!selected.has(other)) { selected.add(other); queue.push(other); }
const zones = full.zones.filter(z => selected.has(z.split('|')[0]));
const links = full.links.filter(l => l.split('|').some(n => selected.has(n)));
const names = [...new Set([...full.zones.map(z => z.split('|')[0]), ...full.links.flatMap(l => l.split('|'))])].sort();
const dir = path.resolve(__dirname, '../src/lib');
fs.writeFileSync(path.join(dir, 'time-zone-core.json'), JSON.stringify({ version: full.version, zones, links })+'\n');
fs.writeFileSync(path.join(dir, 'time-zone-names.json'), JSON.stringify(names)+'\n');
console.log('Timezone presets: '+zones.length+' zones, '+links.length+' links; full names: '+names.length);
