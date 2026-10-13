const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { FileOperations } = require('./dist/fileOps.js');

(async () => {
  const target = path.join(process.cwd(), 'tmp-overwrite-guard.txt');
  fs.writeFileSync(target, 'original');

  try {
    const f = new FileOperations();
    await assert.rejects(
      () => f.createFile('tmp-overwrite-guard.txt', 'new content'),
      /already exists/i
    );
    console.log('overwrite guard works');
  } finally {
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
