
async function test() {
    try {
        console.log('Fetching http://localhost:3000/health ...');
        const res = await fetch('http://localhost:3000/health');
        const json = await res.json();
        console.log('Health Check:', json);
    } catch (e) {
        console.error('Connection failed:', e.message);
    }
}

test();
