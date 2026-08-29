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
  .then(() => console.log('MongoDB veritabanı bağlantısı başarılı!'))
  .catch((err) => console.error('Veritabanı bağlantı hatası:', err));

// 2. Veritabanı Modeli
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
  supplierPrice: { type: Number, required: true, max: 400 },
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

// Meta-Search Global Feed
app.get('/api/feed/global-inventory', async (req, res) => {
  try {
    const activeCars = await Car.find({ available: true }).sort({ createdAt: -1 });
    const feedData = activeCars.map(car => ({
      vehicle_id: car._id,
      brand: car.brand,
      model: car.model,
      year: car.year,
      category: car.category,
      fuel_type: car.fuelType,
      luggage: car.luggageCapacity,
      location: { country: car.country, airport_code: car.airports },
      pricing: { daily_rate: car.customerPrice, currency: car.currency, net_supplier_rate: car.supplierPrice },
      booking_deeplink: `https://${req.get('host')}/rezervasyon?car_id=${car._id}&pickup=${encodeURIComponent(car.airports)}`,
      provider: car.supplierName,
      status: "AVAILABLE",
      last_updated: car.createdAt
    }));
    res.json({ broker: "FlexiDrive Global OS", total_items: feedData.length, generated_at: new Date(), inventory: feedData });
  } catch (err) {
    res.status(500).json({ error: 'Global feed verisi oluşturulamadı' });
  }
});

app.post('/api/cars', async (req, res) => {
  try {
    const { brand, model, year, category, fuelType, luggageCapacity, supplierName, supplierContact, country, airports, supplierPrice, currency } = req.body;
    
    if (!brand || !model || !supplierName || !supplierPrice || !country || !airports) {
      return res.status(400).json({ error: 'Lütfen tüm zorunlu alanları eksiksiz doldurun.' });
    }

    const supPrice = parseFloat(supplierPrice);
    if (isNaN(supPrice) || supPrice <= 0 || supPrice > 400) {
      return res.status(400).json({ error: 'Geçersiz fiyat veya 400 € sınır aşımı.' });
    }

    const commRate = 20; 
    const customerPrice = Math.round(supPrice * (1 + commRate / 100));
    const normalizedSupplierName = supplierName.trim();

    const newCar = new Car({
      brand, model, year: year || 2026, category: category || 'Ekonomik', fuelType: fuelType || 'Benzin', luggageCapacity: luggageCapacity || 2,
      supplierName: normalizedSupplierName, supplierContact, country, airports, supplierPrice: supPrice, commissionRate: commRate, customerPrice, currency: currency || '€', available: true
    });

    await newCar.save();
    res.status(201).json({ message: 'Araç başarıyla yayına alındı!', car: newCar });
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

app.delete('/api/cars/:id', async (req, res) => {
  try {
    const deletedCar = await Car.findByIdAndDelete(req.params.id);
    if (!deletedCar) return res.status(404).json({ error: 'Araç bulunamadı' });
    res.json({ success: true, message: 'Araç kaldırıldı.' });
  } catch (err) {
    res.status(500).json({ error: 'Araç kaldırılamadı' });
  }
});

app.patch('/api/cars/:id/rent', async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ error: 'Araç bulunamadı' });
    car.available = false;
    await car.save();
    res.json({ success: true, message: 'Araç kilitlendi.', car });
  } catch (err) {
    res.status(500).json({ error: 'İşlem başarısız' });
  }
});

app.patch('/api/cars/:id/release', async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ error: 'Araç bulunamadı' });
    car.available = true;
    await car.save();
    res.json({ success: true, message: 'Araç müsait.', car });
  } catch (err) {
    res.status(500).json({ error: 'İşlem başarısız' });
  }
});

// 4. ANA YÖNETİCİ PANELİ (Orijinal Site Stilinde Ferah / Açık Tema)
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr" class="h-full bg-slate-50">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexiDrive Admin HQ</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    [x-cloak] { display: none !important; }
  </style>
</head>
<body class="h-full text-slate-900 flex flex-col" x-data="adminApp()">

  <!-- Orijinal Sitenin Header Çizgisi -->
  <header class="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="bg-red-600 text-white p-2 rounded-xl flex items-center justify-center font-black text-lg shadow-md"><i class="fa-solid fa-car"></i></div>
        <span class="text-2xl font-black tracking-tighter text-slate-900">FlexiDrive</span>
      </div>
      <div class="flex items-center space-x-3">
        <button @click="activeTab = 'admin'" :class="activeTab === 'admin' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all">
          <i class="fa-solid fa-car mr-1.5"></i> Filo Operasyonları
        </button>
        <button @click="activeTab = 'partners'" :class="activeTab === 'partners' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all">
          <i class="fa-solid fa-earth-europe mr-1.5"></i> Tedarikçi Ağı
        </button>
        <button @click="activeTab = 'integrations'" :class="activeTab === 'integrations' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all">
          <i class="fa-solid fa-network-wired mr-1.5"></i> Meta-Search Feed
        </button>
        <a href="/tedarikci-paneli" target="_blank" class="text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl font-bold text-xs transition-all border border-red-200 flex items-center">
          <i class="fa-solid fa-external-link-alt mr-1.5"></i> Tedarikçi Portalı
        </a>
      </div>
    </div>
  </header>

  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

    <!-- SEKME 1: FİLO -->
    <div x-show="activeTab === 'admin'" x-transition>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex justify-between items-center"><div><p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Filo</p><h3 class="text-3xl font-black mt-1 text-slate-900" x-text="cars.length">0</h3></div><div class="text-slate-400 text-3xl"><i class="fa-solid fa-car"></i></div></div>
        <div class="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex justify-between items-center"><div><p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Aktif / Müsait</p><h3 class="text-3xl font-black mt-1 text-emerald-600" x-text="cars.filter(c => c.available).length">0</h3></div><div class="text-emerald-500 text-3xl"><i class="fa-solid fa-circle-check"></i></div></div>
        <div class="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex justify-between items-center"><div><p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Model</p><h3 class="text-3xl font-black mt-1 text-slate-900">B2B Broker</h3></div><div class="text-indigo-500 text-3xl"><i class="fa-solid fa-globe"></i></div></div>
        <div class="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex justify-between items-center overflow-hidden">
          <div>
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Günlük Potansiyel Ciro</p>
            <div class="flex flex-col space-y-1">
              <template x-for="(val, cur) in totalProfits" :key="cur"><span class="text-lg font-black text-red-600 leading-none" x-text="val + ' ' + cur"></span></template>
              <span x-show="Object.keys(totalProfits).length === 0" class="text-lg font-black text-slate-400">0</span>
            </div>
          </div>
          <div class="text-red-500 text-3xl"><i class="fa-solid fa-wallet"></i></div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <template x-for="car in cars" :key="car._id">
          <div class="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
            <div>
              <div class="flex justify-between items-start mb-3">
                <div>
                  <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase" x-text="car.category"></span>
                  <h4 class="text-base font-extrabold text-slate-900 mt-1" x-text="car.brand + ' ' + car.model"></h4>
                </div>
                <span :class="car.available ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-rose-600 bg-rose-50 border-rose-200'" class="px-2.5 py-1 rounded-lg text-[10px] font-black border" x-text="car.available ? 'MÜSAİT' : 'KİRADA'"></span>
              </div>
              <p class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-building text-slate-400 mr-1"></i> <span x-text="car.supplierName"></span> (<span x-text="car.country"></span>)</p>
              
              <div class="bg-slate-50 p-3 rounded-2xl my-4 text-xs space-y-1.5 border border-slate-200">
                <div class="flex justify-between"><span class="text-slate-500">Net / Satış:</span><span class="font-bold text-slate-900" x-text="car.supplierPrice + '€ / ' + car.customerPrice + '€'"></span></div>
                <div class="flex justify-between"><span class="text-slate-500">Yayınlanma:</span><span class="font-bold text-slate-700" x-text="new Date(car.createdAt).toLocaleString('tr-TR')"></span></div>
              </div>
            </div>
            
            <div class="pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
              <button @click="toggleStatus(car._id)" class="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-2 rounded-xl font-bold transition-all">Durum Değiştir</button>
              <button @click="deleteCar(car._id)" class="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 px-3 py-2 rounded-xl font-bold transition-all"><i class="fa-solid fa-trash-can mr-1"></i> Aracı Kaldır</button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- SEKME 2: TEDARİKÇİ AĞI -->
    <div x-show="activeTab === 'partners'" x-cloak x-transition>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-extrabold text-slate-900">Ülke Bazlı Tedarikçi Hacim Raporu</h2>
          <p class="text-xs text-slate-500 mt-1">Ülkelere göre gruplanmış tedarikçi firmalarınız ve bölgesel araç hacimleriniz</p>
        </div>
        <div class="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200">
          Aktif Bölge: <span class="text-slate-900 font-black" x-text="groupedSuppliersByCountry.length">0</span> Ülke
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <template x-for="group in groupedSuppliersByCountry" :key="group.country">
          <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                <div class="flex items-center space-x-3">
                  <div class="text-4xl" x-text="group.flag"></div>
                  <div>
                    <h3 class="text-xl font-black text-slate-900" x-text="group.country"></h3>
                    <p class="text-xs text-slate-500">Toplam <strong class="text-slate-900" x-text="group.suppliers.length"></strong> Firma / <strong class="text-emerald-600" x-text="group.totalCars"></strong> Araç Hacmi</p>
                  </div>
                </div>
              </div>
              <div class="space-y-3">
                <template x-for="supplier in group.suppliers" :key="supplier.name">
                  <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex justify-between items-center">
                    <div>
                      <h4 class="text-sm font-bold text-slate-900" x-text="supplier.name"></h4>
                      <p class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-phone text-emerald-600 mr-1"></i> <span class="font-mono" x-text="supplier.contact"></span></p>
                    </div>
                    <span class="bg-slate-200 text-slate-800 text-xs font-bold px-3 py-1 rounded-full" x-text="supplier.carCount + ' Araç'"></span>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- SEKME 3: META-SEARCH FEED -->
    <div x-show="activeTab === 'integrations'" x-cloak x-transition>
      <div class="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <div class="flex items-center space-x-3 mb-6 border-b border-slate-100 pb-4">
          <div class="bg-slate-900 text-white p-3 rounded-2xl flex items-center justify-center text-xl shadow"><i class="fa-solid fa-satellite-dish"></i></div>
          <div>
            <h2 class="text-xl font-black text-slate-900">Meta-Search Entegrasyon Merkezi</h2>
            <p class="text-xs text-slate-500">Skyscanner ve Kayak gibi platformların envanterinizi çekeceği açık API adresi.</p>
          </div>
        </div>

        <div class="space-y-4">
          <div class="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-2">
            <span class="text-xs font-bold text-slate-600 uppercase tracking-wider block">Resmi JSON Feed Bağlantı Adresi</span>
            <div class="flex space-x-2">
              <input type="text" readonly :value="windowOrigin + '/api/feed/global-inventory'" class="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-xs text-emerald-600 font-mono focus:outline-none">
              <button @click="navigator.clipboard.writeText(windowOrigin + '/api/feed/global-inventory'); alert('URL kopyalandı!')" class="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-3 rounded-xl text-xs whitespace-nowrap shadow">Kopyala</button>
            </div>
          </div>
        </div>
      </div>
    </div>

  </main>

  <script>
    document.addEventListener('alpine:init', () => {
      Alpine.data('adminApp', () => ({
        activeTab: 'admin',
        cars: [],
        windowOrigin: window.location.origin,
        async init() { await this.fetchCars(); },
        async fetchCars() {
          const res = await fetch('/api/cars');
          this.cars = await res.json();
        },
        async toggleStatus(id) {
          await fetch('/api/cars/' + id + '/status', { method: 'PATCH' });
          await this.fetchCars();
        },
        async deleteCar(id) {
          if (confirm('Bu aracı sistemden kaldırmak istediğinize emin misiniz?')) {
            const res = await fetch('/api/cars/' + id, { method: 'DELETE' });
            if (res.ok) { await this.fetchCars(); }
            else { alert('Araç kaldırılamadı.'); }
          }
        },
        get totalProfits() {
          const totals = {};
          this.cars.filter(c => c.available).forEach(c => {
            const cur = c.currency || '€';
            totals[cur] = (totals[cur] || 0) + (c.customerPrice - c.supplierPrice);
          });
          return totals;
        },
        getFlag(country) {
          const flags = { 'Karadağ': '🇲🇪', 'Türkiye': '🇹🇷', 'Sırbistan': '🇷🇸', 'Arnavutluk': '🇦🇱', 'Bosna Hersek': '🇧🇦', 'Almanya': '🇩🇪', 'İngiltere': '🇬🇧', 'Amerika': '🇺🇸' };
          return flags[country] || '🏳️';
        },
        get groupedSuppliersByCountry() {
          const countryMap = new Map();
          this.cars.forEach(c => {
            if (!c.supplierName || !c.country) return;
            const countryKey = c.country.trim();
            if (!countryMap.has(countryKey)) {
              countryMap.set(countryKey, { country: countryKey, flag: this.getFlag(countryKey), suppliersMap: new Map(), totalCars: 0 });
            }
            const countryGroup = countryMap.get(countryKey);
            countryGroup.totalCars++;
            const supKey = c.supplierName.trim().toLowerCase();
            if (!countryGroup.suppliersMap.has(supKey)) {
              countryGroup.suppliersMap.set(supKey, { name: c.supplierName.trim(), contact: c.supplierContact, carCount: 0 });
            }
            countryGroup.suppliersMap.get(supKey).carCount++;
          });
          const result = [];
          countryMap.forEach((group) => {
            result.push({ country: group.country, flag: group.flag, totalCars: group.totalCars, suppliers: Array.from(group.suppliersMap.values()) });
          });
          return result;
        }
      }));
    });
  </script>
</body>
</html>`);
});


// 5. TEDARİKÇİ PORTALI (Orijinal Site Stilinde Ferah / Açık Tema)
app.get('/tedarikci-paneli', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr" class="h-full bg-slate-50">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexiDrive Tedarikçi Portalı</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    [x-cloak] { display: none !important; }
    select {
      appearance: none;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right 1rem center;
      background-size: 1em;
    }
    select::-ms-expand { display: none; }
  </style>
</head>
<body class="h-full text-slate-900 flex flex-col" x-data="supplierPortal()">

  <header class="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
      <div @click="activeTab = 'cars'" class="flex items-center space-x-3 cursor-pointer group" title="Ana Menüye Dön">
        <div class="bg-red-600 text-white p-2.5 rounded-xl flex items-center justify-center font-black text-lg shadow-md group-hover:scale-105 transition-transform"><i class="fa-solid fa-car"></i></div>
        <span class="text-2xl font-black tracking-tighter text-slate-900">FlexiDrive <span class="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 ml-1">Tedarikçi</span></span>
      </div>
      
      <div class="flex items-center space-x-2" x-show="isLoggedIn">
        <button @click="activeTab = 'cars'" :class="activeTab === 'cars' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center"><i class="fa-solid fa-car mr-1.5"></i> Araçlarım</button>
        <button @click="activeTab = 'wallet'" :class="activeTab === 'wallet' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center"><i class="fa-solid fa-wallet mr-1.5"></i> Hesap Özeti</button>
        <button @click="activeTab = 'stats'" :class="activeTab === 'stats' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center"><i class="fa-solid fa-chart-line mr-1.5"></i> İstatistikler</button>
        <button @click="activeTab = 'add'" :class="activeTab === 'add' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center border border-slate-300"><i class="fa-solid fa-plus-circle mr-1.5"></i> Yeni Araç Ekle</button>
        <button @click="logout()" class="text-rose-600 hover:bg-rose-50 p-2 rounded-xl text-xs transition-all ml-2 border border-rose-200" title="Çıkış Yap"><i class="fa-solid fa-right-from-bracket text-base"></i></button>
      </div>
    </div>
  </header>

  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">

    <div x-show="!isLoggedIn" class="max-w-md mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center">
      <div class="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 border border-red-200"><i class="fa-solid fa-building-user"></i></div>
      <h2 class="text-2xl font-black text-slate-900 mb-2">Tedarikçi Girişi</h2>
      <p class="text-xs text-slate-500 mb-6">Sistemde kayıtlı olan Firma Adınızı yazarak kendi araç filonuza ve finansal özetinize ulaşın.</p>
      
      <form @submit.prevent="loginSupplier()" class="space-y-4">
        <input type="text" x-model="inputCompanyName" required placeholder="Firma Adınız (Örn: budvarent)" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 text-sm text-center font-bold focus:outline-none focus:border-slate-900">
        <button type="submit" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-xl shadow transition-all text-sm">Panele Giriş Yap <i class="fa-solid fa-arrow-right ml-2"></i></button>
      </form>
    </div>

    <div x-show="isLoggedIn" x-cloak class="w-full space-y-6">
      
      <div @click="activeTab = 'cars'" class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-center cursor-pointer hover:border-slate-400 transition-all">
        <div class="flex items-center space-x-4 mb-4 md:mb-0">
          <div class="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center font-black text-xl text-white shadow"><i class="fa-solid fa-car-side"></i></div>
          <div>
            <h2 class="text-xl font-extrabold text-slate-900" x-text="companyName"></h2>
            <p class="text-xs text-slate-500 mt-0.5"><i class="fa-solid fa-circle-check text-emerald-600 mr-1"></i> Aktif Tedarikçi Paneli (Ana Menüye Dön)</p>
          </div>
        </div>
        <div class="flex space-x-4 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs text-center">
          <div><span class="text-slate-400 block uppercase font-bold text-[10px]">Toplam Araç</span><span class="text-lg font-black text-slate-900" x-text="myCars.length">0</span></div>
          <div class="border-l border-slate-200 pl-4"><span class="text-slate-400 block uppercase font-bold text-[10px]">Müsait Araç</span><span class="text-lg font-black text-emerald-600" x-text="myCars.filter(c => c.available).length">0</span></div>
        </div>
      </div>

      <div x-show="activeTab === 'cars'" x-transition>
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-lg font-extrabold text-slate-900"><i class="fa-solid fa-car text-red-600 mr-2"></i> Sistemdeki Araçlarım</h3>
          <button @click="activeTab = 'add'" class="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow"><i class="fa-solid fa-plus mr-1"></i> Yeni Araç Ekle</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <template x-for="car in myCars" :key="car._id">
            <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase" x-text="car.category"></span>
                    <h4 class="text-base font-extrabold text-slate-900 mt-2" x-text="car.brand + ' ' + car.model"></h4>
                    <p class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-location-dot text-red-600 mr-1"></i> <span x-text="car.country + ' / ' + car.airports"></span></p>
                  </div>
                  <span :class="car.available ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-rose-600 bg-rose-50 border-rose-200'" class="px-2.5 py-1 rounded-lg text-[10px] font-black border" x-text="car.available ? 'MÜSAİT' : 'KİRADA'"></span>
                </div>
                <div class="bg-slate-50 p-3 rounded-2xl my-4 text-xs space-y-1.5 border border-slate-200">
                  <div class="flex justify-between"><span class="text-slate-500">Yayınlanma Tarihi:</span><span class="font-bold text-slate-700" x-text="new Date(car.createdAt).toLocaleString('tr-TR')"></span></div>
                  <div class="flex justify-between"><span class="text-slate-500">Günlük Net Kazanç:</span><span class="font-black text-red-600" x-text="car.supplierPrice + ' ' + car.currency"></span></div>
                </div>
              </div>
              <div class="pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
                <span class="text-slate-400">Yıl: <strong class="text-slate-800" x-text="car.year"></strong></span>
                <button @click="toggleMyCarStatus(car._id)" class="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-2 rounded-xl font-bold transition-all">Durum Değiştir</button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div x-show="activeTab === 'wallet'" x-cloak x-transition>
        <h3 class="text-lg font-extrabold text-slate-900 mb-6"><i class="fa-solid fa-wallet text-red-600 mr-2"></i> Hesap Özeti & Finansal Rapor</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Toplam Aktif Araç Kazanç Potansiyeli</span>
            <div class="text-3xl font-black text-red-600" x-text="totalSupplierEarnings + ' €'"></div>
            <p class="text-xs text-slate-500 mt-2">Müsait durumdaki tüm araçlarınızın günlük net toplam kazancıdır.</p>
          </div>
          <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">İş Modeli</span>
            <div class="text-xl font-bold text-slate-900">Global B2B Dağıtım Sözleşmesi</div>
            <p class="text-xs text-slate-500 mt-2">FlexiDrive uluslararası broker ağı iş birliği kapsamındadır.</p>
          </div>
        </div>
      </div>

      <div x-show="activeTab === 'stats'" x-cloak x-transition>
        <h3 class="text-lg font-extrabold text-slate-900 mb-6"><i class="fa-solid fa-chart-line text-red-600 mr-2"></i> Kiralama Performans İstatistikleri</h3>
        <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100 text-xs">
            <span class="text-slate-500 font-bold">Toplam Filo Havuzundaki Payınız</span>
            <span class="text-slate-900 font-black text-sm" x-text="myCars.length + ' Araç'"></span>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-500 font-bold">Operasyonel Durum</span>
            <span class="text-emerald-600 font-black bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">Sorunsuz & Aktif</span>
          </div>
        </div>
      </div>

      <div x-show="activeTab === 'add'" x-cloak x-transition class="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm relative overflow-hidden">
        <h3 class="text-xl font-black text-slate-900 mb-2"><i class="fa-solid fa-plus-circle text-red-600 mr-2"></i> Filoya Yeni Araç Ekle</h3>
        <p class="text-xs text-slate-500 mb-6">Firma adınız otomatik eşleştirilmektedir: <strong class="text-slate-900" x-text="companyName"></strong> (Maksimum günlük net kazanç sınırı 400 €'dur).</p>
        
        <form @submit.prevent="submitCar" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ülke Seçimi</label>
                <select x-model="form.country" @change="updateCountryData(form.country)" required class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 text-sm font-bold">
                  <option value="" disabled selected>Ülke Seçin</option>
                  <template x-for="c in countries" :key="c.name"><option :value="c.name" x-text="c.flag + ' ' + c.name"></option></template>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Havalimanı / Teslim Noktası</label>
                <select x-model="form.airports" required :disabled="!form.country" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 text-sm font-bold disabled:opacity-40">
                  <option value="" disabled selected>Önce Ülke Seçin</option>
                  <template x-for="airport in availableAirports" :key="airport"><option :value="airport" x-text="airport"></option></template>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">İletişim Numarası (Telefon)</label>
                <input type="tel" x-model="form.phoneOnly" required placeholder="5XX XXX XX XX" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 text-sm font-mono">
              </div>
            </div>

            <div class="space-y-4">
              <div class="flex space-x-3">
                <div class="w-1/2">
                  <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Marka</label>
                  <select x-model="form.brand" @change="form.model = ''; availableModels = carData[form.brand] || []" required class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-3 text-slate-900 text-sm font-bold">
                    <option value="" disabled selected>Marka Seçin</option>
                    <template x-for="(models, brandName) in carData" :key="brandName"><option :value="brandName" x-text="brandName"></option></template>
                  </select>
                </div>
                <div class="w-1/2">
                  <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Model</label>
                  <select x-model="form.model" required :disabled="!form.brand" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-3 text-slate-900 text-sm font-bold disabled:opacity-40">
                    <option value="" disabled selected>Önce Marka Seçin</option>
                    <template x-for="modelName in availableModels" :key="modelName"><option :value="modelName" x-text="modelName"></option></template>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Yıl</label>
                  <input type="number" x-model="form.year" required min="2000" max="2027" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-3 text-slate-900 text-sm font-bold">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sınıf</label>
                  <select x-model="form.category" required class="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-3 text-slate-900 text-sm font-bold">
                    <option value="Ekonomik">Ekonomik</option><option value="SUV">SUV</option><option value="Sedan">Sedan</option><option value="Lüks">Lüks</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Yakıt</label>
                  <select x-model="form.fuelType" required class="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-3 text-slate-900 text-sm font-bold">
                    <option value="Benzin">Benzin</option><option value="Dizel">Dizel</option><option value="Hibrit">Hibrit</option><option value="Elektrik">Elektrik</option>
                  </select>
                </div>
              </div>

              <div class="flex space-x-3">
                <div class="w-1/3">
                  <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bavul</label>
                  <input type="number" x-model="form.luggageCapacity" required min="0" max="10" placeholder="Adet" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-3 text-slate-900 text-sm font-bold">
                </div>
                <div class="w-2/3">
                  <label class="block text-[10px] font-black text-red-600 uppercase tracking-wider mb-1">Günlük Net Kazanç (Max 400 €)</label>
                  <div class="relative">
                    <span class="absolute left-3 top-3 text-red-600 font-black text-base" x-text="form.currency"></span>
                    <input type="number" x-model="form.supplierPrice" required min="1" max="400" placeholder="Max 400" class="w-full bg-slate-50 border-2 border-slate-300 rounded-xl pl-8 pr-3 py-3 text-slate-900 text-sm font-black focus:border-slate-900">
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div x-show="message" x-text="message" :class="isError ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'" class="p-3 rounded-xl border text-sm font-bold text-center"></div>
          
          <button type="submit" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-xl shadow transition-all"><i class="fa-solid fa-cloud-arrow-up mr-2"></i> Aracı Sisteme Kaydet ve Listeme Ekle</button>
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
        form: { brand: '', model: '', year: 2026, category: 'Ekonomik', fuelType: 'Benzin', luggageCapacity: 2, phoneOnly: '', dialCode: '+382', country: '', airports: '', supplierPrice: '', currency: '€' },
        message: '',
        isError: false,

        async init() {
          await this.fetchCars();
          const savedCompany = localStorage.getItem('flexi_supplier_company');
          if (savedCompany) { this.companyName = savedCompany; this.isLoggedIn = true; }
        },
        async fetchCars() {
          try { const res = await fetch('/api/cars'); this.cars = await res.json(); } catch (err) {}
        },
        loginSupplier() {
          if (!this.inputCompanyName.trim()) return;
          this.companyName = this.inputCompanyName.trim();
          localStorage.setItem('flexi_supplier_company', this.companyName);
          this.isLoggedIn = true;
        },
        logout() {
          localStorage.removeItem('flexi_supplier_company');
          this.isLoggedIn = false; this.inputCompanyName = '';
        },
        get myCars() {
          if (!this.companyName) return [];
          const currentComp = this.companyName.trim().toLowerCase();
          return this.cars.filter(c => c.supplierName && c.supplierName.trim().toLowerCase() === currentComp);
        },
        get totalSupplierEarnings() {
          return this.myCars.filter(c => c.available).reduce((acc, c) => acc + (c.supplierPrice || 0), 0);
        },
        updateCountryData(val) {
          this.form.airports = ''; 
          const c = this.countries.find(x => x.name === val);
          if (c) { this.form.currency = c.currency; this.form.dialCode = c.dial; this.availableAirports = this.airportData[val] || []; }
          else { this.availableAirports = []; }
        },
        async submitCar() {
          try {
            const priceVal = parseFloat(this.form.supplierPrice);
            if (priceVal > 400) { this.isError = true; this.message = 'Günlük net kazanç 400 € üzerinde olamaz!'; return; }

            const fullContact = this.form.dialCode + ' ' + this.form.phoneOnly;
            const payload = { ...this.form, supplierName: this.companyName, supplierContact: fullContact };

            const res = await fetch('/api/cars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) {
              this.isError = false; this.message = 'Aracınız başarıyla yayına alındı!';
              await this.fetchCars(); this.activeTab = 'cars';
              setTimeout(() => { this.message = ''; }, 3000); 
            } else { 
              const errData = await res.json();
              this.isError = true; this.message = errData.error || 'Kayıt başarısız.'; 
            }
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
  console.log(`FlexiDrive şık açık tema sunucusu http://localhost:${PORT} adresinde aktif!`);
});
