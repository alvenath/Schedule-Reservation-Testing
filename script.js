document.addEventListener('DOMContentLoaded', function() {
    // --- Elemen DOM ---
    const loginSection = document.getElementById('login-section');
    const userFormSection = document.getElementById('user-reservasi-form');
    const adminDashboard = document.getElementById('admin-dashboard');
    const statusSection = document.getElementById('status-reservasi');
    const logoutBtn = document.getElementById('logout-btn');

    const loginForm = document.getElementById('loginForm');
    const pengajuanReservasiForm = document.getElementById('pengajuanReservasiForm');
    const cekKetersediaanForm = document.getElementById('cekKetersediaanForm');

    const tabelBodyPengajuan = document.getElementById('tabelBodyPengajuan');
    const tabelBodyStatus = document.getElementById('tabelBodyStatus');
    const hasilKetersediaan = document.getElementById('hasilKetersediaan');

    // --- Data Mock dan State Global ---
    let currentRole = null; // 'user' atau 'admin'
    
    // Data disimpan di Local Storage (PENTING: Dalam aplikasi nyata, ini adalah DATABASE)
    let approvedReservations = JSON.parse(localStorage.getItem('approvedReservations')) || [];
    let pendingRequests = JSON.parse(localStorage.getItem('pendingRequests')) || [];
    let rejectedReservations = JSON.parse(localStorage.getItem('rejectedReservations')) || [];
    
    let allReservations = [...approvedReservations, ...pendingRequests, ...rejectedReservations];

    // --- Fungsi Utilitas ---

    function generateId() {
        return '_' + Math.random().toString(36).substr(2, 9);
    }

    function simpanData() {
        localStorage.setItem('approvedReservations', JSON.stringify(approvedReservations));
        localStorage.setItem('pendingRequests', JSON.stringify(pendingRequests));
        localStorage.setItem('rejectedReservations', JSON.stringify(rejectedReservations));
        allReservations = [...approvedReservations, ...pendingRequests, ...rejectedReservations];
    }

    // --- Fungsi Rendering/Tampilan ---

    function renderAplikasi(role) {
        // Sembunyikan semua dan tampilkan hanya yang relevan
        loginSection.style.display = 'none';
        userFormSection.style.display = 'none';
        adminDashboard.style.display = 'none';
        statusSection.style.display = 'none';
        logoutBtn.style.display = 'none';

        // Mengatur kolom header tambahan (Aksi Admin)
        const statusTableHead = document.getElementById('statusTableHead').querySelector('tr');
        const existingAdminHeader = document.getElementById('adminHeaderAction');

        if (role === 'admin' && !existingAdminHeader) {
            // Tambahkan kolom Aksi Admin jika Admin login
            const newHeader = document.createElement('th');
            newHeader.textContent = 'Aksi Admin';
            newHeader.id = 'adminHeaderAction';
            statusTableHead.appendChild(newHeader);
        } else if (role !== 'admin' && existingAdminHeader) {
            // Hapus kolom Aksi Admin jika User atau Logout
            statusTableHead.removeChild(existingAdminHeader);
        }
        
        if (!role) {
            loginSection.style.display = 'block';
        } else {
            logoutBtn.style.display = 'block';
            statusSection.style.display = 'block';
            renderTabelStatus(); // Tampilkan status untuk semua
            
            if (role === 'admin') {
                adminDashboard.style.display = 'block';
                renderTabelPengajuan();
            } else if (role === 'user') {
                userFormSection.style.display = 'block';
            }
        }
    }
    
    
    function renderTabelPengajuan() {
        tabelBodyPengajuan.innerHTML = '';

        if (pendingRequests.length === 0) {
            const row = tabelBodyPengajuan.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 5;
            cell.style.textAlign = 'center';
            cell.textContent = 'Tidak ada pengajuan reservasi pending.';
            return;
        }

        pendingRequests.forEach(req => {
            const row = tabelBodyPengajuan.insertRow();
            row.insertCell(0).textContent = req.id;
            row.insertCell(1).textContent = req.ruangan;
            row.insertCell(2).textContent = `${req.tanggal} (${req.waktuMulai} - ${req.waktuSelesai})`;
            row.insertCell(3).textContent = req.peminjam;
            
            const actionCell = row.insertCell(4);
            actionCell.innerHTML = `
                <button class="action-btn-approve" data-id="${req.id}">Setuju</button>
                <button class="action-btn-reject" data-id="${req.id}">Tolak</button>
            `;
        });
    }

    function renderTabelStatus() {
        tabelBodyStatus.innerHTML = '';
        const dataStatus = [...approvedReservations, ...pendingRequests, ...rejectedReservations];
        
        const isUserAdmin = currentRole === 'admin';
        const numColumns = isUserAdmin ? 6 : 5; // Hitung jumlah kolom

        if (dataStatus.length === 0) {
            const row = tabelBodyStatus.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = numColumns; // Sesuaikan colspan
            cell.style.textAlign = 'center';
            cell.textContent = 'Tidak ada riwayat reservasi.';
            return;
        }

        dataStatus.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)); 
        
        dataStatus.forEach(res => {
            const row = tabelBodyStatus.insertRow();
            row.insertCell(0).textContent = res.ruangan;
            row.insertCell(1).textContent = `${res.tanggal} (${res.waktuMulai} - ${res.waktuSelesai})`;
            row.insertCell(2).textContent = res.peminjam;
            row.insertCell(3).textContent = res.keperluan;
            
            const statusCell = row.insertCell(4);
            statusCell.textContent = res.status;
            
            // Berikan gaya warna berdasarkan status
            if (res.status === 'Disetujui') {
                statusCell.style.backgroundColor = '#d4edda';
            } else if (res.status === 'Pending') {
                statusCell.style.backgroundColor = '#fff3cd';
            } else { // Ditolak
                statusCell.style.backgroundColor = '#f8d7da';
            }

            // Tambahkan Kolom Hapus jika Admin login
            if (isUserAdmin) {
                const deleteCell = row.insertCell(5);
                deleteCell.innerHTML = `
                    <button class="action-btn-delete" data-id="${res.id}">Hapus</button>
                `;
            }
        });
    }

    // --- Logika Validasi & Ketersediaan ---

    function checkCollision(ruangan, tanggal, waktuMulai, waktuSelesai) {
        // Cek bentrok hanya dengan reservasi yang sudah DISETUJUI dan PENDING
        const activeBookings = approvedReservations.concat(pendingRequests);

        return activeBookings.some(res => 
            res.ruangan === ruangan && 
            res.tanggal === tanggal &&
            // Pengecekan bentrok: Waktu mulai atau selesai reservasi baru berada di antara waktu reservasi yang sudah ada.
            // Atau reservasi yang sudah ada sepenuhnya berada di dalam reservasi baru.
            (
                (waktuMulai < res.waktuSelesai && waktuSelesai > res.waktuMulai)
            )
        );
    }
    
    // --- Event Listeners ---

    // 1. LOGIN
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // **PENTING: Ini adalah MOCK LOGIN!**
        // Dalam aplikasi nyata, Anda harus mengirim data ini ke server untuk divalidasi.
        if (username === 'admin' && password === 'admin') {
            currentRole = 'admin';
            alert('Login Admin Berhasil!');
        } else if (username === 'user' && password === 'user') {
            currentRole = 'user';
            alert('Login Pengguna Berhasil!');
        } else {
            alert('Username atau password salah. Coba: admin/admin atau user/user.');
            return;
        }

        renderAplikasi(currentRole);
    });
    
    // 2. LOGOUT
    logoutBtn.addEventListener('click', function() {
        currentRole = null;
        alert('Anda telah logout.');
        renderAplikasi(currentRole);
    });

    // 3. CEK KETERSEDIAAN RUANGAN (USER)
    cekKetersediaanForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const tanggal = document.getElementById('cekTanggal').value;
        const waktuMulai = document.getElementById('cekWaktuMulai').value;
        const waktuSelesai = document.getElementById('cekWaktuSelesai').value;
        
        const availableRooms = ['Kelas A', 'Kelas B', 'Lab Komputer 1'];
        let availableText = 'Ruangan tersedia: ';
        let roomsFound = 0;

        if (waktuSelesai <= waktuMulai) {
             hasilKetersediaan.className = 'alert-danger';
             hasilKetersediaan.innerHTML = 'Waktu Selesai harus lebih lambat dari Waktu Mulai.';
             return;
        }

        availableRooms.forEach(room => {
            if (!checkCollision(room, tanggal, waktuMulai, waktuSelesai)) {
                availableText += `${room}, `;
                roomsFound++;
            }
        });

        if (roomsFound > 0) {
            hasilKetersediaan.className = 'alert-success';
            hasilKetersediaan.innerHTML = availableText.slice(0, -2); // Hapus koma terakhir
        } else {
            hasilKetersediaan.className = 'alert-danger';
            hasilKetersediaan.innerHTML = 'Tidak ada ruangan yang tersedia pada jam tersebut.';
        }
    });

    // 4. PENGAJUAN RESERVASI (USER)
    pengajuanReservasiForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const ruangan = document.getElementById('pilihRuangan').value;
        const tanggal = document.getElementById('tanggalReservasi').value;
        const waktuMulai = document.getElementById('waktuMulai').value;
        const waktuSelesai = document.getElementById('waktuSelesai').value;
        const keterangan = document.getElementById('keterangan').value;
        const peminjam = currentRole; // Menggunakan role sebagai nama peminjam sementara

        if (waktuSelesai <= waktuMulai) {
             alert('Pengajuan Gagal: Waktu Selesai harus lebih lambat dari Waktu Mulai.');
             return;
        }

        // Cek bentrok dengan yang sudah disetujui atau pending
        if (checkCollision(ruangan, tanggal, waktuMulai, waktuSelesai)) {
            alert('Pengajuan Gagal! Ruangan sudah dipesan atau ada pengajuan lain yang bentrok.');
            return;
        }

        const requestBaru = {
            id: generateId(),
            ruangan,
            tanggal,
            waktuMulai,
            waktuSelesai,
            peminjam,
            keperluan: keterangan,
            status: 'Pending'
        };

        pendingRequests.push(requestBaru);
        simpanData();
        
        alert(`Pengajuan reservasi untuk ${ruangan} berhasil diajukan. Menunggu persetujuan Admin.`);
        pengajuanReservasiForm.reset();
        renderAplikasi(currentRole);
    });

    // 5. PERSETUJUAN/PENOLAKAN (ADMIN)
    adminDashboard.addEventListener('click', function(e) {
        const target = e.target;
        if (target.classList.contains('action-btn-approve') || target.classList.contains('action-btn-reject')) {
            const requestId = target.getAttribute('data-id');
            const isApprove = target.classList.contains('action-btn-approve');
            
            const requestIndex = pendingRequests.findIndex(req => req.id === requestId);
            if (requestIndex === -1) return;

            const request = pendingRequests[requestIndex];
            pendingRequests.splice(requestIndex, 1); // Hapus dari pending

            if (isApprove) {
                // Tambahkan ke daftar disetujui
                request.status = 'Disetujui';
                approvedReservations.push(request);
                alert(`Reservasi ${request.ruangan} oleh ${request.peminjam} telah DISETUJUI.`);
            } else {
                // Tambahkan ke daftar ditolak
                request.status = 'Ditolak';
                rejectedReservations.push(request);
                alert(`Reservasi ${request.ruangan} oleh ${request.peminjam} telah DITOLAK.`);
            }

            simpanData();
            renderAplikasi(currentRole); // Render ulang tampilan
        }
    });

    // --- Inisialisasi Aplikasi ---
    renderAplikasi(currentRole);

    // 6. HAPUS RIWAYAT RESERVASI (ADMIN)
    statusSection.addEventListener('click', function(e) {
        const target = e.target;
        if (target.classList.contains('action-btn-delete')) {
            const reservationId = target.getAttribute('data-id');

            if (!confirm("Anda yakin ingin menghapus riwayat reservasi ini? Aksi ini tidak dapat dibatalkan.")) {
                return;
            }

            // Cari dan hapus dari array approvedReservations
            let indexApproved = approvedReservations.findIndex(res => res.id === reservationId);
            if (indexApproved !== -1) {
                approvedReservations.splice(indexApproved, 1);
            }
            
            // Cari dan hapus dari array pendingRequests
            let indexPending = pendingRequests.findIndex(res => res.id === reservationId);
            if (indexPending !== -1) {
                pendingRequests.splice(indexPending, 1);
            }

            // Cari dan hapus dari array rejectedReservations
            let indexRejected = rejectedReservations.findIndex(res => res.id === reservationId);
            if (indexRejected !== -1) {
                rejectedReservations.splice(indexRejected, 1);
            }

            simpanData();
            alert('Riwayat reservasi berhasil dihapus!');
            renderAplikasi(currentRole); // Render ulang tampilan
        }
    });
});

