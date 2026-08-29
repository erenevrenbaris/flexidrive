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

// KÜRESEL META-SEARCH OPEN API FEED
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
    res.json({ success: true, message: 'Araç sistemden kaldırıldı.' });
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

// 4. KURUMSAL ADMIN PANELİ (Kırmızı & Altın Sarısı VIP Tasarım)
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr" class="h-full bg-zinc-950">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexiDrive Enterprise HQ | VIP</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    [x-cloak] { display: none !important; }
    .gold-gradient { background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); }
    .gold-text { background: linear-gradient(135deg, #fde047 0%, #ca8a04 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .gold-border { border-color: rgba(234, 179, 8, 0.3); }
    .coca-red { background-color: #f40009; }
    .coca-red-hover:hover { background-color: #d10007; }
    select {
      appearance: none;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fde047' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right 1rem center;
      background-size: 1em;
    }
    select::-ms-expand { display: none; }
  </style>
</head>
<body class="h-full text-zinc-100 flex flex-col" x-data="adminApp()">

  <header class="bg-zinc-900 border-b border-amber-500/20 sticky top-0 z-40 backdrop-blur-md bg-opacity-95">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="coca-red text-white p-2.5 rounded-xl flex items-center justify-center font-black text-lg shadow-lg shadow-red-600/30"><i class="fa-solid fa-earth-europe"></i></div>
        <div>
          <span class="text-xl font-extrabold tracking-tight gold-text">FlexiDrive</span> 
          <span class="text-[9px] text-amber-400 ml-1 font-extrabold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 uppercase tracking-widest">VIP HQ</span>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <button @click="activeTab = 'admin'" :class="activeTab === 'admin' ? 'coca-red text-white shadow-lg shadow-red-600/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center">
          <i class="fa-solid fa-car mr-1.5"></i> Filo Operasyonları
        </button>
        <button @click="activeTab = 'partners'" :class="activeTab === 'partners' ? 'coca-red text-white shadow-lg shadow-red-600/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center">
          <i class="fa-solid fa-handshake mr-1.5"></i> Tedarikçi Ağı
        </button>
        <button @click="activeTab = 'integrations'" :class="activeTab === 'integrations' ? 'coca-red text-white shadow-lg shadow-red-600/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center">
          <i class="fa-solid fa-network-wired mr-1.5"></i> Meta-Search Entegrasyonları
        </button>
        <a href="/tedarikci-paneli" target="_blank" class="text-amber-400 hover:bg-amber-500/10 px-4 py-2 rounded-xl font-semibold text-xs transition-all border border-amber-500/40 flex items-center">
          <i class="fa-solid fa-external-link-alt mr-1.5"></i> Tedarikçi Portalı
        </a>
      </div>
    </div>
  </header>

  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

    <div x-show="activeTab === 'admin'" x-transition>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-zinc-900 border border-amber-500/20 p-5 rounded-2xl shadow-sm flex justify-between items-center"><div><p class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Toplam Filo</p><h3 class="text-3xl font-black mt-1 text-white" x-text="cars.length">0</h3></div><div class="text-amber-400 text-3xl opacity-60"><i class="fa-solid fa-car"></i></div></div>
        <div class="bg-zinc-900 border border-amber-500/20 p-5 rounded-2xl shadow-sm flex justify-between items-center"><div><p class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Aktif / Müsait</p><h3 class="text-3xl font-black mt-1 text-emerald-400" x-text="cars.filter(c => c.available).length">0</h3></div><div class="text-emerald-400 text-3xl opacity-60"><i class="fa-solid fa-circle-check"></i></div></div>
        <div class="bg-zinc-900 border border-amber-500/20 p-5 rounded-2xl shadow-sm flex justify-between items-center"><div><p class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Hizmet Modeli</p><h3 class="text-3xl font-black mt-1 gold-text">VIP B2B</h3></div><div class="text-amber-400 text-3xl opacity-60"><i class="fa-solid fa-crown"></i></div></div>
        <div class="bg-zinc-900 border border-amber-500/20 p-4 rounded-2xl shadow-sm flex justify-between items-center overflow-hidden">
          <div>
            <p class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Günlük Potansiyel Ciro</p>
            <div class="flex flex-col space-y-1">
              <template x-for="(val, cur) in totalProfits" :key="cur"><span class="text-lg font-black text-amber-400 leading-none" x-text="val + ' ' + cur"></span></template>
              <span x-show="Object.keys(totalProfits).length === 0" class="text-lg font-black text-zinc-500">0</span>
            </div>
          </div>
          <div class="text-amber-400 text-3xl opacity-60"><i class="fa-solid fa-wallet"></i></div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <template x-for="car in cars" :key="car._id">
          <div class="bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-xl">
            <div>
              <div class="flex justify-between items-start mb-2">
                <div>
                  <span class="text-[9px] font-extrabold px-2 py-0.5 rounded bg-zinc-800 text-amber-400 uppercase" x-text="car.category"></span>
                  <h4 class="text-base font-extrabold text-white mt-1" x-text="car.brand + ' ' + car.model"></h4>
                </div>
                <span :class="car.available ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'" class="px-2 py-0.5 rounded text-[10px] font-black border" x-text="car.available ? 'MÜSAİT' : 'KİRADA'"></span>
              </div>
              <p class="text-xs text-zinc-400 mt-1"><i class="fa-solid fa-building text-amber-400 mr-1"></i> <span x-text="car.supplierName"></span> (<span x-text="car.country"></span>)</p>
              
              <div class="bg-zinc-950 p-2.5 rounded-xl my-3 text-xs space-y-1 border border-zinc-800">
                <div class="flex justify-between"><span class="text-zinc-500">Net / Satış:</span><span class="font-bold text-amber-400" x-text="car.supplierPrice + '€ / ' + car.customerPrice + '€'"></span></div>
                <div class="flex justify-between"><span class="text-zinc-500">Yayınlanma:</span><span class="font-bold text-zinc-300" x-text="new Date(car.createdAt).toLocaleString('tr-TR')"></span></div>
              </div>
            </div>
            
            <div class="pt-3 border-t border-zinc-800 flex justify-between items-center text-xs">
              <button @click="toggleStatus(car._id)" class="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg font-bold transition-all">Durum Değiştir</button>
              <button @click="deleteCar(car._id)" class="coca-red coca-red-hover text-white px-3 py-1.5 rounded-lg font-bold transition-all shadow-md shadow-red-600/20"><i class="fa-solid fa-trash-can mr-1"></i> Aracı Kaldır</button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- SEKME 2: TEDARİKÇİ AĞI -->
    <div x-show="activeTab === 'partners'" x-cloak x-transition>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-extrabold text-white"><i class="fa-solid fa-earth-europe text-amber-400 mr-2"></i> Ülke Bazlı Tedarikçi Hacim Raporu</h2>
          <p class="text-xs text-zinc-400 mt-1">Ülkelere göre gruplanmış tedarikçi firmalarınız ve bölgesel araç hacimleriniz</p>
        </div>
        <div class="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-2 rounded-xl text-xs font-bold">
          Aktif Ülke Sayısı: <span class="text-white font-black" x-text="groupedSuppliersByCountry.length">0</span> Bölge
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <template x-for="group in groupedSuppliersByCountry" :key="group.country">
          <div class="bg-zinc-900 border border-amber-500/20 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800">
                <div class="flex items-center space-x-3">
                  <div class="text-4xl" x-text="group.flag"></div>
                  <div>
                    <h3 class="text-xl font-black text-white" x-text="group.country"></h3>
                    <p class="text-xs text-zinc-400">Toplam <strong class="text-amber-400" x-text="group.suppliers.length"></strong> Firma / <strong class="text-emerald-400" x-text="group.totalCars"></strong> Araç Hacmi</p>
                  </div>
                </div>
              </div>
              <div class="space-y-3">
                <template x-for="supplier in group.suppliers" :key="supplier.name">
                  <div class="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex justify-between items-center">
                    <div>
                      <h4 class="text-sm font-bold text-white" x-text="supplier.name"></h4>
                      <p class="text-xs text-zinc-400 mt-1"><i class="fa-solid fa-phone text-emerald-400 mr-1"></i> <span class="font-mono" x-text="supplier.contact"></span></p>
                    </div>
                    <span class="bg-amber-500/10 text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/20" x-text="supplier.carCount + ' Araç'"></span>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- SEKME 3: META-SEARCH ENTEGRASYONLARI -->
    <div x-show="activeTab === 'integrations'" x-cloak x-transition>
      <div class="bg-zinc-900 border border-amber-500/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div class="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-3xl"></div>
        
        <div class="flex items-center space-x-3 mb-6 border-b border-zinc-800 pb-4 relative z-10">
          <div class="coca-red text-white p-3 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-red-600/30"><i class="fa-solid fa-satellite-dish"></i></div>
          <div>
            <h2 class="text-2xl font-black text-white">Küresel Meta-Search Entegrasyon Merkezi</h2>
            <p class="text-xs text-zinc-400">Skyscanner, Kayak ve Discover Cars gibi devlerin envanterinizi otomatik çekmesi için API Feed altyapısı.</p>
          </div>
        </div>

        <div class="space-y-6 relative z-10">
          <div class="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 space-y-3">
            <span class="text-xs font-bold text-amber-400 uppercase tracking-widest block"><i class="fa-solid fa-link mr-1"></i> Resmi JSON / XML Feed Bağlantı Adresi</span>
            <div class="flex space-x-3">
              <input type="text" readonly :value="windowOrigin + '/api/feed/global-inventory'" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-xs text-amber-400 font-mono focus:outline-none">
              <button @click="navigator.clipboard.writeText(windowOrigin + '/api/feed/global-inventory'); alert('Feed URL kopyalandı!')" class="coca-red coca-red-hover text-white font-bold px-6 py-3 rounded-xl text-xs whitespace-nowrap shadow-lg shadow-red-600/20">
                <i class="fa-regular fa-copy mr-1.5"></i> URL'yi Kopyala
              </button>
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


// 5. TEDARİKÇİ PORTALI (Kırmızı & Altın Sarısı VIP Tasarım)
app.get('/tedarikci-paneli', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr" class="h-full bg-zinc-950">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexiDrive Tedarikçi Portal | VIP</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    [x-cloak] { display: none !important; }
    .gold-gradient { background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); }
    .gold-text { background: linear-gradient(135deg, #fde047 0%, #ca8a04 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .coca-red { background-color: #f40009; }
    .coca-red-hover:hover { background-color: #d10007; }
    select {
      appearance: none;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fde047' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right 1rem center;
      background-size: 1em;
    }
    select::-ms-expand { display: none; }
  </style>
</head>
<body class="h-full text-zinc-100 flex flex-col" x-data="supplierPortal()">

  <header class="bg-zinc-900 border-b border-amber-500/20 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div @click="activeTab = 'cars'" class="flex items-center space-x-3 cursor-pointer group" title="Ana Menüye Dön">
        <div class="coca-red text-white p-2.5 rounded-xl flex items-center justify-center font-black text-lg shadow-lg shadow-red-600/30 group-hover:scale-105 transition-transform"><i class="fa-solid fa-car-side"></i></div>
        <div>
          <span class="text-xl font-extrabold tracking-tight gold-text">FlexiDrive</span> 
          <span class="text-[9px] text-amber-400 ml-1 font-extrabold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30 uppercase tracking-widest">Tedarikçi Portalı</span>
        </div>
      </div>
      
      <div class="flex items-center space-x-2" x-show="isLoggedIn">
        <button @click="activeTab = 'cars'" :class="activeTab === 'cars' ? 'coca-red text-white shadow-lg shadow-red-600/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center"><i class="fa-solid fa-car mr-1.5"></i> Araçlarım</button>
        <button @click="activeTab = 'wallet'" :class="activeTab === 'wallet' ? 'coca-red text-white shadow-lg shadow-red-600/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center"><i class="fa-solid fa-wallet mr-1.5"></i> Hesap Özeti</button>
        <button @click="activeTab = 'stats'" :class="activeTab === 'stats' ? 'coca-red text-white shadow-lg shadow-red-600/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center"><i class="fa-solid fa-chart-line mr-1.5"></i> İstatistikler</button>
        <button @click="activeTab = 'add'" :class="activeTab === 'add' ? 'coca-red text-white shadow-lg shadow-red-600/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'" class="px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center border border-amber-500/40"><i class="fa-solid fa-plus-circle mr-1.5"></i> Yeni Araç Ekle</button>
        <button @click="logout()" class="text-red-400 hover:bg-red-500/10 p-2 rounded-xl text-xs transition-all ml-2" title="Çıkış Yap"><i class="fa-solid fa-right-from-bracket text-base"></i></button>
      </div>
    </div>
  </header>

  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">

    <div x-show="!isLoggedIn" class="max-w-md mx-auto bg-zinc-900 border border-amber-500/30 rounded-3xl p-8 shadow-2xl text-center">
      <div class="w-16 h-16 coca-red/20 text-red-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-red-500/30"><i class="fa-solid fa-building-user"></i></div>
      <h2 class="text-2xl font-black text-white mb-2">Tedarikçi Girişi</h2>
      <p class="text-xs text-zinc-400 mb-6">Sistemde kayıtlı olan Firma Adınızı yazarak kendi araç filonuza ve finansal özetinize ulaşın.</p>
      
      <form @submit.prevent="loginSupplier()" class="space-y-4">
        <input type="text" x-model="inputCompanyName" required placeholder="Firma Adınız (Örn: budvarent)" class="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm text-center font-bold focus:outline-none focus:border-amber-500">
        <button type="submit" class="w-full coca-red coca-red-hover text-white font-black py-3 rounded-xl shadow-lg shadow-red-600/30 transition-all text-sm">Panele Giriş Yap <i class="fa-solid fa-arrow-right ml-2"></i></button>
      </form>
    </div>

    <div x-show="isLoggedIn" x-cloak class="w-full space-y-6">
      
      <div @click="activeTab = 'cars'" class="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-900 border border-amber-500/30 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-center cursor-pointer hover:border-amber-500/60 transition-all">
        <div class="flex items-center space-x-4 mb-4 md:mb-0">
          <div class="w-14 h-14 rounded-2xl coca-red flex items-center justify-center font-black text-xl text-white shadow-lg shadow-red-600/30"><i class="fa-solid fa-car-side"></i></div>
          <div>
            <h2 class="text-xl font-extrabold text-white" x-text="companyName"></h2>
            <p class="text-xs text-zinc-400 mt-0.5"><i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i> VIP Tedarikçi Paneli (Ana Menüye Dön)</p>
          </div>
        </div>
        <div class="flex space-x-4 bg-zinc-950 p-3 rounded-2xl border border-zinc-800 text-xs text-center">
          <div><span class="text-zinc-500 block uppercase font-bold text-[10px]">Toplam Araç</span><span class="text-lg font-black text-white" x-text="myCars.length">0</span></div>
          <div class="border-l border-zinc-800 pl-4"><span class="text-zinc-500 block uppercase font-bold text-[10px]">Müsait Araç</span><span class="text-lg font-black text-emerald-400" x-text="myCars.filter(c => c.available).length">0</span></div>
        </div>
      </div>

      <div x-show="activeTab === 'cars'" x-transition>
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-lg font-extrabold text-white"><i class="fa-solid fa-car text-amber-400 mr-2"></i> Sistemdeki Araçlarım</h3>
          <button @click="activeTab = 'add'" class="coca-red coca-red-hover text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-lg shadow-red-600/20"><i class="fa-solid fa-plus mr-1"></i> Yeni Araç Ekle</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <template x-for="car in myCars" :key="car._id">
            <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-amber-500/40 transition-all flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-amber-400 uppercase" x-text="car.category"></span>
                    <h4 class="text-base font-extrabold text-white mt-2" x-text="car.brand + ' ' + car.model"></h4>
                    <p class="text-xs text-zinc-400 mt-1"><i class="fa-solid fa-location-dot text-amber-400 mr-1"></i> <span x-text="car.country + ' / ' + car.airports"></span></p>
                  </div>
                  <span :class="car.available ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'" class="px-2 py-1 rounded text-[10px] font-black" x-text="car.available ? 'MÜSAİT' : 'KİRADA'"></span>
                </div>
                <div class="bg-zinc-950 p-3 rounded-xl my-3 text-xs space-y-1.5 border border-zinc-800">
                  <div class="flex justify-between"><span class="text-zinc-500">Yayınlanma Tarihi:</span><span class="font-bold text-amber-300" x-text="new Date(car.createdAt).toLocaleString('tr-TR')"></span></div>
                  <div class="flex justify-between"><span class="text-zinc-500">Günlük Net Kazanç:</span><span class="font-black text-amber-400" x-text="car.supplierPrice + ' ' + car.currency"></span></div>
                </div>
              </div>
              <div class="pt-3 border-t border-zinc-800 flex justify-between items-center text-xs">
                <span class="text-zinc-500">Yıl: <strong class="text-white" x-text="car.year"></strong></span>
                <button @click="toggleMyCarStatus(car._id)" class="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg font-bold transition-all">Durum Değiştir</button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div x-show="activeTab === 'wallet'" x-cloak x-transition>
        <h3 class="text-lg font-extrabold text-white mb-6"><i class="fa-solid fa-wallet text-amber-400 mr-2"></i> Hesap Özeti & Finansal Rapor</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div class="bg-zinc-900 border border-amber-500/20 rounded-2xl p-6">
            <span class="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Toplam Aktif Araç Kazanç Potansiyeli</span>
            <div class="text-3xl font-black text-amber-400" x-text="totalSupplierEarnings + ' €'"></div>
            <p class="text-xs text-zinc-500 mt-2">Müsait durumdaki tüm araçlarınızın günlük net toplam kazancıdır.</p>
          </div>
          <div class="bg-zinc-900 border border-amber-500/20 rounded-2xl p-6">
            <span class="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Dağıtım Ağı Modeli</span>
            <div class="text-2xl font-black gold-text">Global B2B Sözleşmesi</div>
            <p class="text-xs text-zinc-500 mt-2">FlexiDrive uluslararası havalimanı ve broker dağıtım anlaşması kapsamındadır.</p>
          </div>
        </div>
      </div>

      <div x-show="activeTab === 'stats'" x-cloak x-transition>
        <h3 class="text-lg font-extrabold text-white mb-6"><i class="fa-solid fa-chart-line text-amber-400 mr-2"></i> Kiralama Performans İstatistikleri</h3>
        <div class="bg-zinc-900 border border-amber-500/20 rounded-2xl p-6 space-y-4">
          <div class="flex justify-between items-center pb-4 border-b border-zinc-800 text-xs">
            <span class="text-zinc-400 font-bold">Toplam Filo Havuzundaki Payınız</span>
            <span class="text-white font-black text-sm" x-text="myCars.length + ' Araç'"></span>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-zinc-400 font-bold">Operasyonel Durum</span>
            <span class="text-emerald-400 font-black bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">Sorunsuz & Aktif</span>
          </div>
        </div>
      </div>

      <div x-show="activeTab === 'add'" x-cloak x-transition class="bg-zinc-900 border border-amber-500/30 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <h3 class="text-xl font-black text-white mb-2"><i class="fa-solid fa-plus-circle text-amber-400 mr-2"></i> Filoya Yeni Araç Ekle</h3>
        <p class="text-xs text-zinc-400 mb-6">Firma adınız otomatik eşleştirilmektedir: <strong class="text-amber-400" x-text="companyName"></strong> (Maksimum günlük net kazanç sınırı 400 €'dur).</p>
        
        <form @submit.prevent="submitCar" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <div>
                <label class="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Ülke Seçimi</label>
                <select x-model="form.country" @change="updateCountryData(form.country)" required class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm font-bold">
                  <option value="" disabled selected>Ülke Seçin</option>
                  <template x-for="c in countries" :key="c.name"><option :value="c.name" x-text="c.flag + ' ' + c.name"></option></template>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Havalimanı / Teslim Noktası</label>
                <select x-model="form.airports" required :disabled="!form.country" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm font-bold disabled:opacity-40">
                  <option value="" disabled selected>Önce Ülke Seçin</option>
                  <template x-for="airport in availableAirports" :key="airport"><option :value="airport" x-text="airport"></option></template>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">İletişim Numarası (Telefon)</label>
                <input type="tel" x-model="form.phoneOnly" required placeholder="5XX XXX XX XX" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm font-mono">
              </div>
            </div>

            <div class="space-y-4">
              <div class="flex space-x-3">
                <div class="w-1/2">
                  <label class="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Marka</label>
                  <select x-model="form.brand" @change="form.model = ''; availableModels = carData[form.brand] || []" required class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-white text-sm font-bold">
                    <option value="" disabled selected>Marka Seçin</option>
                    <template x-for="(models, brandName) in carData" :key="brandName"><option :value="brandName" x-text="brandName"></option></template>
                  </select>
                </div>
                <div class="w-1/2">
                  <label class="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Model</label>
                  <select x-model="form.model" required :disabled="!form.brand" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-white text-sm font-bold disabled:opacity-40">
                    <option value="" disabled selected>Önce Marka Seçin</option>
                    <template x-for="modelName in availableModels" :key="modelName"><option :value="modelName" x-text="modelName"></option></template>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Yıl</label>
                  <input type="number" x-model="form.year" required min="2000" max="2027" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-white text-sm font-bold">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Sınıf</label>
                  <select x-model="form.category" required class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-3 text-white text-sm font-bold">
                    <option value="Ekonomik">Ekonomik</option><option value="SUV">SUV</option><option value="Sedan">Sedan</option><option value="Lüks">Lüks</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Yakıt</label>
                  <select x-model="form.fuelType" required class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-3 text-white text-sm font-bold">
                    <option value="Benzin">Benzin</option><option value="Dizel">Dizel</option><option value="Hibrit">Hibrit</option><option value="Elektrik">Elektrik</option>
                  </select>
                </div>
              </div>

              <div class="flex space-x-3">
                <div class="w-1/3">
                  <label class="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Bavul</label>
                  <input type="number" x-model="form.luggageCapacity" required min="0" max="10" placeholder="Adet" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-white text-sm font-bold">
                </div>
                <div class="w-2/3">
                  <label class="block text-[10px] font-black text-amber-400 uppercase tracking-wider mb-1">Günlük Net Kazanç (Max 400 €)</label>
                  <div class="relative">
                    <span class="absolute left-3 top-3 text-amber-400 font-black text-base" x-text="form.currency"></span>
                    <input type="number" x-model="form.supplierPrice" required min="1" max="400" placeholder="Max 400" class="w-full bg-zinc-950 border-2 border-amber-500/40 rounded-xl pl-8 pr-3 py-3 text-white text-sm font-black">
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div x-show="message" x-text="message" :class="isError ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'" class="p-3 rounded-xl border text-sm font-bold text-center"></div>
          
          <button type="submit" class="w-full coca-red coca-red-hover text-white font-black py-4 rounded-xl shadow-lg shadow-red-600/30 transition-all"><i class="fa-solid fa-cloud-arrow-up mr-2"></i> Aracı Sisteme Kaydet ve Listeme Ekle</button>
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
  console.log(`FlexiDrive VIP Enterprise sunucusu http://localhost:${PORT} adresinde aktif!`);
});
