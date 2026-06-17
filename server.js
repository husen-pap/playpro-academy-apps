const express = require('express');
const path = require('path'); // 💡 Mengatasi eror 'path is not defined'
const app = express();

app.use(express.json());
// 💡 Mengamankan jalur folder static agar terbaca di laptop maupun server hosting
app.use(express.static(path.join(__dirname, 'public')));

// 💡 URL SheetDB Master milik lu
const SHEETDB_API_URL = 'https://sheetdb.io/api/v1/4ymve1xmls1j3';

function excelSerialToDate(serial) {
    const num = parseInt(serial);
    if (isNaN(num) || num < 1) return serial;
    const date = new Date((num - 25569) * 86400 * 1000);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// ================= API ROUTING =================

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const response = await fetch(`${SHEETDB_API_URL}?sheet=Pengguna`);
        const rows = await response.json();
        const userFound = rows.find(row => (row.Username || row.username) == username && (row.Password || row.password) == password);
        if (userFound) {
            res.json({ success: true, username, role: userFound.Role || userFound.role, cabang: userFound.Cabang || userFound.cabang });
        } else {
            res.status(401).json({ success: false, message: 'Login gagal le!' });
        }
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/pengajuan', async (req, res) => {
    try {
        const response = await fetch(`${SHEETDB_API_URL}?sheet=Pengajuan`);
        const rows = await response.json();
        const mapped = rows.map(row => {
            let tgl = row.Tanggal || row.tanggal || '';
            if (tgl && !tgl.toString().includes('/')) tgl = excelSerialToDate(tgl);
            return [row.ID, tgl, row.Pelatih, row.Cabang, row["Nama Barang"] || row.Barang, row.Jumlah, row.Status];
        });
        res.json({ success: true, data: mapped });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/pengajuan', async (req, res) => {
    const { pelatih, cabang, barang, jumlah } = req.body;
    try {
        await fetch(`${SHEETDB_API_URL}?sheet=Pengajuan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: [{ "ID": Date.now().toString().slice(-4), "Tanggal": new Date().toLocaleDateString(), "Cabang": cabang, "Jumlah": jumlah, "Status": "Pending", "Pelatih": pelatih, "Nama Barang": barang }] })
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/pengajuan/status', async (req, res) => {
    try {
        await fetch(`${SHEETDB_API_URL}/ID/${req.body.idPengajuan}?sheet=Pengajuan`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { "Status": req.body.status } })
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/stok', async (req, res) => {
    try {
        const response = await fetch(`${SHEETDB_API_URL}?sheet=Stok%20${req.query.cabang}`);
        const rows = await response.json();
        res.json({ success: true, data: rows });
    } catch (e) { res.status(500).json({ success: false }); }
});

// 💡 Memaksa server langsung melempar halaman login index.html saat domain utama diakses
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ================= SERVER INITIALIZATION =================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan aman di port ${PORT}`);
});

// 💡 Eksport modul mutlak untuk kebutuhan arsitektur Vercel
module.exports = app;