// Tes pengecekan tanpa Discord: node scripts/test-check.js 1837849285 9046863579
const { checkMany, parseIds } = require('../src/roblox/audioChecker');

(async () => {
  const ids = parseIds(process.argv.slice(2).join(' '));
  if (!ids.length) {
    console.log('Pakai: npm run test:check -- <id> <id> ...');
    process.exit(1);
  }
  const results = await checkMany(ids, (d, t) => process.stdout.write(`\rMengecek ${d}/${t}`));
  console.log('\n');
  console.table(results.map((r) => ({ id: r.id, status: r.status, nama: r.name || '-', pembuat: r.creator || '-', catatan: r.note })));
})();
