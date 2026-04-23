const { spawn } = require('child_process');

const apps = [
  { name: '9nau-api', color: '\x1b[34m' },
  { name: 'nauthenticity', color: '\x1b[32m' },
  { name: 'flownau', color: '\x1b[35m' },
  { name: 'whatsnau-app-1', color: '\x1b[36m' },
  { name: 'zazu', color: '\x1b[33m' }
];

apps.forEach(app => {
  const p = spawn('ssh', ['nau', 'docker logs -f --tail 10 ' + app.name]);
  p.stdout.on('data', d => {
    const lines = d.toString().split('\n');
    lines.forEach(line => {
      if(line.trim()) process.stdout.write(`${app.color}[${app.name.padEnd(15)}]\x1b[0m ${line}\n`);
    });
  });
  p.stderr.on('data', d => {
    const lines = d.toString().split('\n');
    lines.forEach(line => {
      if(line.trim()) process.stdout.write(`${app.color}[${app.name.padEnd(15)}]\x1b[0m ${line}\n`);
    });
  });
});
