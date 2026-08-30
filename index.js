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

// 2. Veritabanı Modeli
const CarSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, default: 2026 },
  category: { type: String, default: "Ekonomik" },
  fuelType: { type: String, default: "Benzin" },
  luggageCapacity: { type: Number, default: 2 },
  supplierName: { type: String, required: true },
  supplierPassword: { type: String, default: "flexi2026" },
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
    const { brand, model, year, category, fuelType, luggageCapacity, supplierName, supplierPassword, supplierContact, country, airports, supplierPrice, currency } = req.body;
    
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
    const password = supplierPassword ? supplierPassword.trim() : 'flexi2026';

    const newCar = new Car({
      brand, model, year: year || 2026, category: category || 'Ekonomik', fuelType: fuelType || 'Benzin', luggageCapacity: luggageCapacity || 2,
      supplierName: normalizedSupplierName, supplierPassword: password, supplierContact, country, airports, supplierPrice: supPrice, commissionRate: commRate, customerPrice, currency: currency || '€', available: true
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

// 4. KURUMSAL ADMIN PANELİ (Sol Üst Logo Menüsü ve Çoklu Dil Desteği ile)
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr" class="h-full" style="background-color: #242220;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexiDrive Admin HQ</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #242220; color: #f5f5f4; }
    [x-cloak] { display: none !important; }
    .gold-border { border-color: rgba(217, 119, 6, 0.4); }
    .gold-badge { background-color: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(217, 119, 6, 0.4); }
    .gold-btn { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; }
    .gold-btn:hover { background: linear-gradient(135deg, #d97706 0%, #b45309 100%); }
    .car-card-bg {
      background-image: linear-gradient(to bottom, rgba(28, 25, 23, 0.95), rgba(28, 25, 23, 0.99)), url('https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80');
      background-size: cover;
      background-position: center;
    }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #1c1a18; border-radius: 4px; }
    ::-webkit-scrollbar-thumb { background: #d97706; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #f59e0b; }
  </style>
</head>
<body class="h-full flex flex-col justify-between" x-data="adminApp()">

  <div>
    <header class="bg-[#1c1a18] border-b gold-border sticky top-0 z-40 shadow-xl">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        <!-- SOL ÜST LOGO VE TIKLANINCA AÇILAN ANA MENÜ -->
        <div class="relative" x-data="{ menuOpen: false }">
          <div @click="menuOpen = !menuOpen" class="flex items-center space-x-3 cursor-pointer group" title="Ana Menüyü Aç">
            <div class="gold-btn p-2.5 rounded-xl flex items-center justify-center font-black text-lg shadow-md group-hover:scale-105 transition-transform"><i class="fa-solid fa-bars"></i></div>
            <div>
              <span class="text-2xl font-black tracking-tight text-white">FlexiDrive</span> 
              <span class="text-[9px] font-extrabold gold-badge px-2 py-0.5 rounded-full ml-1 uppercase tracking-widest">HQ</span>
            </div>
          </div>

          <!-- AÇILIR ANA MENÜ PENCERESİ -->
          <div x-show="menuOpen" @click.outside="menuOpen = false" x-cloak class="absolute left-0 mt-3 w-56 bg-[#1c1a18] border gold-border rounded-2xl shadow-2xl py-2 z-50 text-xs font-bold text-stone-200">
            <div class="px-4 py-2 border-b border-stone-800 text-[10px] text-amber-400 uppercase tracking-widest font-black">Hızlı Menü</div>
            <a href="/" @click="activeTab = 'admin'; menuOpen = false" class="flex items-center px-4 py-2.5 hover:bg-stone-800 hover:text-white transition-all"><i class="fa-solid fa-car text-amber-400 mr-2.5"></i> Filo Operasyonları</a>
            <a href="/" @click="activeTab = 'partners'; menuOpen = false" class="flex items-center px-4 py-2.5 hover:bg-stone-800 hover:text-white transition-all"><i class="fa-solid fa-earth-europe text-amber-400 mr-2.5"></i> Tedarikçi Ağı</a>
            <a href="/" @click="activeTab = 'integrations'; menuOpen = false" class="flex items-center px-4 py-2.5 hover:bg-stone-800 hover:text-white transition-all"><i class="fa-solid fa-network-wired text-amber-400 mr-2.5"></i> Meta-Search Feed</a>
            <div class="border-t border-stone-800 my-1"></div>
            <a href="/tedarikci-paneli" target="_blank" class="flex items-center px-4 py-2.5 text-emerald-400 hover:bg-stone-800 transition-all"><i class="fa-solid fa-external-link-alt mr-2.5"></i> Tedarikçi Portalı</a>
          </div>
        </div>

        <!-- SAĞ ÜST MENÜ & DİL SEÇİCİ -->
        <div class="flex items-center space-x-3">
          <button @click="activeTab = 'admin'" :class="activeTab === 'admin' ? 'gold-btn shadow-md' : 'text-stone-400 hover:bg-stone-800'" class="px-4 py-2 rounded-xl font-bold text-xs transition-all">
            <i class="fa-solid fa-car mr-1.5"></i> <span x-text="t('fleet')">Filo Operasyonları</span>
          </button>
          <button @click="activeTab = 'partners'" :class="activeTab === 'partners' ? 'gold-btn shadow-md' : 'text-stone-400 hover:bg-stone-800'" class="px-4 py-2 rounded-xl font-bold text-xs transition-all">
            <i class="fa-solid fa-earth-europe mr-1.5"></i> <span x-text="t('suppliers')">Tedarikçi Ağı</span>
          </button>
          <button @click="activeTab = 'integrations'" :class="activeTab === 'integrations' ? 'gold-btn shadow-md' : 'text-stone-400 hover:bg-stone-800'" class="px-4 py-2 rounded-xl font-bold text-xs transition-all">
            <i class="fa-solid fa-network-wired mr-1.5"></i> <span x-text="t('feed')">Meta-Search Feed</span>
          </button>
          
          <!-- DİL SEÇİM DROPDOWN -->
          <div class="relative" x-data="{ langOpen: false }">
            <button @click="langOpen = !langOpen" class="bg-[#242220] border gold-border text-amber-400 px-3 py-2 rounded-xl font-black text-xs flex items-center shadow">
              <i class="fa-solid fa-globe mr-1.5"></i> <span x-text="currentLang.toUpperCase()"></span> <i class="fa-solid fa-chevron-down ml-1 text-[10px]"></i>
            </button>
            <div x-show="langOpen" @click.outside="langOpen = false" x-cloak class="absolute right-0 mt-2 w-36 bg-[#1c1a18] border gold-border rounded-xl shadow-2xl py-1 z-50 text-xs font-bold">
              <div @click="setLang('tr'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center text-stone-200"><span class="mr-2">🇹🇷</span> Türkçe</div>
              <div @click="setLang('en'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center text-stone-200"><span class="mr-2">🇬🇧</span> English</div>
              <div @click="setLang('de'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center text-stone-200"><span class="mr-2">🇩🇪</span> Deutsch</div>
              <div @click="setLang('it'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center text-stone-200"><span class="mr-2">🇮🇹</span> Italiano</div>
            </div>
          </div>
        </div>

      </div>
    </header>

    <main class="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div x-show="activeTab === 'admin'" x-transition>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div class="bg-[#1c1a18] border gold-border p-6 rounded-3xl shadow-lg flex justify-between items-center"><div><p class="text-xs font-bold text-stone-400 uppercase tracking-wider" x-text="t('totalFleet')">Toplam Filo</p><h3 class="text-3xl font-black mt-1 text-white" x-text="cars.length">0</h3></div><div class="text-amber-400 text-3xl"><i class="fa-solid fa-car"></i></div></div>
          <div class="bg-[#1c1a18] border gold-border p-6 rounded-3xl shadow-lg flex justify-between items-center"><div><p class="text-xs font-bold text-stone-400 uppercase tracking-wider" x-text="t('activeAvailable')">Aktif / Müsait</p><h3 class="text-3xl font-black mt-1 text-emerald-400" x-text="cars.filter(c => c.available).length">0</h3></div><div class="text-emerald-400 text-3xl"><i class="fa-solid fa-circle-check"></i></div></div>
          <div class="bg-[#1c1a18] border gold-border p-6 rounded-3xl shadow-lg flex justify-between items-center overflow-hidden">
            <div>
              <p class="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('dailyRevenue')">Günlük Potansiyel Ciro</p>
              <div class="flex flex-col space-y-1">
                <template x-for="(val, cur) in totalProfits" :key="cur"><span class="text-lg font-black text-amber-400 leading-none" x-text="val + ' ' + cur"></span></template>
                <span x-show="Object.keys(totalProfits).length === 0" class="text-lg font-black text-stone-500">0 €</span>
              </div>
            </div>
            <div class="text-amber-400 text-3xl"><i class="fa-solid fa-wallet"></i></div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <template x-for="car in cars" :key="car._id">
            <div class="car-card-bg border gold-border rounded-3xl p-6 flex flex-col justify-between shadow-xl hover:border-amber-400 transition-all">
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div>
                    <span class="text-[9px] font-black px-2 py-0.5 rounded gold-badge uppercase" x-text="car.category"></span>
                    <h4 class="text-base font-extrabold text-white mt-1" x-text="car.brand + ' ' + car.model"></h4>
                  </div>
                  <span :class="car.available ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'" class="px-2.5 py-1 rounded-lg text-[10px] font-black border" x-text="car.available ? t('available') : t('rented')"></span>
                </div>
                <p class="text-xs font-semibold text-stone-300 mt-1"><i class="fa-solid fa-building text-amber-400 mr-1"></i> <span x-text="car.supplierName"></span> (<span x-text="car.country"></span>)</p>
                
                <div class="bg-[#1c1a18]/80 backdrop-blur-sm p-3 rounded-2xl my-4 text-xs space-y-1.5 border border-stone-800 shadow-inner text-stone-200">
                  <div class="flex justify-between"><span class="text-stone-400 font-medium" x-text="t('netSale')">Net / Satış:</span><span class="font-extrabold text-amber-400" x-text="(car.supplierPrice || 0) + '€ / ' + (car.customerPrice || 0) + '€'"></span></div>
                  <div class="flex justify-between"><span class="text-stone-400 font-medium" x-text="t('published')">Yayınlanma:</span><span class="font-extrabold text-stone-200" x-text="new Date(car.createdAt).toLocaleString('tr-TR')"></span></div>
                </div>
              </div>
              
              <div class="pt-4 border-t border-stone-800 flex justify-between items-center text-xs">
                <button @click="toggleStatus(car._id)" class="bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-2 rounded-xl font-bold transition-all" x-text="t('changeStatus')">Durum Değiştir</button>
                <button @click="deleteCar(car._id)" class="bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 px-3 py-2 rounded-xl font-bold transition-all"><i class="fa-solid fa-trash-can mr-1"></i> <span x-text="t('removeCar')">Aracı Kaldır</span></button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div x-show="activeTab === 'partners'" x-cloak x-transition>
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-xl font-extrabold text-white" x-text="t('supplierReportTitle')">Ülke Bazlı Tedarikçi Hacim Raporu</h2>
            <p class="text-xs font-semibold text-stone-400 mt-1" x-text="t('supplierReportSub')">Ülkelere göre gruplanmış tedarikçi firmalarınız ve bölgesel araç hacimleriniz</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <template x-for="group in groupedSuppliersByCountry" :key="group.country">
            <div class="bg-[#1c1a18] border gold-border rounded-3xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-center mb-6 pb-4 border-b border-stone-800">
                  <div class="flex items-center space-x-3">
                    <div class="text-4xl" x-text="group.flag"></div>
                    <div>
                      <h3 class="text-xl font-black text-white" x-text="group.country"></h3>
                      <p class="text-xs font-semibold text-stone-400"><strong class="text-amber-400" x-text="group.suppliers.length"></strong> Firma / <strong class="text-emerald-400" x-text="group.totalCars"></strong> Araç Hacmi</p>
                    </div>
                  </div>
                </div>
                <div class="space-y-3 max-h-96 overflow-y-auto pr-2">
                  <template x-for="supplier in group.suppliers" :key="supplier.name">
                    <div class="bg-[#242220] border border-stone-800 rounded-2xl p-4 flex justify-between items-center text-stone-200">
                      <div>
                        <h4 class="text-sm font-bold text-white" x-text="supplier.name"></h4>
                        <p class="text-xs font-semibold text-stone-400 mt-1"><i class="fa-solid fa-phone text-emerald-400 mr-1"></i> <span class="font-mono" x-text="supplier.contact"></span></p>
                      </div>
                      <span class="gold-badge text-xs font-extrabold px-3 py-1 rounded-full" x-text="supplier.carCount + ' Araç'"></span>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div x-show="activeTab === 'integrations'" x-cloak x-transition>
        <div class="bg-[#1c1a18] border gold-border rounded-3xl p-8 shadow-xl">
          <div class="flex items-center space-x-3 mb-6 border-b border-stone-800 pb-4">
            <div class="gold-btn p-3 rounded-2xl flex items-center justify-center text-xl shadow"><i class="fa-solid fa-satellite-dish"></i></div>
            <div>
              <h2 class="text-xl font-black text-white" x-text="t('metaTitle')">Meta-Search Entegrasyon Merkezi</h2>
              <p class="text-xs font-semibold text-stone-400" x-text="t('metaSub')">Skyscanner ve Kayak gibi platformların envanterinizi çekeceği açık API adresi.</p>
            </div>
          </div>
          <div class="bg-[#242220] p-6 rounded-2xl border border-stone-800 space-y-2">
            <span class="text-xs font-bold text-stone-300 uppercase tracking-wider block" x-text="t('feedAddress')">Resmi JSON Feed Bağlantı Adresi</span>
            <div class="flex space-x-2">
              <input type="text" readonly :value="windowOrigin + '/api/feed/global-inventory'" class="w-full bg-[#1c1a18] border border-stone-700 rounded-xl px-4 py-3 text-xs text-amber-400 font-mono font-bold focus:outline-none">
              <button @click="navigator.clipboard.writeText(windowOrigin + '/api/feed/global-inventory'); alert('URL kopyalandı!')" class="gold-btn font-extrabold px-5 py-3 rounded-xl text-xs whitespace-nowrap shadow" x-text="t('copy')">Kopyala</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <footer class="w-full py-6 text-center text-xs text-stone-500 border-t border-stone-900 bg-[#1c1a18]/60 backdrop-blur-sm" x-text="t('footer')">
    Tüm Hakları Saklıdır © 2026 FlexiDrive Global OS. Kurumsal B2B Araç Kiralama Ekosistemi.
  </footer>

  <script>
    const TRANSLATIONS = {
      tr: { fleet: 'Filo Operasyonları', suppliers: 'Tedarikçi Ağı', feed: 'Meta-Search Feed', totalFleet: 'Toplam Filo', activeAvailable: 'Aktif / Müsait', dailyRevenue: 'Günlük Potansiyel Ciro', available: 'MÜSAİT', rented: 'KİRADA', netSale: 'Net / Satış:', published: 'Yayınlanma:', changeStatus: 'Durum Değiştir', removeCar: 'Aracı Kaldır', supplierReportTitle: 'Ülke Bazlı Tedarikçi Hacim Raporu', supplierReportSub: 'Ülkelere göre gruplanmış tedarikçi firmalarınız', metaTitle: 'Meta-Search Entegrasyon Merkezi', metaSub: 'Skyscanner ve Kayak gibi platformların envanterinizi çekeceği açık API adresi.', feedAddress: 'Resmi JSON Feed Bağlantı Adresi', copy: 'Kopyala', footer: 'Tüm Hakları Saklıdır © 2026 FlexiDrive Global OS.' },
      en: { fleet: 'Fleet Operations', suppliers: 'Supplier Network', feed: 'Meta-Search Feed', totalFleet: 'Total Fleet', activeAvailable: 'Active / Available', dailyRevenue: 'Daily Potential Revenue', available: 'AVAILABLE', rented: 'RENTED', netSale: 'Net / Sale:', published: 'Published:', changeStatus: 'Toggle Status', removeCar: 'Remove Car', supplierReportTitle: 'Country-Based Supplier Volume Report', supplierReportSub: 'Suppliers grouped by country', metaTitle: 'Meta-Search Integration Center', metaSub: 'Open API address for Skyscanner and Kayak.', feedAddress: 'Official JSON Feed Address', copy: 'Copy', footer: 'All Rights Reserved © 2026 FlexiDrive Global OS.' },
      de: { fleet: 'Flottenbetrieb', suppliers: 'Lieferantennetzwerk', feed: 'Meta-Search Feed', totalFleet: 'Gesamte Flotte', activeAvailable: 'Aktiv / Verfügbar', dailyRevenue: 'Ttäglicher Umsatz', available: 'VERFÜGBAR', rented: 'VERMIETET', netSale: 'Netto / Verkauf:', published: 'Veröffentlicht:', changeStatus: 'Status Ändern', removeCar: 'Fahrzeug Entfernen', supplierReportTitle: 'Länderbasieter Lieferantenbericht', supplierReportSub: 'Lieferanten nach Ländern gruppiert', metaTitle: 'Meta-Search Integrationszentrum', metaSub: 'Offene API-Adresse für Skyscanner und Kayak.', feedAddress: 'Offizielle JSON Feed Adresse', copy: 'Kopieren', footer: 'Alle Rechte vorbehalten © 2026 FlexiDrive Global OS.' },
      it: { fleet: 'Operazioni Flotta', suppliers: 'Rete Fornitori', feed: 'Meta-Search Feed', totalFleet: 'Flotta Totale', activeAvailable: 'Attivo / Disponibile', dailyRevenue: 'Potenziale Ricavo Giornaliero', available: 'DISPONIBILE', rented: 'AFFITTATO', netSale: 'Netto / Vendita:', published: 'Pubblicato:', changeStatus: 'Cambia Stato', removeCar: 'Rimuovi Auto', supplierReportTitle: 'Rapporto Fornitori per Paese', supplierReportSub: 'Fornitori raggruppati per paese', metaTitle: 'Centro Integrazione Meta-Search', metaSub: 'Indirizzo API aperto per Skyscanner e Kayak.', feedAddress: 'Indirizzo JSON Feed Ufficiale', copy: 'Copia', footer: 'Tutti i diritti riservati © 2026 FlexiDrive Global OS.' }
    };

    document.addEventListener('alpine:init', () => {
      Alpine.data('adminApp', () => ({
        activeTab: 'admin',
        cars: [],
        currentLang: 'tr',
        windowOrigin: window.location.origin,
        async init() { await this.fetchCars(); },
        t(key) {
          return TRANSLATIONS[this.currentLang][key] || key;
        },
        setLang(lang) {
          this.currentLang = lang;
        },
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
            totals[cur] = (totals[cur] || 0) + ((c.customerPrice || 0) - (c.supplierPrice || 0));
          });
          return totals;
        },
        getFlag(country) {
          const flags = { 'Almanya': '🇩🇪', 'İtalya': '🇮🇹', 'Yunanistan': '🇬🇷', 'Hırvatistan': '🇭🇷', 'Karadağ': '🇲🇪', 'Türkiye': '🇹🇷', 'Sırbistan': '🇷🇸', 'Arnavutluk': '🇦🇱', 'Bosna Hersek': '🇧🇦', 'Bulgaristan': '🇧🇬', 'Kuzey Makedonya': '🇲🇰' };
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


// 5. TEDARİKÇİ PORTALI (Çoklu Dil Desteğiyle)
app.get('/tedarikci-paneli', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr" class="h-full" style="background-color: #242220;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexiDrive Tedarikçi Portalı</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #242220; color: #f5f5f4; }
    [x-cloak] { display: none !important; }
    .gold-border { border-color: rgba(217, 119, 6, 0.4); }
    .gold-badge { background-color: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(217, 119, 6, 0.4); }
    .gold-btn { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; }
    .gold-btn:hover { background: linear-gradient(135deg, #d97706 0%, #b45309 100%); }
    .car-card-bg {
      background-image: linear-gradient(to bottom, rgba(28, 25, 23, 0.95), rgba(28, 25, 23, 0.99)), url('https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80');
      background-size: cover;
      background-position: center;
    }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #1c1a18; border-radius: 4px; }
    ::-webkit-scrollbar-thumb { background: #d97706; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #f59e0b; }

    select {
      appearance: none;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fbbf24' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right 1rem center;
      background-size: 1em;
    }
    select::-ms-expand { display: none; }
  </style>
</head>
<body class="h-full flex flex-col justify-between" x-data="supplierPortal()">

  <div>
    <header class="bg-[#1c1a18] border-b gold-border sticky top-0 z-40 shadow-xl">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div @click="activeTab = 'cars'" class="flex items-center space-x-3 cursor-pointer group" title="Ana Menüye Dön">
          <div class="gold-btn p-2.5 rounded-xl flex items-center justify-center font-black text-lg shadow-md group-hover:scale-105 transition-transform"><i class="fa-solid fa-car-side"></i></div>
          <div class="flex flex-col">
            <div class="flex items-center space-x-2">
              <span class="text-2xl font-black tracking-tight text-white">FlexiDrive</span>
              <span class="text-[9px] font-extrabold gold-badge px-2 py-0.5 rounded-full uppercase tracking-widest">Tedarikçi</span>
            </div>
            <span class="text-[10px] text-stone-400 font-semibold tracking-wide flex items-center mt-0.5"><i class="fa-solid fa-users mr-1 text-amber-400 text-[9px]"></i> users portal</span>
          </div>
        </div>
        
        <div class="flex items-center space-x-2" x-show="isLoggedIn">
          <button @click="activeTab = 'cars'" :class="activeTab === 'cars' ? 'gold-btn shadow-md' : 'text-stone-400 hover:bg-stone-800'" class="px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center"><i class="fa-solid fa-car mr-1.5"></i> <span x-text="t('myCars')">Araçlarım</span></button>
          <button @click="activeTab = 'wallet'" :class="activeTab === 'wallet' ? 'gold-btn shadow-md' : 'text-stone-400 hover:bg-stone-800'" class="px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center"><i class="fa-solid fa-wallet mr-1.5"></i> <span x-text="t('wallet')">Hesap Özeti</span></button>
          <button @click="activeTab = 'loyalty'" :class="activeTab === 'loyalty' ? 'gold-btn shadow-md' : 'text-stone-400 hover:bg-stone-800'" class="px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center"><i class="fa-solid fa-award mr-1.5"></i> <span x-text="t('loyalty')">Sadakat Primi</span></button>
          <button @click="activeTab = 'stats'" :class="activeTab === 'stats' ? 'gold-btn shadow-md' : 'text-stone-400 hover:bg-stone-800'" class="px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center"><i class="fa-solid fa-chart-line mr-1.5"></i> <span x-text="t('stats')">İstatistikler</span></button>
          
          <button @click="activeTab = 'add'" :class="activeTab === 'add' ? 'bg-amber-500 text-stone-950 shadow-lg ring-2 ring-amber-400' : 'gold-btn shadow-lg shadow-amber-600/20 hover:scale-105'" class="px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center border gold-border">
            <span class="w-5 h-5 rounded-full bg-[#1c1a18] text-amber-400 flex items-center justify-center mr-2 text-xs font-black shadow-inner"><i class="fa-solid fa-plus"></i></span> <span x-text="t('addCar')">Yeni Araç Ekle</span>
          </button>

          <!-- DİL SEÇİM DROPDOWN -->
          <div class="relative ml-2" x-data="{ langOpen: false }">
            <button @click="langOpen = !langOpen" class="bg-[#242220] border gold-border text-amber-400 px-3 py-2 rounded-xl font-black text-xs flex items-center shadow">
              <i class="fa-solid fa-globe mr-1.5"></i> <span x-text="currentLang.toUpperCase()"></span>
            </button>
            <div x-show="langOpen" @click.outside="langOpen = false" x-cloak class="absolute right-0 mt-2 w-36 bg-[#1c1a18] border gold-border rounded-xl shadow-2xl py-1 z-50 text-xs font-bold">
              <div @click="setLang('tr'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center text-stone-200"><span class="mr-2">🇹🇷</span> Türkçe</div>
              <div @click="setLang('en'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center text-stone-200"><span class="mr-2">🇬🇧</span> English</div>
              <div @click="setLang('de'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center text-stone-200"><span class="mr-2">🇩🇪</span> Deutsch</div>
              <div @click="setLang('it'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center text-stone-200"><span class="mr-2">🇮🇹</span> Italiano</div>
            </div>
          </div>

          <button @click="logout()" class="text-rose-400 hover:bg-rose-500/10 p-2 rounded-xl text-xs transition-all ml-1 border border-rose-500/30" title="Çıkış Yap"><i class="fa-solid fa-right-from-bracket text-base"></i></button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">

      <div x-show="!isLoggedIn" class="max-w-md mx-auto bg-[#1c1a18] border gold-border rounded-3xl p-8 shadow-2xl text-center">
        <div class="w-16 h-16 gold-badge rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 border"><i class="fa-solid fa-lock"></i></div>
        <h2 class="text-2xl font-black text-white mb-2" x-text="t('loginTitle')">Tedarikçi Güvenli Giriş</h2>
        <p class="text-xs font-semibold text-stone-400 mb-6" x-text="t('loginSub')">Firma adınızı ve şifrenizi girerek panelinize erişin.</p>
        
        <form @submit.prevent="loginSupplier()" class="space-y-4">
          <input type="text" x-model="inputCompanyName" required placeholder="Firma Adınız (Örn: budvarent)" class="w-full bg-[#242220] border border-stone-700 rounded-xl px-4 py-3 text-white text-sm text-center font-bold focus:outline-none focus:border-amber-400">
          <input type="password" x-model="inputPassword" required placeholder="Giriş Şifreniz" class="w-full bg-[#242220] border border-stone-700 rounded-xl px-4 py-3 text-white text-sm text-center font-bold focus:outline-none focus:border-amber-400">
          <div x-show="loginError" x-text="loginError" class="text-xs font-bold text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/30"></div>
          <button type="submit" class="w-full gold-btn font-extrabold py-3 rounded-xl shadow-lg transition-all text-sm" x-text="t('loginBtn')">Güvenli Giriş Yap</button>
        </form>
      </div>

      <div x-show="isLoggedIn" x-cloak class="w-full space-y-6">
        
        <div @click="activeTab = 'cars'" class="bg-[#1c1a18] border gold-border rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-center cursor-pointer hover:border-amber-400 transition-all">
          <div class="flex items-center space-x-4 mb-4 md:mb-0">
            <div class="w-14 h-14 rounded-2xl gold-btn flex items-center justify-center font-black text-xl text-white shadow"><i class="fa-solid fa-car-side"></i></div>
            <div>
              <h2 class="text-xl font-extrabold text-white" x-text="companyName"></h2>
              <p class="text-xs font-semibold text-stone-400 mt-0.5"><i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i> <span x-text="t('activePanel')">Aktif VIP Tedarikçi Paneli</span></p>
            </div>
          </div>
          <div class="flex space-x-4 bg-[#242220] p-3 rounded-2xl border border-stone-800 text-xs text-center text-stone-200">
            <div><span class="text-stone-400 block uppercase font-bold text-[10px]" x-text="t('totalCars')">Toplam Araç</span><span class="text-lg font-black text-white" x-text="myCars.length">0</span></div>
            <div class="border-l border-stone-800 pl-4"><span class="text-stone-400 block uppercase font-bold text-[10px]" x-text="t('availableCars')">Müsait Araç</span><span class="text-lg font-black text-emerald-400" x-text="myCars.filter(c => c.available).length">0</span></div>
          </div>
        </div>

        <div x-show="activeTab === 'cars'" x-transition>
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-extrabold text-white"><i class="fa-solid fa-car text-amber-400 mr-2"></i> <span x-text="t('myCarsTitle')">Sistemdeki Araçlarım</span></h3>
            <button @click="activeTab = 'add'" class="gold-btn font-bold px-4 py-2 rounded-xl text-xs transition-all shadow flex items-center"><span class="w-4 h-4 rounded-full bg-[#1c1a18] text-amber-400 flex items-center justify-center mr-1.5 text-[10px]"><i class="fa-solid fa-plus"></i></span> <span x-text="t('addCar')">Yeni Araç Ekle</span></button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto pr-2">
            <template x-for="car in myCars" :key="car._id">
              <div class="car-card-bg border gold-border rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all flex flex-col justify-between">
                <div>
                  <div class="flex justify-between items-start mb-3">
                    <div>
                      <span class="text-[10px] font-black px-2 py-0.5 rounded gold-badge uppercase" x-text="car.category"></span>
                      <h4 class="text-base font-extrabold text-white mt-2" x-text="car.brand + ' ' + car.model"></h4>
                      <p class="text-xs font-semibold text-stone-300 mt-1"><i class="fa-solid fa-location-dot text-amber-400 mr-1"></i> <span x-text="car.country + ' / ' + car.airports"></span></p>
                    </div>
                    <span :class="car.available ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'" class="px-2.5 py-1 rounded-lg text-[10px] font-black border" x-text="car.available ? t('available') : t('rented')"></span>
                  </div>
                  <div class="bg-[#242220]/80 backdrop-blur-sm p-3 rounded-2xl my-4 text-xs space-y-1.5 border border-stone-800 shadow-inner text-stone-200">
                    <div class="flex justify-between"><span class="text-stone-400 font-medium" x-text="t('publishedDate')">Yayınlanma Tarihi:</span><span class="font-extrabold text-stone-200" x-text="new Date(car.createdAt).toLocaleString('tr-TR')"></span></div>
                    <div class="flex justify-between"><span class="text-stone-400 font-medium" x-text="t('dailyNet')">Günlük Net Kazanç:</span><span class="font-black text-amber-400" x-text="(car.supplierPrice || 0) + ' ' + car.currency"></span></div>
                  </div>
                </div>
                <div class="pt-4 border-t border-stone-800 flex justify-between items-center text-xs">
                  <span class="text-stone-400 font-semibold"><span x-text="t('year')">Yıl</span>: <strong class="text-white" x-text="car.year"></strong></span>
                  <button @click="toggleMyCarStatus(car._id)" class="bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-2 rounded-xl font-bold transition-all" x-text="t('changeStatus')">Durum Değiştir</button>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div x-show="activeTab === 'wallet'" x-cloak x-transition>
          <h3 class="text-lg font-extrabold text-white mb-6"><i class="fa-solid fa-wallet text-amber-400 mr-2"></i> <span x-text="t('walletTitle')">Hesap Özeti & Finansal Rapor</span></h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="bg-[#1c1a18] border gold-border rounded-3xl p-6 shadow-xl">
              <span class="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-2" x-text="t('totalPotential')">Toplam Aktif Araç Kazanç Potansiyeli</span>
              <div class="text-3xl font-black text-amber-400" x-text="totalSupplierEarnings + ' €'"></div>
            </div>
            <div class="bg-[#1c1a18] border gold-border rounded-3xl p-6 shadow-xl">
              <span class="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-2" x-text="t('modelHeader')">İş Modeli</span>
              <div class="text-xl font-extrabold text-white" x-text="t('modelDesc')">Global B2B Dağıtım Sözleşmesi</div>
            </div>
          </div>
        </div>

        <div x-show="activeTab === 'loyalty'" x-cloak x-transition>
          <h3 class="text-lg font-extrabold text-white mb-6"><i class="fa-solid fa-award text-amber-400 mr-2"></i> <span x-text="t('loyaltyTitle')">VIP Sadakat Primi & Seviye Durumu</span></h3>
          <div class="bg-[#1c1a18] border gold-border rounded-3xl p-8 shadow-2xl relative overflow-hidden text-stone-200">
            <div class="flex items-center space-x-4 mb-6 pb-4 border-b border-stone-800">
              <div class="w-16 h-16 rounded-2xl gold-btn flex items-center justify-center text-3xl shadow"><i class="fa-solid fa-shield-halved"></i></div>
              <div>
                <h4 class="text-xl font-black text-white" x-text="t('loyaltyHeader')">FlexiDrive İş Ortaklığı Kademesi</h4>
                <p class="text-xs font-semibold text-stone-400" x-text="t('loyaltySub')">Sistemdeki kıdeminize ve operasyonel sadakatinize göre özel prim kazanma modülü.</p>
              </div>
            </div>
            <div class="bg-[#242220] border border-stone-800 rounded-2xl p-6 text-center space-y-4">
              <div class="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center text-xl mx-auto border border-amber-500/30 shadow-inner"><i class="fa-solid fa-lock"></i></div>
              <div>
                <h5 class="text-base font-black text-white" x-text="t('lockedTitle')">Sadakat Primi Modülü Şu An Kilitli</h5>
                <p class="text-xs font-semibold text-stone-400 mt-1 max-w-lg mx-auto" x-text="t('lockedDesc')">
                  VIP Sadakat Primi ve ek ciro desteklerinden yararlanabilmeniz için sistemimizde en az 3 ay kesintisiz aktif iş ortaklığı yürütmeniz gerekmektedir.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div x-show="activeTab === 'stats'" x-cloak x-transition>
          <h3 class="text-lg font-extrabold text-white mb-6"><i class="fa-solid fa-chart-line text-amber-400 mr-2"></i> <span x-text="t('statsTitle')">Kiralama Performans İstatistikleri</span></h3>
          <div class="bg-[#1c1a18] border gold-border rounded-3xl p-6 space-y-4 shadow-xl text-stone-200">
            <div class="flex justify-between items-center pb-4 border-b border-stone-800 text-xs">
              <span class="text-stone-400 font-bold" x-text="t('fleetShare')">Toplam Filo Havuzundaki Payınız</span>
              <span class="text-white font-black text-sm" x-text="myCars.length + ' Araç'"></span>
            </div>
            <div class="flex justify-between items-center text-xs">
              <span class="text-stone-400 font-bold" x-text="t('opStatus')">Operasyonel Durum</span>
              <span class="text-emerald-400 font-black bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30" x-text="t('activeStatus')">Sorunsuz & Aktif</span>
            </div>
          </div>
        </div>

        <!-- YENİ ARAÇ EKLEME FORMU (Gelişmiş Ülke, Havalimanı ve Telefon Alanları) -->
        <div x-show="activeTab === 'add'" x-cloak x-transition class="bg-[#1c1a18] border gold-border rounded-3xl p-8 shadow-2xl relative overflow-hidden text-stone-200">
          <h3 class="text-xl font-black text-white mb-2"><i class="fa-solid fa-plus-circle text-amber-400 mr-2"></i> <span x-text="t('addNewCar')">Filoya Yeni Araç Ekle</span></h3>
          <p class="text-xs font-semibold text-stone-400 mb-6"><span x-text="t('companyMatch')">Firma adınız otomatik eşleştirilmektedir:</span> <strong class="text-white" x-text="companyName"></strong></p>
          
          <form @submit.prevent="submitCar" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-4">
                <div>
                  <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('countrySelect')">Ülke Seçimi</label>
                  <select x-model="form.country" @change="updateCountryData(form.country)" required class="w-full bg-[#242220] border border-stone-800 rounded-xl px-4 py-3 text-white text-sm font-bold max-h-48 overflow-y-auto">
                    <option value="" disabled selected>Ülke Seçin</option>
                    <template x-for="c in countries" :key="c.name"><option :value="c.name" x-text="c.flag + ' ' + c.name"></option></template>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('airportSelect')">Havalimanı / Teslim Noktası</label>
                  <select x-model="form.airports" required :disabled="!form.country" class="w-full bg-[#242220] border border-stone-800 rounded-xl px-4 py-3 text-white text-sm font-bold disabled:opacity-40 max-h-48 overflow-y-auto">
                    <option value="" disabled selected>Önce Ülke Seçin</option>
                    <template x-for="airport in availableAirports" :key="airport"><option :value="airport" x-text="airport"></option></template>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('panelPass')">Paneme Giriş Şifreniz</label>
                  <input type="text" x-model="form.supplierPassword" required placeholder="Örn: flexi2026" class="w-full bg-[#242220] border border-stone-800 rounded-xl px-4 py-3 text-white text-sm font-bold">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('phoneNum')">İletişim Numarası (Telefon)</label>
                  <div class="flex space-x-2">
                    <input type="text" readonly x-model="form.dialCode" class="w-20 bg-stone-900 border border-stone-700 rounded-xl px-3 py-3 text-amber-400 text-sm font-mono text-center font-bold">
                    <input type="tel" x-model="form.phoneOnly" required placeholder="5XX XXX XX XX" class="w-full bg-[#242220] border border-stone-800 rounded-xl px-4 py-3 text-white text-sm font-mono">
                  </div>
                </div>
              </div>

              <div class="space-y-4">
                <div class="flex space-x-3">
                  <div class="w-1/2">
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('brand')">Marka</label>
                    <select x-model="form.brand" @change="form.model = ''; availableModels = carData[form.brand] || []" required class="w-full bg-[#242220] border border-stone-800 rounded-xl px-3 py-3 text-white text-sm font-bold max-h-48 overflow-y-auto">
                      <option value="" disabled selected>Marka Seçin</option>
                      <template x-for="(models, brandName) in carData" :key="brandName"><option :value="brandName" x-text="brandName"></option></template>
                    </select>
                  </div>
                  <div class="w-1/2">
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('model')">Model</label>
                    <select x-model="form.model" required :disabled="!form.brand" class="w-full bg-[#242220] border border-stone-800 rounded-xl px-3 py-3 text-white text-sm font-bold disabled:opacity-40 max-h-48 overflow-y-auto">
                      <option value="" disabled selected>Önce Marka Seçin</option>
                      <template x-for="modelName in availableModels" :key="modelName"><option :value="modelName" x-text="modelName"></option></template>
                    </select>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('year')">Yıl</label>
                    <input type="number" x-model="form.year" required min="2000" max="2027" class="w-full bg-[#242220] border border-stone-800 rounded-xl px-3 py-3 text-white text-sm font-bold">
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('category')">Sınıf</label>
                    <select x-model="form.category" required class="w-full bg-[#242220] border border-stone-800 rounded-xl px-2 py-3 text-white text-sm font-bold">
                      <option value="Ekonomik">Ekonomik</option><option value="SUV">SUV</option><option value="Sedan">Sedan</option><option value="Lüks">Lüks</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('fuel')">Yakıt</label>
                    <select x-model="form.fuelType" required class="w-full bg-[#242220] border border-stone-800 rounded-xl px-2 py-3 text-white text-sm font-bold">
                      <option value="Benzin">Benzin</option><option value="Dizel">Dizel</option><option value="Hibrit">Hibrit</option><option value="Elektrik">Elektrik</option>
                    </select>
                  </div>
                </div>

                <div class="flex space-x-3">
                  <div class="w-1/3">
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('luggage')">Bavul</label>
                    <input type="number" x-model="form.luggageCapacity" required min="0" max="10" placeholder="Adet" class="w-full bg-[#242220] border border-stone-800 rounded-xl px-3 py-3 text-white text-sm font-bold">
                  </div>
                  <div class="w-2/3">
                    <label class="block text-[10px] font-black text-amber-400 uppercase tracking-wider mb-1" x-text="t('dailyNetEarn')">Günlük Net Kazanç (Max 400 €)</label>
                    <div class="relative">
                      <span class="absolute left-3 top-3 text-amber-400 font-black text-base" x-text="form.currency"></span>
                      <input type="number" x-model="form.supplierPrice" required min="1" max="400" placeholder="Max 400" class="w-full bg-[#242220] border-2 border-stone-700 rounded-xl pl-8 pr-3 py-3 text-white text-sm font-black focus:border-amber-400">
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div x-show="message" x-text="message" :class="isError ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'" class="p-3 rounded-xl border text-sm font-bold text-center"></div>
            
            <button type="submit" class="w-full gold-btn font-black py-4 rounded-xl shadow-lg transition-all"><i class="fa-solid fa-cloud-arrow-up mr-2"></i> <span x-text="t('saveAndPublish')">Aracı Sisteme Kaydet ve Listeme Ekle</span></button>
          </form>
        </div>

      </div>

    </main>
  </div>

  <footer class="w-full py-6 text-center text-xs text-stone-500 border-t border-stone-900 bg-[#1c1a18]/60 backdrop-blur-sm" x-text="t('footer')">
    Tüm Hakları Saklıdır © 2026 FlexiDrive Global OS. Kurumsal B2B Araç Kiralama Ekosistemi.
  </footer>

  <script>
    const TRANSLATIONS = {
      tr: { myCars: 'Araçlarım', wallet: 'Hesap Özeti', loyalty: 'Sadakat Primi', stats: 'İstatistikler', addCar: 'Yeni Araç Ekle', loginTitle: 'Tedarikçi Güvenli Giriş', loginSub: 'Firma adınızı ve şifrenizi girerek panelinize erişin.', loginBtn: 'Güvenli Giriş Yap', activePanel: 'Aktif VIP Tedarikçi Paneli', totalCars: 'Toplam Araç', availableCars: 'Müsait Araç', myCarsTitle: 'Sistemdeki Araçlarım', available: 'MÜSAİT', rented: 'KİRADA', publishedDate: 'Yayınlanma Tarihi:', dailyNet: 'Günlük Net Kazanç:', year: 'Yıl', changeStatus: 'Durum Değiştir', walletTitle: 'Hesap Özeti & Finansal Rapor', totalPotential: 'Toplam Aktif Araç Kazanç Potansiyeli', modelHeader: 'İş Modeli', modelDesc: 'Global B2B Dağıtım Sözleşmesi', loyaltyTitle: 'VIP Sadakat Primi & Seviye Durumu', loyaltyHeader: 'FlexiDrive İş Ortaklığı Kademesi', loyaltySub: 'Sistemdeki kıdeminize göre özel prim kazanma modülü.', lockedTitle: 'Sadakat Primi Modülü Şu An Kilitli', lockedDesc: 'VIP Sadakat Primi ve ek ciro desteklerinden yararlanabilmeniz için en az 3 ay kesintisiz aktif iş ortaklığı yürütmeniz gerekmektedir.', statsTitle: 'Kiralama Performans İstatistikleri', fleetShare: 'Toplam Filo Havuzundaki Payınız', opStatus: 'Operasyonel Durum', activeStatus: 'Sorunsuz & Aktif', addNewCar: 'Filoya Yeni Araç Ekle', companyMatch: 'Firma adınız otomatik eşleştirilmektedir:', countrySelect: 'Ülke Seçimi', airportSelect: 'Havalimanı / Teslim Noktası', panelPass: 'Paneme Giriş Şifreniz', phoneNum: 'İletişim Numarası (Telefon)', brand: 'Marka', model: 'Model', category: 'Sınıf', fuel: 'Yakıt', luggage: 'Bavul', dailyNetEarn: 'Günlük Net Kazanç (Max 400 €)', saveAndPublish: 'Aracı Sisteme Kaydet ve Listeme Ekle', footer: 'Tüm Hakları Saklıdır © 2026 FlexiDrive Global OS.' },
      en: { myCars: 'My Cars', wallet: 'Wallet Summary', loyalty: 'Loyalty Bonus', stats: 'Statistics', addCar: 'Add Car', loginTitle: 'Supplier Secure Login', loginSub: 'Enter your company name and password.', loginBtn: 'Secure Login', activePanel: 'Active VIP Supplier Panel', totalCars: 'Total Cars', availableCars: 'Available Cars', myCarsTitle: 'My Registered Cars', available: 'AVAILABLE', rented: 'RENTED', publishedDate: 'Published Date:', dailyNet: 'Daily Net Earning:', year: 'Year', changeStatus: 'Toggle Status', walletTitle: 'Wallet Summary & Financial Report', totalPotential: 'Total Active Earnings Potential', modelHeader: 'Business Model', modelDesc: 'Global B2B Distribution Agreement', loyaltyTitle: 'VIP Loyalty Bonus & Tier', loyaltyHeader: 'FlexiDrive Partnership Tier', loyaltySub: 'Special bonus module based on your operational tenure.', lockedTitle: 'Loyalty Bonus Module Currently Locked', lockedDesc: 'To benefit from VIP Loyalty bonuses, you must maintain at least 3 months of uninterrupted active partnership.', statsTitle: 'Rental Performance Statistics', fleetShare: 'Your Share in Total Fleet', opStatus: 'Operational Status', activeStatus: 'Smooth & Active', addNewCar: 'Add New Vehicle', companyMatch: 'Your company name is automatically matched:', countrySelect: 'Select Country', airportSelect: 'Airport / Pickup Point', panelPass: 'Panel Access Password', phoneNum: 'Phone Number', brand: 'Brand', model: 'Model', category: 'Category', fuel: 'Fuel', luggage: 'Luggage', dailyNetEarn: 'Daily Net Earning (Max 400 €)', saveAndPublish: 'Save Car to System', footer: 'All Rights Reserved © 2026 FlexiDrive Global OS.' },
      de: { myCars: 'Meine Autos', wallet: 'Kontostand', loyalty: 'Treuebonus', stats: 'Statistiken', addCar: 'Auto Hinzufügen', loginTitle: 'Sicherer Login', loginSub: 'Geben Sie Ihren Firmennamen und Ihr Passwort ein.', loginBtn: 'Sicher Einloggen', activePanel: 'Aktives VIP-Lieferantenpanel', totalCars: 'Gesamte Autos', availableCars: 'Verfügbare Autos', myCarsTitle: 'Meine Fahrzeuge', available: 'VERFÜGBAR', rented: 'VERMIETET', publishedDate: 'Veröffentlichungsdatum:', dailyNet: 'Täglicher Nettoverdienst:', year: 'Jahr', changeStatus: 'Status Ändern', walletTitle: 'Finanzbericht', totalPotential: 'Gesamtes Ertragspotenzial', modelHeader: 'Geschäftsmodell', modelDesc: 'Globaler B2B-Vertriebsvertrag', loyaltyTitle: 'VIP Treuebonus', loyaltyHeader: 'FlexiDrive Partnerschaftsstufe', loyaltySub: 'Spezielles Bonusmodul basierend auf Ihrer Betriebszugehörigkeit.', lockedTitle: 'Treuebonus-Modul gesperrt', lockedDesc: 'Um von VIP-Treueboni zu profitieren, müssen Sie mindestens 3 Monate lang aktiv sein.', statsTitle: 'Leistungsstatistik', fleetShare: 'Ihr Anteil an der Flotte', opStatus: 'Betriebsstatus', activeStatus: 'Reibungslos & Aktiv', addNewCar: 'Neues Fahrzeug Hinzufügen', companyMatch: 'Ihr Firmenname wird automatisch zugeordnet:', countrySelect: 'Land Auswählen', airportSelect: 'Flughafen / Abholpunkt', panelPass: 'Passwort', phoneNum: 'Telefonnummer', brand: 'Marke', model: 'Modell', category: 'Kategorie', fuel: 'Kraftstoff', luggage: 'Gepäck', dailyNetEarn: 'Ttäglicher Nettoverdienst (Max 400 €)', saveAndPublish: 'Fahrzeug Speichern', footer: 'Alle Rechte vorbehalten © 2026 FlexiDrive Global OS.' },
      it: { myCars: 'Le Mie Auto', wallet: 'Riepilogo', loyalty: 'Bonus Fedeltà', stats: 'Statistiche', addCar: 'Aggiungi Auto', loginTitle: 'Accesso Sicuro Fornitore', loginSub: 'Inserisci nome azienda e password.', loginBtn: 'Accesso Sicuro', activePanel: 'Pannello Fornitore VIP Attivo', totalCars: 'Auto Totali', availableCars: 'Auto Disponibili', myCarsTitle: 'I Miei Veicoli', available: 'DISPONIBILE', rented: 'AFFITTATO', publishedDate: 'Data Pubblicazione:', dailyNet: 'Guadagno Netto Giornaliero:', year: 'Anno', changeStatus: 'Cambia Stato', walletTitle: 'Riepilogo Finanziario', totalPotential: 'Potenziale di Guadagno', modelHeader: 'Modello di Business', modelDesc: 'Accordo di Distribuzione B2B', loyaltyTitle: 'Bonus Fedeltà VIP', loyaltyHeader: 'Livello di Partnership FlexiDrive', loyaltySub: 'Modulo bonus basato sulla tua anzianità operativa.', lockedTitle: 'Modulo Bonus Fedeltà Bloccato', lockedDesc: 'Per beneficiare dei bonus di fedeltà VIP, devi mantenere almeno 3 mesi di partnership attiva.', statsTitle: 'Statistiche di Prestazione', fleetShare: 'La tua quota nella flotta', opStatus: 'Stato Operativo', activeStatus: 'Attivo e Regolare', addNewCar: 'Aggiungi Nuovo Veicolo', companyMatch: 'Il nome della tua azienda viene abbinato automaticamente:', countrySelect: 'Seleziona Paese', airportSelect: 'Aeroporto / Punto di Ritrovo', panelPass: 'Password Pannello', phoneNum: 'Numero di Telefono', brand: 'Marca', model: 'Modello', category: 'Categoria', fuel: 'Carburante', luggage: 'Bagaglio', dailyNetEarn: 'Guadagno Netto Giornaliero (Max 400 €)', saveAndPublish: 'Salva Veicolo', footer: 'Tutti i diritti riservati © 2026 FlexiDrive Global OS.' }
    };

    const GLOBAL_COUNTRIES = [
      { name: 'Almanya', flag: '🇩🇪', dial: '+49', currency: '€' },
      { name: 'İtalya', flag: '🇮🇹', dial: '+39', currency: '€' },
      { name: 'Yunanistan', flag: '🇬🇷', dial: '+30', currency: '€' },
      { name: 'Hırvatistan', flag: '🇭🇷', dial: '+385', currency: '€' },
      { name: 'Karadağ', flag: '🇲🇪', dial: '+382', currency: '€' },
      { name: 'Türkiye', flag: '🇹🇷', dial: '+90', currency: '₺' },
      { name: 'Sırbistan', flag: '🇷🇸', dial: '+381', currency: '€' },
      { name: 'Arnavutluk', flag: '🇦🇱', dial: '+355', currency: '€' },
      { name: 'Bosna Hersek', flag: '🇧🇦', dial: '+387', currency: '€' },
      { name: 'Bulgaristan', flag: '🇧🇬', dial: '+359', currency: 'лв' },
      { name: 'Kuzey Makedonya', flag: '🇲🇰', dial: '+389', currency: 'ден' }
    ];

    const AIRPORT_DATABASE = {
      'Almanya': ['Frankfurt (FRA)', 'Münih (MUC)', 'Berlin (BER)', 'Düsseldorf (DUS)'],
      'İtalya': ['Roma Fiumicino (FCO)', 'Milano Malpensa (MXP)', 'Venedik (VCE)', 'Napoli (NAP)'],
      'Yunanistan': ['Atina (ATH)', 'Selanik (SKG)', 'Kandiya (HER)', 'Rodos (RHO)'],
      'Hırvatistan': ['Zagreb (ZAG)', 'Split (SPU)', 'Dubrovnik (DBV)'],
      'Karadağ': ['Tivat (TIV)', 'Podgorica (TGD)'],
      'Türkiye': ['İstanbul (IST)', 'Antalya (AYT)', 'İzmir (ADB)', 'Dalaman (DLM)', 'Bodrum (BJV)'],
      'Sırbistan': ['Belgrad (BEG)', 'Niş (INI)'],
      'Arnavutluk': ['Tiran (TIA)'],
      'Bosna Hersek': ['Saraybosna (SJJ)', 'Banja Luka (BNX)'],
      'Bulgaristan': ['Sofya (SOF)', 'Varna (VAR)', 'Burgaz (BOJ)'],
      'Kuzey Makedonya': ['Üsküp (SKP)', 'Ohri (OHD)']
    };

    const CAR_DATABASE = {
      'Audi': ['A3', 'A4', 'A6', 'Q3', 'Q5'],
      'BMW': ['1 Serisi', '3 Serisi', '5 Serisi', 'X1', 'X3'],
      'Fiat': ['Egea', 'Panda', '500', 'Tipo'],
      'Ford': ['Focus', 'Puma', 'Kuga', 'Fiesta'],
      'Mercedes-Benz': ['A Serisi', 'C Serisi', 'E Serisi', 'GLA'],
      'Renault': ['Clio', 'Megane', 'Captur', 'Austral'],
      'Volkswagen': ['Polo', 'Golf', 'Passat', 'Tiguan', 'T-Roc']
    };

    document.addEventListener('alpine:init', () => {
      Alpine.data('supplierPortal', () => ({
        isLoggedIn: false,
        inputCompanyName: '',
        inputPassword: '',
        loginError: '',
        companyName: '',
        activeTab: 'cars',
        cars: [],
        currentLang: 'tr',
        countries: GLOBAL_COUNTRIES,
        airportData: AIRPORT_DATABASE,
        carData: CAR_DATABASE,
        availableModels: [],
        availableAirports: [],
        form: { brand: '', model: '', year: 2026, category: 'Ekonomik', fuelType: 'Benzin', luggageCapacity: 2, supplierPassword: 'flexi2026', phoneOnly: '', dialCode: '+382', country: '', airports: '', supplierPrice: '', currency: '€' },
        message: '',
        isError: false,

        async init() {
          await this.fetchCars();
          const savedCompany = localStorage.getItem('flexi_supplier_company');
          if (savedCompany) { this.companyName = savedCompany; this.isLoggedIn = true; }
        },
        t(key) {
          return TRANSLATIONS[this.currentLang][key] || key;
        },
        setLang(lang) {
          this.currentLang = lang;
        },
        async fetchCars() {
          try { const res = await fetch('/api/cars'); this.cars = await res.json(); } catch (err) {}
        },
        loginSupplier() {
          this.loginError = '';
          if (!this.inputCompanyName.trim() || !this.inputPassword.trim()) {
            this.loginError = 'Lütfen firma adı ve şifrenizi girin.';
            return;
          }
          const compName = this.inputCompanyName.trim().toLowerCase();
          const enteredPass = this.inputPassword.trim();
          
          const supplierCars = this.cars.filter(c => c.supplierName && c.supplierName.trim().toLowerCase() === compName);
          
          if (supplierCars.length === 0) {
            this.loginError = 'Bu isimde kayıtlı firma bulunamadı.';
            return;
          }

          const validPass = supplierCars[0].supplierPassword || 'flexi2026';
          if (enteredPass !== validPass) {
            this.loginError = 'Hatalı şifre!';
            return;
          }

          this.companyName = supplierCars[0].supplierName;
          localStorage.setItem('flexi_supplier_company', this.companyName);
          this.isLoggedIn = true;
        },
        logout() {
          localStorage.removeItem('flexi_supplier_company');
          this.isLoggedIn = false; 
          this.inputCompanyName = '';
          this.inputPassword = '';
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
  console.log(`FlexiDrive çoklu dil destekli VIP sunucusu http://localhost:${PORT} adresinde aktif!`);
});
