const fs = require('fs');
const path = require('path');

function walk(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let i = 0;
    function next() {
      let file = list[i++];
      if (!file) return done(null, results);
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            next();
          });
        } else {
          results.push(file);
          next();
        }
      });
    }
    next();
  });
}

walk(path.join(__dirname, 'client/src/pages/modules'), (err, files) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  let modifiedCount = 0;
  files.forEach(f => {
    if (!f.endsWith('.jsx')) return;
    let content = fs.readFileSync(f, 'utf8');
    let changed = false;
    
    // Replace <Link to="..." className="...">Back</Link>
    content = content.replace(/<Link\s+to="[^"]+"\s+className="([^"]+)"([^>]*)>([^<]*(?:Back|←|Cancel)[^<]*)<\/Link>/gi, (match, cls, rest, text) => {
      if (text.toLowerCase().includes('back') || text.includes('←') || text.toLowerCase().includes('cancel')) {
        changed = true;
        return `<button onClick={() => window.history.back()} className="${cls}"${rest}>${text}</button>`;
      }
      return match;
    });

    if (changed) {
      fs.writeFileSync(f, content);
      modifiedCount++;
      console.log('Modified:', f);
    }
  });
  console.log(`Done. Modified ${modifiedCount} files.`);
});
