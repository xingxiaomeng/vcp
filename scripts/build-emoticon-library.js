const fs = require('fs');
const path = require('path');

async function main() {
    const auth = Buffer.from('admin:vcp-admin-2026').toString('base64');
    const res = await fetch('http://127.0.0.1:6005/admin_api/emojis/list', {
        headers: { Authorization: `Basic ${auth}` }
    });
    const payload = await res.json();
    if (!payload?.success) {
        console.error('API failed', res.status, payload);
        process.exit(1);
    }

    const fileKey = 'vcp-local-image-key-2026';
    const baseUrl = 'http://127.0.0.1:6005';
    const library = [];

    for (const [category, filenames] of Object.entries(payload.data || {})) {
        if (!Array.isArray(filenames)) continue;
        for (const rawFilename of filenames) {
            const filename = typeof rawFilename === 'string' ? rawFilename.trim() : '';
            if (!filename) continue;
            library.push({
                url: `${baseUrl}/pw=${fileKey}/images/${encodeURIComponent(category)}/${encodeURIComponent(filename)}`,
                category,
                filename,
                searchKey: `${String(category).toLowerCase()}/${filename.toLowerCase()}`
            });
        }
    }

    const out = path.join(__dirname, '..', 'VCPChat', 'AppData', 'emoticon_library.json');
    fs.writeFileSync(out, JSON.stringify(library, null, 2));
    console.log(`Wrote ${library.length} items to ${out}`);
    console.log('Categories:', Object.keys(payload.data).map((k) => `${k}: ${payload.data[k].length}`).join(', '));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
