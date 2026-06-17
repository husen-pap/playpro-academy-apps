const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// =========================================================================
// CONFIGURATION AREA (LINK API SHEETDB LIVE JURAGAN)
// =========================================================================
const SHEETDB_API_URL = 'https://sheetdb.io/api/v1/4ymve1xmls1j3';
// =========================================================================


// Fungsi Pembantu: Konversi Angka Serial Excel ke Tanggal Normal DD/MM/YYYY
function excelSerialToDate(serial) {
    const num = parseInt(serial);
    if (isNaN(num) || num < 1) return serial; 
    
    const date = new Date((num - 25569) * 86400 * 1000);
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
}


// 1. JALUR API: PROSES LOGIN USER (TAB: Pengguna)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const response = await fetch(`${SHEETDB_API_URL}?sheet=Pengguna`);
        const rows = await response.json();

        if (!rows || rows.error || rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Data pengguna di SheetDB kosong le!' });
        }

        const userFound = rows.find(row => {
            const u = row.Username || row.username || row.USERNAME;
            const p = row.Password || row.password || row.PASSWORD;
            return u == username && p == password;
        });

        if (userFound) {
            res.json({
                success: true,
                username: username, 
                role: userFound.Role || userFound.role || userFound.ROLE,
                cabang: userFound.Cabang || userFound.cabang || userFound.CABANG
            });
        } else {
            res.status(401).json({ success: false, message: 'Username atau Password salah le!' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// 2. JALUR API: AMBIL DATA PENGAJUAN (DENGAN AUTO-KONVERSI ANGKA SERIAL EXCEL)
app.get('/api/pengajuan', async (req, res) => {
    try {
        const response = await fetch(`${SHEETDB_API_URL}?sheet=Pengajuan`);
        const rows = await response.json();

        if (!rows || rows.error) return res.json({ success: true, data: [] });

        const mappedData = rows.map(row => {
            let id = '', tanggal = '', pelatih = '', cabang = '', barang = '', jumlah = '', status = '';
            
            Object.keys(row).forEach(key => {
                const cleanKey = key.toLowerCase().trim();
                if (cleanKey === 'id') id = row[key];
                else if (cleanKey === 'tanggal') tanggal = row[key];
                else if (cleanKey === 'cabang') cabang = row[key];
                else if (cleanKey === 'jumlah') jumlah = row[key];
                else if (cleanKey === 'status') status = row[key];
                else if (cleanKey === 'pelatih' || cleanKey === 'nama pelatih' || cleanKey === 'nama_pelatih') pelatih = row[key];
                else if (cleanKey === 'nama barang' || cleanKey === 'nama_barang' || cleanKey === 'barang') barang = row[key];
            });

            const values = Object.values(row);
            if (!id) id = row['ID'] || row['id'] || values[0] || '';
            if (!tanggal) tanggal = row['Tanggal'] || row['tanggal'] || values[1] || '';
            if (!pelatih) pelatih = row['Nama Pelatih'] || row['Pelatih'] || values[2] || '';
            if (!cabang) cabang = row['Cabang'] || row['cabang'] || values[3] || '';
            if (!barang) barang = row['Nama Barang'] || row['Barang'] || values[4] || '';
            if (!jumlah) jumlah = row['Jumlah'] || row['jumlah'] || values[5] || '';
            if (!status) status = row['Status'] || row['status'] || values[6] || '';

            if (tanggal && !tanggal.toString().includes('/')) {
                tanggal = excelSerialToDate(tanggal);
            }

            return [id, tanggal, pelatih, cabang, barang, jumlah, status];
        });

        res.json({ success: true, data: mappedData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// 3. JALUR API: INPUT FORM PENGAJUAN BARU
app.post('/api/pengajuan', async (req, res) => {
    const { pelatih, cabang, barang, jumlah } = req.body;
    const tanggal = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' });

    try {
        const getRes = await fetch(`${SHEETDB_API_URL}?sheet=Pengajuan`);
        const rows = await getRes.json();
        
        let nextId = 1; 

        if (rows && rows.length > 0 && !rows.error) {
            const validIds = rows
                .map(row => {
                    const idVal = row.ID || row.id || Object.values(row)[0];
                    if (!idVal) return null;
                    const num = parseInt(idVal.toString().trim());
                    return isNaN(num) ? null : num;
                })
                .filter(id => id !== null);

            if (validIds.length > 0) {
                nextId = Math.max(...validIds) + 1;
            } else {
                nextId = rows.length + 1;
            }
        }

        await fetch(`${SHEETDB_API_URL}?sheet=Pengajuan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: [
                    {
                        "ID": nextId.toString(),
                        "Tanggal": tanggal,
                        "Cabang": cabang,
                        "Jumlah": jumlah,
                        "Status": "Pending",
                        "Pelatih": pelatih,
                        "Nama Pelatih": pelatih,
                        "nama_pelatih": pelatih,
                        "Nama Barang": barang,
                        "nama_barang": barang,
                        "Barang": barang
                    }
                ]
            })
        });
        res.json({ success: true, message: 'Pengajuan sukses tercatat!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// 4. JALUR API: VERIFIKASI ADMIN APPROVE/REJECT
app.post('/api/pengajuan/status', async (req, res) => {
    const { idPengajuan, status } = req.body;

    try {
        await fetch(`${SHEETDB_API_URL}/ID/${idPengajuan}?sheet=Pengajuan`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: { "Status": status }
            })
        });
        res.json({ success: true, message: 'Status diperbarui!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// 5. 💡 JALUR API BARU: AMBIL DATA STOK SECARA DINAMIS SESUAI SPASI CABANG REQUEST LU
app.get('/api/stok', async (req, res) => {
    try {
        const namaCabang = req.query.cabang;
        if (!namaCabang) {
            return res.status(400).json({ success: false, message: 'Parameter cabang wajib diisi le!' });
        }

        const namaTabSheet = `Stok ${namaCabang}`; 
        const response = await fetch(`${SHEETDB_API_URL}?sheet=${encodeURIComponent(namaTabSheet)}`);
        const rows = await response.json();

        if (!rows || rows.error) return res.json({ success: true, data: [] });
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


const PORT = process.env.PORT || 3000; // 💡 Bonus: Ubah ini juga biar fleksibel ngikutin port hosting

app.listen(PORT, () => {
    console.log(`====================================================================`);
    console.log(`🔥 SERVER SHEETDB BASKET BERJALAN AMAN DI http://localhost:${PORT}`);
    console.log(`====================================================================`);
});

// 💡 TARUH DI SINI (Di luar dan di paling bawah file!)
module.exports = app;