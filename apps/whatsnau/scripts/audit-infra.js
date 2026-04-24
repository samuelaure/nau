
const fs = require('fs');

const FILE = process.argv[2] || './docker-compose.yml';

if (!fs.existsSync(FILE)) {
    console.log(`[PASS] ${FILE} not found, skipping check.`);
    process.exit(0);
}

const content = fs.readFileSync(FILE, 'utf8');

// Known Database Ports that should NOT be exposed
const DANGEROUS_PORTS = [
    '5432:',  // Postgres
    '6379:',  // Redis
    '27017:', // Mongo
    '3306:',  // MySQL
    '9200:',  // Elastic
    '5672:',  // RabbitMQ
];

let failed = false;

DANGEROUS_PORTS.forEach(port => {
    if (content.includes(`- "${port}`)) {
        console.error(`[FAIL] Found potentially exposed port: - "${port}..."`);
        failed = true;
    }
    // Check variations like 'port: port' without quotes, or different spacing
    const regex = new RegExp(`-\\s+['"]?${port}\\d+['"]?:['"]?\\d+['"]?`);
    if (regex.test(content)) {
        console.error(`[FAIL] Found potentially exposed port mapping matching ${port}`);
        failed = true;
    }
});

if (failed) {
    console.error('\nERROR: Database ports appear to be exposed in docker-compose.yml!');
    console.error('       This is a security risk. Remove "ports:" for databases.');
    process.exit(1);
} else {
    console.log('[PASS] No common database ports exposed.');
}
