// Generates Music/index.json based on subfolders inside Music/
// Each folder name becomes a track name, and the first .mp3 found is used.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MUSIC_DIR = path.join(ROOT, 'Music');
const OUT = path.join(MUSIC_DIR, 'index.json');

function isDirectory(p){
  try{ return fs.statSync(p).isDirectory(); }catch{ return false; }
}

function listMp3Files(folder){
  let files = [];
  try{
    files = fs.readdirSync(folder);
  }catch{ return []; }
  return files
    .filter(f => f.toLowerCase().endsWith('.mp3'))
    .map(f => path.join(folder, f));
}

function main(){
  if(!isDirectory(MUSIC_DIR)){
    console.error('Music folder not found:', MUSIC_DIR);
    process.exit(1);
  }

  const subdirs = fs.readdirSync(MUSIC_DIR)
    .map(name => ({ name, full: path.join(MUSIC_DIR, name) }))
    .filter(x => isDirectory(x.full) && !x.name.startsWith('.'));

  const tracks = [];

  for(const d of subdirs){
    const mp3s = listMp3Files(d.full);
    if(mp3s.length === 0) continue;

    // Use first mp3 alphabetically for determinism
    mp3s.sort((a,b)=>a.localeCompare(b));
    const first = mp3s[0];

    const rel = path.relative(ROOT, first).replace(/\\/g, '/');
    tracks.push({
      name: d.name,
      file: rel
    });
  }

  const out = { tracks };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log('Wrote', OUT);
  console.log('Tracks:', tracks.length);
}

main();
