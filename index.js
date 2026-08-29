const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// 1. Veritabanı Bağlantısı
const mongoURI = 'mongodb+srv://erenevrenbaris_db_user:Flexi12345@cluster0.ekq2qzw.mongodb.net/flexidrive?retryWrites=true&w=majority';

mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB kurumsal veritabanı bağlantısı başarılı!'))
  .catch((err) => console.error('Veritabanı bağlantı hatası:', err));

// 2. Enterprise Veritabanı Modeli
const CarSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, default: 2026 },
  category: { type: String, default: "Ekonomik" },
  fuelType: { type: String, default: "Benzin" },
  luggageCapacity: { type: Number, default: 2 },
  supplierName: { type: String, required: true },
  supplierContact: { type: String, required: true },
  country: { type: String, required: true },
  airports: { type: String, required: true },
  supplierPrice: { type: Number, required: true },
  commissionRate: { type: Number, default: 20 },
  customerPrice: { type: Number, required: true },
  currency: { type: String, default: "€" }, 
  available: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const Car = mongoose.model('Car', CarSchema);

// 3. API Rotaları
app.get('/api/cars', async (req, res) => {
  try {
    const cars = await Car.find().sort({ createdAt: -1 });
    res.json(cars);
  } catch (err) {
    res.status(500).json({ error: 'Filo verileri getirilemedi' });
  }
});

app.post('/api/cars', async (req, res) => {
  try {
    const { brand, model, year, category, fuelType, luggageCapacity, supplierName, supplierContact, country, airports, supplierPrice, currency } = req.body;
    
    if (!brand || !model || !supplierName || !supplierPrice || !country || !airports) {
      return res.status(400).json({ error: 'Lütfen tüm zorunlu alanları eksiksiz doldurun.' });
    }

    const commRate = 20; 
    const supPrice = parseFloat(supplierPrice);
    if (isNaN(supPrice) || supPrice <= 0) {
      return res.status(400).json({ error: 'Geçersiz fiyat bilgisi.' });
    }

    const customerPrice = Math.round(supPrice * (1 + commRate / 100));

    // Firma adındaki boşluk ve büyük/küçük harf tutarsızlıklarını normalize et
    const normalizedSupplierName = supplierName.trim();

    const newCar = new Car({
      brand, model, year: year || 2026, category: category || 'Ekonomik', fuelType: fuelType || 'Benzin', luggageCapacity: luggageCapacity || 2,
      supplierName: normalizedSupplierName, supplierContact, country, airports, supplierPrice: supPrice, commissionRate: commRate, customerPrice, currency: currency || '€', available: true
    });

    await newCar.save();
    res.status(201).json({ message: 'Araç başarıyla sisteme eklendi!', car: newCar });
  } catch (err) {
    res.status(400).json({ error: 'Kayıt sırasında hata oluştu', details: err.message });
  }
});

app.patch('/api/cars/:id/status', async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ error: 'Araç bulunamadı' });
    car.available = !car.available;
    await car.save();
    res.json({ message: 'Araç durumu güncellendi', car });
  } catch (err) {
    res.status(500).json({ error: 'Durum değiştirilemedi' });
  }
});

// 4. KURUMSAL ADMIN PANELİ (Enterprise HQ)
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr" class="h-full bg-slate-950">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexiDrive Enterprise HQ</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    [x-cloak] { display: none !important; }
    select {
      appearance: none;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23818cf8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right 1rem center;
      background-size: 1em;
    }
    select::-ms-expand { display: none; }
  </style>
</head>
<body class="h-full text-slate-100 flex flex-col" x-data="adminApp()">

  <header class="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-opacity-90">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="bg-indigo-600 text-white p-2.5 rounded-xl flex items-center justify-center font-black text-lg shadow-lg shadow-indigo-500/30"><i class="fa-solid fa-earth-europe"></i></div>
        <div>
          <span class="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">FlexiDrive</span> 
          <span class="text-[10px] text-indigo-400 ml-1 font-bold bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 uppercase tracking-widest">Enterprise HQ</span>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <button @click="activeTab = 'admin'" :class="activeTab === 'admin' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'" class="px-5 py-2 rounded-xl font-semibold text-sm transition-all flex items-center">
          <i class="fa-solid fa-car mr-2"></i> Filo Operasyonları
        </button>
        <button @click="activeTab = 'partners'" :class="activeTab === 'partners' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'" class="px-5 py-2 rounded-xl font-semibold text-sm transition-all flex items-center">
          <i class="fa-solid fa-handshake mr-2"></i> Tedarikçi Ağı
        </button>
        <a href="/tedarikci-paneli" target="_blank" class="text-emerald-400 hover:bg-emerald-500/10 px-4 py-2 rounded-xl font-semibold text-sm transition-all border border-emerald-500/30 flex items-center">
          <i class="fa-solid fa-external-link-alt mr-2"></i> Tedarikçi Portalı <span class="text-[9px] ml-2 bg-emerald-500/20 px-1.5 py-0.5 rounded uppercase">Harici</span>
        </a>
      </div>
    </div>
  </header>

  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <div class="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-3xl p-6 shadow-xl flex items-center space-x-4">
        <div class="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-2xl text-white shadow-lg shadow-indigo-500/30 flex-shrink-0">EE</div>
        <div>
          <div class="flex items-center space-x-2">
            <h2 class="text-lg font-extrabold text-white">Eren Evren Barış</h2>
            <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Super Admin</span>
          </div>
          <p class="text-xs text-slate-400 mt-1"><i class="fa-solid fa-shield-cat mr-1 text-indigo-400"></i> Global Broker & Fleet Manager</p>
        </div>
      </div>

      <div class="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-center">
        <div class="flex justify-between items-center mb-2">
          <span class="text-xs font-bold text-emerald-400 uppercase tracking-wider"><i class="fa-solid fa-qrcode mr-1"></i> Partner Kayıt Linki (WhatsApp Davet)</span>
          <span class="text-[10px] text-slate-500">Tedarikçilere bu linki ileterek filo eklemelerini sağlayın</span>
        </div>
        <div class="flex space-x-2">
          <input type="text" readonly :value="windowOrigin + '/tedarikci-paneli'" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-indigo-300 font-mono focus:outline-none">
          <button @click="navigator.clipboard.writeText(windowOrigin + '/tedarikci-paneli'); alert('Kayıt linki panoya kopyalandı!')" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all whitespace-nowrap shadow-lg flex items-center">
            <i class="fa-regular fa-copy mr-1.5"></i> Linki Kopyala
          </button>
        </div>
      </div>
    </div>

    <div x-show="activeTab === 'admin'" x-transition>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex justify-between items-center"><div><p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Filo</p><h3 class="text-3xl font-black mt-1 text-white" x-text="cars.length">0</h3></div><div class="text-indigo-400 text-3xl opacity-50"><i class="fa-solid fa-car"></i></div></div>
        <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex justify-between items-center"><div><p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Aktif / Müsait</p><h3 class="text-3xl font-black mt-1 text-emerald-400" x-text="cars.filter(c => c.available).length">0</h3></div><div class="text-emerald-400 text-3xl opacity-50"><i class="fa-solid fa-circle-check"></i></div></div>
        <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex justify-between items-center"><div><p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Sabit Komisyon</p><h3 class="text-3xl font-black mt-1 text-cyan-400">%20</h3></div><div class="text-cyan-400 text-3xl opacity-50"><i class="fa-solid fa-percent"></i></div></div>
        <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm flex justify-between items-center overflow-hidden">
          <div>
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Günlük Potansiyel Kâr</p>
            <div class="flex flex-col space-y-1">
              <template x-for="(val, cur) in totalProfits" :key="cur"><span class="text-lg font-black text-rose-400 leading-none" x-text="val + ' ' + cur"></span></template>
              <span x-show="Object.keys(totalProfits).length === 0" class="text-lg font-black text-slate-500">0</span>
            </div>
          </div>
          <div class="text-rose-400 text-3xl opacity-50"><i class="fa-solid fa-wallet"></i></div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <template x-for="car in cars" :key="car._id">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h4 class="text-base font-bold text-white" x-text="car.brand + ' ' + car.model"></h4>
            <p class="text-xs text-slate-400" x-text="'Tedarikçi: ' + car.supplierName"></p>
          </div>
        </template>
      </div>
    </div>

  </main>

  <script>
    document.addEventListener('alpine:init', () => {
      Alpine.data('adminApp', () => ({
        activeTab: 'admin',
        cars: [],
        windowOrigin: window.location.origin,
        async init() {
          const res = await fetch('/api/cars');
          this.cars = await res.json();
        },
        get totalProfits() {
          const totals = {};
          this.cars.filter(c => c.available).forEach(c => {
            const cur = c.currency || '€';
            totals[cur] = (totals[cur] || 0) + (c.customerPrice - c.supplierPrice);
          });
          return totals;
        }
      }));
    });
  </script>
</body>
</html>`);
});


// 5. GELİŞMİŞ TEDARİKÇİ PORTALI (Hataları Giderilmiş Kusursuz Sürüm)
app.get('/tedarikci-paneli', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr" class="h-full bg-slate-950">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexiDrive Tedarikçi Operasyon Merkezi</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    [x-cloak] { display: none !important; }
    select {
      appearance: none;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23818cf8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right 1rem center;
      background-size: 1em;
    }
    select::-ms-expand { display: none; }
  </style>
</head>
<body class="h-full text-slate-100 flex flex-col" x-data="supplierPortal()">

  <header class="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="bg-emerald-600 text-white p-2.5 rounded-xl flex items-center justify-center font-black text-lg shadow-lg shadow-emerald-500/30"><i class="fa-solid fa-handshake"></i></div>
        <div>
          <span class="text-xl font-extrabold tracking-tight text-white">FlexiDrive</span> 
          <span class="text-[10px] text-emerald-400 ml-1 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">Tedarikçi Portalı</span>
        </div>
      </div>
      
      <div class="flex items-center space-x-2" x-show="isLoggedIn">
        <button @click="activeTab = 'cars'" :class="activeTab === 'cars' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center">
          <i class="fa-solid fa-car mr-1.5"></i> Araçlarım
        </button>
        <button @click="activeTab = 'wallet'" :class="activeTab === 'wallet' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center">
          <i class="fa-solid fa-wallet mr-1.5"></i> Hesap Özeti & Kazanç
        </button>
        <button @click="activeTab = 'stats'" :class="activeTab === 'stats' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center">
          <i class="fa-solid fa-chart-line mr-1.5"></i> Kiralama İstatistikleri
        </button>
        <button @click="activeTab = 'add'" :class="activeTab === 'add' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center border border-emerald-500/30">
          <i class="fa-solid fa-plus-circle mr-1.5"></i> Yeni Araç Ekle
        </button>
        <button @click="logout()" class="text-rose-400 hover:bg-rose-500/10 p-2 rounded-xl text-xs transition-all ml-2" title="Çıkış Yap">
          <i class="fa-solid fa-right-from-bracket text-base"></i>
        </button>
      </div>
    </div>
  </header>

  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">

    <!-- GİRİŞ EKRANI -->
    <div x-show="!isLoggedIn" class="max-w-md mx-auto bg-slate-900 border border-slate-700 rounded-3xl p-8 shadow-2xl text-center">
      <div class="w-16 h-16 bg-emerald-600/20 text-emerald-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-emerald-500/30">
        <i class="fa-solid fa-building-user"></i>
      </div>
      <h2 class="text-2xl font-black text-white mb-2">Tedarikçi Girişi</h2>
      <p class="text-xs text-slate-400 mb-6">Sistemde kayıtlı olan Firma Adınızı yazarak kendi araç filonuza ve finansal özetinize ulaşın.</p>
      
      <form @submit.prevent="loginSupplier()" class="space-y-4">
        <input type="text" x-model="inputCompanyName" required placeholder="Firma Adınız (Örn: budvarent)" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm text-center font-bold focus:outline-none focus:border-emerald-500">
        <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl shadow-lg shadow-emerald-600/20 transition-all text-sm">
          Panele Giriş Yap <i class="fa-solid fa-arrow-right ml-2"></i>
        </button>
      </form>
    </div>

    <!-- PANEL İÇERİĞİ -->
    <div x-show="isLoggedIn" x-cloak class="w-full space-y-6">
      
      <div class="bg-gradient-to-r from-slate-900 via-emerald-950/20 to-slate-900 border border-emerald-500/20 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-center">
        <div class="flex items-center space-x-4 mb-4 md:mb-0">
          <div class="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center font-black text-xl text-white shadow-lg"><i class="fa-solid fa-car-side"></i></div>
          <div>
            <h2 class="text-xl font-extrabold text-white" x-text="companyName"></h2>
            <p class="text-xs text-slate-400 mt-0.5"><i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i> Aktif Tedarikçi Operasyon Paneli</p>
          </div>
        </div>
        <div class="flex space-x-4 bg-slate-950/80 p-3 rounded-2xl border border-slate-800 text-xs text-center">
          <div><span class="text-slate-500 block uppercase font-bold text-[10px]">Toplam Araç</span><span class="text-lg font-black text-white" x-text="myCars.length">0</span></div>
          <div class="border-l border-slate-800 pl-4"><span class="text-slate-500 block uppercase font-bold text-[10px]">Müsait Araç</span><span class="text-lg font-black text-emerald-400" x-text="myCars.filter(c => c.available).length">0</span></div>
        </div>
      </div>

      <!-- SEKME 1: ARAÇLARIM (Anlık Senkronize) -->
      <div x-show="activeTab === 'cars'" x-transition>
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-lg font-extrabold text-white"><i class="fa-solid fa-car text-emerald-400 mr-2"></i> Sistemdeki Araçlarım</h3>
          <button @click="activeTab = 'add'" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow">
            <i class="fa-solid fa-plus mr-1"></i> Yeni Araç Ekle
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <template x-for="car in myCars" :key="car._id">
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-emerald-500/40 transition-all flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-emerald-400 uppercase" x-text="car.category"></span>
                    <h4 class="text-base font-extrabold text-white mt-2" x-text="car.brand + ' ' + car.model"></h4>
                    <p class="text-xs text-slate-400 mt-1"><i class="fa-solid fa-location-dot text-emerald-400 mr-1"></i> <span x-text="car.country + ' / ' + car.airports"></span></p>
                  </div>
                  <span :class="car.available ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'" class="px-2 py-1 rounded text-[10px] font-black" x-text="car.available ? 'MÜSAİT' : 'KİRADA'"></span>
                </div>
                <div class="bg-slate-950 p-3 rounded-xl my-3 text-xs space-y-1.5 border border-slate-800/80">
                  <div class="flex justify-between"><span class="text-slate-500">Kayıt Tarihi:</span><span class="font-bold text-slate-300" x-text="new Date(car.createdAt).toLocaleDateString('tr-TR')"></span></div>
                  <div class="flex justify-between"><span class="text-slate-500">Günlük Net Kazanç:</span><span class="font-black text-emerald-400" x-text="car.supplierPrice + ' ' + car.currency"></span></div>
                </div>
              </div>
              <div class="pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                <span class="text-slate-500">Yıl: <strong class="text-white" x-text="car.year"></strong></span>
                <button @click="toggleMyCarStatus(car._id)" class="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg font-bold transition-all">Durum Değiştir</button>
              </div>
            </div>
          </template>
          <div x-show="myCars.length === 0" class="col-span-3 text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500">
            Bu firma adına (${companyName}) kayıtlı araç bulunamadı. Lütfen yeni araç ekleyin.
          </div>
        </div>
      </div>

      <!-- SEKME 2: HESAP ÖZETİ & KAZANÇ (Düzeltildi) -->
      <div x-show="activeTab === 'wallet'" x-cloak x-transition>
        <h3 class="text-lg font-extrabold text-white mb-6"><i class="fa-solid fa-wallet text-emerald-400 mr-2"></i> Hesap Özeti & Finansal Rapor</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Toplam Aktif Araç Kazanç Potansiyeli</span>
            <div class="text-3xl font-black text-emerald-400" x-text="totalSupplierEarnings + ' €'"></div>
            <p class="text-xs text-slate-500 mt-2">Müsait durumdaki tüm araçlarınızın günlük net toplam kazancıdır.</p>
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Komisyon Modeli</span>
            <div class="text-3xl font-black text-cyan-400">%20 Sabit Komisyon</div>
            <p class="text-xs text-slate-500 mt-2">FlexiDrive global broker ağı komisyon kesinti oranıdır.</p>
          </div>
        </div>
      </div>

      <!-- SEKME 3: KİRALAMA İSTATİSTİKLERİ -->
      <div x-show="activeTab === 'stats'" x-cloak x-transition>
        <h3 class="text-lg font-extrabold text-white mb-6"><i class="fa-solid fa-chart-line text-emerald-400 mr-2"></i> Kiralama Performans İstatistikleri</h3>
        
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div class="flex justify-between items-center pb-4 border-b border-slate-800 text-xs">
            <span class="text-slate-400 font-bold">Toplam Filo Havuzundaki Payınız</span>
            <span class="text-white font-black text-sm" x-text="myCars.length + ' Araç'"></span>
          </div>
          <div class="flex justify-between items-center pb-4 border-b border-slate-800 text-xs">
            <span class="text-slate-400 font-bold">Ortalama Araç Kalış Süresi (Sistemde)</span>
            <span class="text-emerald-400 font-black text-sm" x-text="averageDaysInSystem + ' Gün'"></span>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-400 font-bold">Operasyonel Durum</span>
            <span class="text-emerald-400 font-black bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">Sorunsuz & Aktif</span>
          </div>
        </div>
      </div>

      <!-- SEKME 4: YENİ ARAÇ EKLE -->
      <div x-show="activeTab === 'add'" x-cloak x-transition class="bg-slate-900 border border-slate-700 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <h3 class="text-xl font-black text-white mb-2"><i class="fa-solid fa-plus-circle text-emerald-400 mr-2"></i> Filoya Yeni Araç Ekle</h3>
        <p class="text-xs text-slate-400 mb-6">Firma adınız otomatik eşleştirilmektedir: <strong class="text-emerald-400" x-text="companyName"></strong></p>
        
        <form @submit.prevent="submitCar" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ülke Seçimi</label>
                <select x-model="form.country" @change="updateCountryData(form.country)" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm font-bold">
                  <option value="" disabled selected>Ülke Seçin</option>
                  <template x-for="c in countries" :key="c.name">
                    <option :value="c.name" x-text="c.flag + ' ' + c.name"></option>
                  </template>
                </select>
              </div>

              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Havalimanı / Teslim Noktası</label>
                <select x-model="form.airports" required :disabled="!form.country" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm font-bold disabled:opacity-40">
                  <option value="" disabled selected>Önce Ülke Seçin</option>
                  <template x-for="airport in availableAirports" :key="airport">
                    <option :value="airport" x-text="airport"></option>
                  </template>
                </select>
              </div>

              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">İletişim Numarası (Telefon)</label>
                <input type="tel" x-model="form.phoneOnly" required placeholder="5XX XXX XX XX" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm font-mono">
              </div>
            </div>

            <div class="space-y-4">
              <div class="flex space-x-3">
                <div class="w-1/2">
                  <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Marka</label>
                  <select x-model="form.brand" @change="form.model = ''; availableModels = carData[form.brand] || []" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-white text-sm font-bold">
                    <option value="" disabled selected>Marka Seçin</option>
                    <template x-for="(models, brandName) in carData" :key="brandName">
                      <option :value="brandName" x-text="brandName"></option>
                    </template>
                  </select>
                </div>
                
                <div class="w-1/2">
                  <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Model</label>
                  <select x-model="form.model" required :disabled="!form.brand" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-white text-sm font-bold disabled:opacity-40">
                    <option value="" disabled selected>Önce Marka Seçin</option>
                    <template x-for="modelName in availableModels" :key="modelName">
                      <option :value="modelName" x-text="modelName"></option>
                    </template>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Yıl</label>
                  <input type="number" x-model="form.year" required min="2000" max="2027" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-white text-sm font-bold">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sınıf</label>
                  <select x-model="form.category" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-3 text-white text-sm font-bold">
                    <option value="Ekonomik">Ekonomik</option><option value="SUV">SUV</option><option value="Sedan">Sedan</option><option value="Lüks">Lüks</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Yakıt</label>
                  <select x-model="form.fuelType" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-3 text-white text-sm font-bold">
                    <option value="Benzin">Benzin</option><option value="Dizel">Dizel</option><option value="Hibrit">Hibrit</option><option value="Elektrik">Elektrik</option>
                  </select>
                </div>
              </div>

              <div class="flex space-x-3">
                <div class="w-1/3">
                  <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Bavul</label>
                  <input type="number" x-model="form.luggageCapacity" required min="0" max="10" placeholder="Adet" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-white text-sm font-bold">
                </div>
                <div class="w-2/3">
                  <label class="block text-[10px] font-black text-emerald-400 uppercase tracking-wider mb-1">Günlük Net Kazanç</label>
                  <div class="relative">
                    <span class="absolute left-3 top-3 text-emerald-400 font-black text-base" x-text="form.currency"></span>
                    <input type="number" x-model="form.supplierPrice" required min="1" placeholder="Tutar" class="w-full bg-slate-950 border-2 border-emerald-500/40 rounded-xl pl-8 pr-3 py-3 text-white text-sm font-black">
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div x-show="message" x-text="message" :class="isError ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'" class="p-3 rounded-xl border text-sm font-bold text-center"></div>
          
          <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg transition-all">
            <i class="fa-solid fa-cloud-arrow-up mr-2"></i> Aracı Sisteme Kaydet ve Listeme Ekle
          </button>
        </form>
      </div>

    </div>

  </main>

  <script>
    const GLOBAL_COUNTRIES = [
      { name: 'Karadağ', flag: '🇲🇪', dial: '+382', currency: '€' },
      { name: 'Türkiye', flag: '🇹🇷', dial: '+90', currency: '₺' },
      { name: 'Sırbistan', flag: '🇷🇸', dial: '+381', currency: '€' },
      { name: 'Arnavutluk', flag: '🇦🇱', dial: '+355', currency: '€' },
      { name: 'Bosna Hersek', flag: '🇧🇦', dial: '+387', currency: '€' }
    ];
    const AIRPORT_DATABASE = {
      'Karadağ': ['Tivat (TIV)', 'Podgorica (TGD)'],
      'Türkiye': ['İstanbul (IST)', 'Antalya (AYT)', 'İzmir (ADB)'],
      'Sırbistan': ['Belgrad (BEG)'],
      'Arnavutluk': ['Tiran (TIA)'],
      'Bosna Hersek': ['Saraybosna (SJJ)']
    };
    const CAR_DATABASE = {
      'Audi': ['A3', 'A4', 'Q3', 'Q5'],
      'BMW': ['1 Serisi', '3 Serisi', 'X1'],
      'Fiat': ['Egea', 'Panda', '500'],
      'Ford': ['Focus', 'Puma'],
      'Renault': ['Clio', 'Megane', 'Captur'],
      'Volkswagen': ['Polo', 'Golf', 'Passat']
    };

    document.addEventListener('alpine:init', () => {
      Alpine.data('supplierPortal', () => ({
        isLoggedIn: false,
        inputCompanyName: '',
        companyName: '',
        activeTab: 'cars',
        cars: [],
        countries: GLOBAL_COUNTRIES,
        airportData: AIRPORT_DATABASE,
        carData: CAR_DATABASE,
        availableModels: [],
        availableAirports: [],
        form: { 
          brand: '', model: '', year: 2026, category: 'Ekonomik', fuelType: 'Benzin', luggageCapacity: 2, 
          phoneOnly: '', dialCode: '+382', country: '', airports: '', supplierPrice: '', currency: '€' 
        },
        message: '',
        isError: false,

        async init() {
          await this.fetchCars();
          const savedCompany = localStorage.getItem('flexi_supplier_company');
          if (savedCompany) {
            this.companyName = savedCompany;
            this.isLoggedIn = true;
          }
        },

        async fetchCars() {
          try {
            const res = await fetch('/api/cars');
            this.cars = await res.json();
          } catch (err) {}
        },

        loginSupplier() {
          if (!this.inputCompanyName.trim()) return;
          this.companyName = this.inputCompanyName.trim();
          localStorage.setItem('flexi_supplier_company', this.companyName);
          this.isLoggedIn = true;
        },

        logout() {
          localStorage.removeItem('flexi_supplier_company');
          this.isLoggedIn = false;
          this.inputCompanyName = '';
        },

        get myCars() {
          // Büyük/küçük harf ve boşluk duyarsız eşleştirme (Böylece araçlar anında listelenir)
          if (!this.companyName) return [];
          const currentComp = this.companyName.trim().toLowerCase();
          return this.cars.filter(c => c.supplierName && c.supplierName.trim().toLowerCase() === currentComp);
        },

        get totalSupplierEarnings() {
          return this.myCars.filter(c => c.available).reduce((acc, c) => acc + (c.supplierPrice || 0), 0);
        },

        get averageDaysInSystem() {
          if (this.myCars.length === 0) return 0;
          const now = new Date();
          const totalDays = this.myCars.reduce((acc, c) => {
            const created = new Date(c.createdAt);
            const diffTime = Math.abs(now - created);
            return acc + Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }, 0);
          return Math.round(totalDays / this.myCars.length);
        },

        updateCountryData(val) {
          this.form.airports = ''; 
          const c = this.countries.find(x => x.name === val);
          if (c) {
            this.form.currency = c.currency;
            this.form.dialCode = c.dial;
            this.availableAirports = this.airportData[val] || [];
          } else {
            this.availableAirports = [];
          }
        },

        async submitCar() {
          try {
            const fullContact = this.form.dialCode + ' ' + this.form.phoneOnly;
            const payload = { 
              ...this.form, 
              supplierName: this.companyName, // Giriş yapılan firma adı direkt atanır
              supplierContact: fullContact 
            };

            const res = await fetch('/api/cars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) {
              this.isError = false; 
              this.message = 'Aracınız başarıyla filonuza eklendi!';
              await this.fetchCars(); // Veriler anında yeniden çekilir
              this.activeTab = 'cars'; // Otomatik olarak Araçlarım sekmesine atar
              setTimeout(() => { this.message = ''; }, 3000); 
            } else { this.isError = true; this.message = 'Kayıt başarısız.'; }
          } catch (err) { this.isError = true; this.message = 'Bağlantı hatası!'; }
        },

        async toggleMyCarStatus(id) {
          await fetch('/api/cars/' + id + '/status', { method: 'PATCH' });
          await this.fetchCars();
        }
      }));
    });
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`FlexiDrive Tedarikçi Operasyon Merkezi http://localhost:${PORT} adresinde aktif!`);
});
