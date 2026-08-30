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

// 2. Veritabanı Modelleri
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

const SupplierUserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },
  password: { type: String, required: true },
  taxNumber: { type: String, default: "TR9876543210" },
  taxOffice: { type: String, default: "Merkez Vergi Dairesi" },
  address: { type: String, default: "Global Ticaret Merkezi, No: 42" },
  createdAt: { type: Date, default: Date.now }
});
const SupplierUser = mongoose.model('SupplierUser', SupplierUserSchema);

// 3. API Rotaları
app.get('/api/cars', async (req, res) => {
  try {
    const cars = await Car.find().sort({ createdAt: -1 });
    res.json(cars);
  } catch (err) {
    res.status(500).json({ error: 'Filo verileri getirilemedi' });
  }
});

app.get('/api/suppliers/details', async (req, res) => {
  try {
    const users = await SupplierUser.find({});
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Tedarikçi detayları alınamadı' });
  }
});

app.get('/api/supplier/cars', async (req, res) => {
  try {
    const compName = req.query.company;
    if (!compName) return res.status(400).json({ error: 'Firma adı gereklidir.' });
    const normalized = compName.trim().toLowerCase();
    const cars = await Car.find({}).sort({ createdAt: -1 });
    const supplierCars = cars.filter(c => c.supplierName && c.supplierName.trim().toLowerCase() === normalized);
    res.json(supplierCars);
  } catch (err) {
    res.status(500).json({ error: 'Tedarikçi verileri alınamadı' });
  }
});

app.post('/api/supplier/register', async (req, res) => {
  try {
    const { fullName, email, companyName, password } = req.body;
    if (!fullName || !email || !companyName || !password) {
      return res.status(400).json({ error: 'Lütfen tüm alanları eksiksiz doldurun.' });
    }

    const existingUser = await SupplierUser.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Bu e-posta adresiyle zaten bir hesap mevcut.' });
    }

    const randomTaxNo = 'TR' + Math.floor(1000000000 + Math.random() * 9000000000);

    const newUser = new SupplierUser({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      companyName: companyName.trim(),
      password: password.trim(),
      taxNumber: randomTaxNo,
      taxOffice: 'Global Kurumsal Vergi Dairesi',
      address: 'Merkez İş Merkezi, Kat: 5, ' + companyName
    });

    await newUser.save();
    res.status(201).json({ message: 'Hesabınız başarıyla oluşturuldu! Şimdi giriş yapabilirsiniz.' });
  } catch (err) {
    res.status(400).json({ error: 'Kayıt sırasında bir hata oluştu', details: err.message });
  }
});

app.post('/api/supplier/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-posta ve şifre gereklidir.' });
    }

    const user = await SupplierUser.findOne({ email: email.trim().toLowerCase() });
    if (!user || user.password !== password.trim()) {
      return res.status(400).json({ error: 'Hatalı e-posta veya şifre!' });
    }

    res.json({ success: true, companyName: user.companyName, fullName: user.fullName });
  } catch (err) {
    res.status(500).json({ error: 'Giriş yapılamadı' });
  }
});

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

// 4. ADMIN HQ (Coca-Cola Kırmızısı + Lüks Altın Detaylar & Ultra-Kurumsal Tasarım)
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr" class="h-full" style="background-color: #0d0d0d;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexiDrive Admin HQ | Red & Gold Edition</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0d0d0d; color: #f5f5f4; }
    [x-cloak] { display: none !important; }
    
    /* Kırmızı & Altın (Coca-Cola & Luxury Gold) Paleti */
    .coke-red { background: linear-gradient(135deg, #f40009 0%, #b30005 100%); }
    .gold-border { border-color: rgba(212, 175, 55, 0.4); }
    .gold-badge { background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(244, 0, 9, 0.15)); color: #ffd700; border: 1px solid rgba(212, 175, 55, 0.5); }
    .gold-btn { background: linear-gradient(135deg, #d4af37 0%, #aa820a 100%); color: #ffffff; box-shadow: 0 10px 25px -5px rgba(212, 175, 55, 0.4); }
    .gold-btn:hover { background: linear-gradient(135deg, #e6c555 0%, #d4af37 100%); }
    .glass-card { background: rgba(20, 18, 18, 0.9); backdrop-filter: blur(16px); border: 1px solid rgba(212, 175, 55, 0.3); box-shadow: 0 25px 50px -12px rgba(244, 0, 9, 0.15); }
    
    @keyframes pulse-gold {
      0% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.8); }
      70% { box-shadow: 0 0 0 12px rgba(212, 175, 55, 0); }
      100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); }
    }
    .led-gold { width: 12px; height: 12px; background-color: #ffd700; border-radius: 50%; display: inline-block; animation: pulse-gold 2s infinite; }

    .scrollable-nav { overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
    .scrollable-nav::-webkit-scrollbar { display: none; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #1a1616; border-radius: 4px; }
    ::-webkit-scrollbar-thumb { background: #d4af37; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #ffd700; }
  </style>
</head>
<body class="h-full flex flex-col justify-between" x-data="adminApp()">

  <!-- ADMIN GİRİŞ EKRANI -->
  <div x-show="!isAdminLoggedIn" class="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0d0d] p-4">
    <div class="max-w-md w-full glass-card rounded-3xl p-8 shadow-2xl text-center border gold-border">
      <div class="w-16 h-16 coke-red text-white rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg border border-yellow-500/50"><i class="fa-solid fa-crown text-yellow-300"></i></div>
      <h2 class="text-2xl font-black text-white mb-2">FlexiDrive Admin HQ</h2>
      <p class="text-xs font-semibold text-stone-400 mb-6">Yönetici paneline erişmek için admin şifrenizi girin.</p>
      
      <form @submit.prevent="loginAdmin()" class="space-y-4">
        <input type="password" autocomplete="current-password" x-model="adminPasswordInput" required placeholder="Admin Şifresi (eren2026)" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-4 py-3 text-white text-sm text-center font-bold focus:outline-none focus:border-yellow-400 shadow-inner">
        <div x-show="adminLoginError" x-text="adminLoginError" class="text-xs font-bold text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/30"></div>
        <button type="submit" class="w-full gold-btn font-extrabold py-3.5 rounded-xl shadow-lg transition-all text-sm">Güvenli Giriş Yap</button>
      </form>
    </div>
  </div>

  <div x-show="isAdminLoggedIn" x-cloak class="flex-1 flex flex-col justify-between">
    <header class="bg-[#141212]/95 backdrop-blur-md border-b gold-border sticky top-0 z-40 shadow-2xl">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        <div class="flex items-center space-x-4">
          <div class="relative" x-data="{ menuOpen: false }">
            <div @click="menuOpen = !menuOpen" class="flex items-center space-x-3 cursor-pointer group" title="Ana Menü">
              <div class="w-12 h-12 rounded-2xl coke-red flex items-center justify-center font-black text-xl text-white shadow-lg group-hover:scale-105 transition-transform border border-yellow-400/40">
                <i class="fa-solid fa-route text-yellow-300"></i>
              </div>
              <div>
                <span class="text-2xl font-black tracking-tight text-white">FlexiDrive</span> 
                <span class="text-[9px] font-extrabold gold-badge px-2.5 py-0.5 rounded-full ml-1 uppercase tracking-widest">Admin HQ</span>
              </div>
            </div>

            <div x-show="menuOpen" @click.outside="menuOpen = false" x-cloak class="absolute left-0 mt-3 w-60 bg-[#141212] border gold-border rounded-2xl shadow-2xl py-2 z-50 text-xs font-bold text-stone-200">
              <div class="px-4 py-2 border-b border-stone-800 text-[10px] text-yellow-400 uppercase tracking-widest font-black" x-text="t('quickMenu')">Hızlı Menü</div>
              <a href="#" @click="activeTab = 'admin'; menuOpen = false" class="flex items-center px-4 py-3 hover:bg-stone-800 transition-all"><i class="fa-solid fa-car text-yellow-400 mr-3 text-sm"></i> <span x-text="t('fleet')">Filo Operasyonları</span></a>
              <a href="#" @click="activeTab = 'partners'; menuOpen = false" class="flex items-center px-4 py-3 hover:bg-stone-800 transition-all"><i class="fa-solid fa-earth-europe text-yellow-400 mr-3 text-sm"></i> <span x-text="t('suppliers')">Tedarikçi Ağı</span></a>
              <a href="#" @click="activeTab = 'integrations'; menuOpen = false" class="flex items-center px-4 py-3 hover:bg-stone-800 transition-all"><i class="fa-solid fa-network-wired text-yellow-400 mr-3 text-sm"></i> <span x-text="t('feed')">Meta-Search Feed</span></a>
              <div class="border-t border-stone-800 my-1"></div>
              <a href="/tedarikci-paneli" target="_blank" class="flex items-center px-4 py-3 text-emerald-400 hover:bg-stone-800 transition-all"><i class="fa-solid fa-external-link-alt mr-3 text-sm"></i> <span x-text="t('supplierPortal')">Tedarikçi Portalı</span></a>
            </div>
          </div>
        </div>

        <div class="scrollable-nav flex items-center space-x-2 py-2">
          <button @click="activeTab = 'admin'" :class="activeTab === 'admin' ? 'gold-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center">
            <i class="fa-solid fa-car mr-2"></i> <span x-text="t('fleet')">Filo Operasyonları</span>
          </button>
          <button @click="activeTab = 'partners'" :class="activeTab === 'partners' ? 'gold-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center">
            <i class="fa-solid fa-earth-europe mr-2"></i> <span x-text="t('suppliers')">Tedarikçi Ağı</span>
          </button>
          <button @click="activeTab = 'integrations'" :class="activeTab === 'integrations' ? 'gold-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center">
            <i class="fa-solid fa-network-wired mr-2"></i> <span x-text="t('feed')">Meta-Search Feed</span>
          </button>
          <a href="/tedarikci-paneli" target="_blank" class="gold-badge hover:opacity-90 px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all inline-flex items-center shadow-sm">
            <i class="fa-solid fa-external-link-alt mr-2"></i> <span x-text="t('supplierPortal')">Tedarikçi Portalı</span>
          </a>

          <!-- DİL SEÇİCİ -->
          <div class="relative ml-2 inline-block" x-data="{ langOpen: false }">
            <button @click="langOpen = !langOpen" class="bg-[#1a1616] border gold-border text-yellow-400 px-3.5 py-2.5 rounded-xl font-black text-xs inline-flex items-center shadow">
              <i class="fa-solid fa-globe mr-1.5"></i> <span x-text="currentLang.toUpperCase()"></span>
            </button>
            <div x-show="langOpen" @click.outside="langOpen = false" x-cloak class="absolute right-0 mt-2 w-36 bg-[#1a1616] border gold-border rounded-xl shadow-2xl py-1 z-50 text-xs font-bold text-stone-200">
              <div @click="setLang('tr'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center"><span class="mr-2">🇹🇷</span> Türkçe</div>
              <div @click="setLang('en'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center"><span class="mr-2">🇬🇧</span> English</div>
              <div @click="setLang('de'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center"><span class="mr-2">🇩🇪</span> Deutsch</div>
              <div @click="setLang('it'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center"><span class="mr-2">🇮🇹</span> Italiano</div>
            </div>
          </div>

          <button @click="logoutAdmin()" class="text-rose-400 hover:bg-rose-500/10 p-2.5 rounded-xl text-xs transition-all ml-1 border border-rose-500/30 inline-flex items-center shadow-sm" title="Çıkış Yap"><i class="fa-solid fa-right-from-bracket text-base"></i></button>
        </div>

      </div>
    </header>

    <main class="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div x-show="activeTab === 'admin'" x-transition>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div class="glass-card p-6 rounded-3xl shadow-xl flex justify-between items-center"><div><p class="text-xs font-bold text-stone-400 uppercase tracking-wider" x-text="t('totalFleet')">Toplam Filo</p><h3 class="text-3xl font-black mt-1 text-white" x-text="cars.length">0</h3></div><div class="text-yellow-400 text-3xl"><i class="fa-solid fa-car"></i></div></div>
          
          <div class="glass-card p-6 rounded-3xl shadow-xl flex justify-between items-center">
            <div>
              <div class="flex items-center space-x-2">
                <p class="text-xs font-bold text-stone-400 uppercase tracking-wider" x-text="t('activeAvailable')">Aktif / Müsait</p>
                <span class="led-gold" title="Altın Statü LED"></span>
              </div>
              <h3 class="text-3xl font-black mt-1 text-emerald-400" x-text="cars.filter(c => c.available).length">0</h3>
            </div>
            <div class="text-emerald-400 text-3xl"><i class="fa-solid fa-circle-check"></i></div>
          </div>

          <div class="glass-card p-6 rounded-3xl shadow-xl flex justify-between items-center overflow-hidden">
            <div>
              <p class="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('dailyRevenue')">Günlük Potansiyel Ciro</p>
              <div class="flex flex-col space-y-1">
                <template x-for="(val, cur) in totalProfits" :key="cur"><span class="text-lg font-black text-yellow-400 leading-none" x-text="val + ' ' + cur"></span></template>
                <span x-show="Object.keys(totalProfits).length === 0" class="text-lg font-black text-stone-500">0 €</span>
              </div>
            </div>
            <div class="text-yellow-400 text-3xl"><i class="fa-solid fa-wallet"></i></div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <template x-for="car in cars" :key="car._id">
            <div @click="openCarDetails(car)" class="glass-card border gold-border rounded-3xl p-6 flex flex-col justify-between shadow-xl hover:border-yellow-400 hover:scale-[1.02] cursor-pointer transition-all">
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div>
                    <span class="text-[9px] font-black px-2.5 py-0.5 rounded-full gold-badge uppercase" x-text="car.category"></span>
                    <h4 class="text-base font-extrabold text-white mt-1" x-text="car.brand + ' ' + car.model"></h4>
                  </div>
                  <span :class="car.available ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'" class="px-2.5 py-1 rounded-lg text-[10px] font-black border shadow-sm" x-text="car.available ? t('available') : t('rented')"></span>
                </div>
                <p class="text-xs font-semibold text-stone-300 mt-1"><i class="fa-solid fa-building text-yellow-400 mr-1"></i> <span x-text="car.supplierName"></span> (<span x-text="car.country"></span>)</p>
                
                <div class="bg-[#1a1616] p-3 rounded-2xl my-4 text-xs space-y-1.5 border border-stone-800 shadow-inner text-stone-200">
                  <div class="flex justify-between"><span class="text-stone-400 font-medium" x-text="t('netSale')">Net / Satış:</span><span class="font-extrabold text-yellow-400" x-text="(car.supplierPrice || 0) + '€ / ' + (car.customerPrice || 0) + '€'"></span></div>
                  <div class="flex justify-between"><span class="text-stone-400 font-medium" x-text="t('published')">Yayınlanma:</span><span class="font-extrabold text-stone-200" x-text="new Date(car.createdAt).toLocaleString('tr-TR')"></span></div>
                </div>
              </div>
              
              <div class="pt-4 border-t border-stone-800 flex justify-between items-center text-xs" @click.stop>
                <button @click="toggleStatus(car._id)" class="bg-stone-800 hover:bg-stone-700 text-stone-200 px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm" x-text="t('changeStatus')">Durum Değiştir</button>
                <button @click="deleteCar(car._id)" class="bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm"><i class="fa-solid fa-trash-can mr-1"></i> <span x-text="t('removeCar')">Aracı Kaldır</span></button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div x-show="activeTab === 'partners'" x-cloak x-transition>
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-xl font-extrabold text-white" x-text="t('supplierReportTitle')">Ülke Bazlı Tedarikçi Hacim Raporu</h2>
            <p class="text-xs font-semibold text-stone-400 mt-1" x-text="t('supplierReportSub')">Ülkelere göre gruplanmış tedarikçi firmalarınız</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <template x-for="group in groupedSuppliersByCountry" :key="group.country">
            <div class="glass-card rounded-3xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-center mb-6 pb-4 border-b border-stone-800">
                  <div class="flex items-center space-x-3">
                    <div class="text-4xl" x-text="group.flag"></div>
                    <div>
                      <h3 class="text-xl font-black text-white" x-text="group.country"></h3>
                      <p class="text-xs font-semibold text-stone-400"><strong class="text-yellow-400" x-text="group.suppliers.length"></strong> Firma / <strong class="text-emerald-400" x-text="group.totalCars"></strong> Araç Hacmi</p>
                    </div>
                  </div>
                </div>
                <div class="space-y-3 max-h-96 overflow-y-auto pr-2">
                  <template x-for="supplier in group.suppliers" :key="supplier.name">
                    <div class="bg-[#1a1616] border border-stone-800 rounded-2xl p-4 flex justify-between items-center text-stone-200">
                      <div>
                        <h4 class="text-sm font-bold text-white" x-text="supplier.name"></h4>
                        <button @click="openTaxDetails(supplier)" class="text-xs font-semibold text-yellow-400 hover:text-yellow-300 mt-1 inline-flex items-center transition-colors text-left" title="Vergi ve Mali İşlemleri Görüntüle">
                          <i class="fa-solid fa-phone text-emerald-400 mr-1.5"></i> <span class="font-mono underline" x-text="supplier.contact"></span>
                          <span class="ml-2 text-[9px] gold-badge px-2.5 py-0.5 rounded-full shadow-sm"><i class="fa-solid fa-file-invoice-dollar mr-1"></i> Vergi Dosyası</span>
                        </button>
                      </div>
                      <div class="flex items-center space-x-2">
                        <div class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center shadow-inner">
                          <i class="fa-solid fa-circle-check mr-1 text-[9px]"></i> <span x-text="supplier.activeCars"></span> Aktif
                        </div>
                        <span class="gold-badge text-xs font-extrabold px-3 py-1 rounded-full shadow-sm" x-text="supplier.carCount + ' Araç'"></span>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div x-show="activeTab === 'integrations'" x-cloak x-transition>
        <div class="glass-card rounded-3xl p-8 shadow-xl">
          <div class="flex items-center space-x-3 mb-6 border-b border-stone-800 pb-4">
            <div class="gold-btn p-3 rounded-2xl flex items-center justify-center text-xl shadow"><i class="fa-solid fa-satellite-dish"></i></div>
            <div>
              <h2 class="text-xl font-black text-white" x-text="t('metaTitle')">Meta-Search Entegrasyon Merkezi</h2>
              <p class="text-xs font-semibold text-stone-400" x-text="t('metaSub')">Skyscanner ve Kayak gibi platformların envanterinizi çekeceği açık API adresi.</p>
            </div>
          </div>
          <div class="bg-[#1a1616] p-6 rounded-2xl border border-stone-800 space-y-2 shadow-inner">
            <span class="text-xs font-bold text-stone-300 uppercase tracking-wider block" x-text="t('feedAddress')">Resmi JSON Feed Bağlantı Adresi</span>
            <div class="flex space-x-2">
              <input type="text" readonly :value="windowOrigin + '/api/feed/global-inventory'" class="w-full bg-[#121010] border border-stone-700 rounded-xl px-4 py-3 text-xs text-yellow-400 font-mono font-bold focus:outline-none">
              <button @click="navigator.clipboard.writeText(windowOrigin + '/api/feed/global-inventory'); alert('URL kopyalandı!')" class="gold-btn font-extrabold px-5 py-3 rounded-xl text-xs whitespace-nowrap shadow" x-text="t('copy')">Kopyala</button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- ARAÇ DETAY VE KONUM MODALI -->
    <div x-show="selectedCar" x-cloak class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div @click.outside="selectedCar = null" class="max-w-lg w-full glass-card rounded-3xl p-8 shadow-2xl border gold-border relative text-stone-200">
        <button @click="selectedCar = null" class="absolute top-6 right-6 w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center font-bold transition-all"><i class="fa-solid fa-xmark text-sm"></i></button>
        
        <div class="flex items-center space-x-3 mb-6">
          <div class="w-12 h-12 rounded-2xl gold-btn flex items-center justify-center text-xl text-white shadow"><i class="fa-solid fa-car"></i></div>
          <div>
            <span class="text-[9px] font-black px-2 py-0.5 rounded-full gold-badge uppercase" x-text="selectedCar ? selectedCar.category : ''"></span>
            <h3 class="text-xl font-black text-white mt-1" x-text="selectedCar ? selectedCar.brand + ' ' + selectedCar.model : ''"></h3>
          </div>
        </div>

        <div class="space-y-4 text-xs">
          <div class="bg-[#1a1616] p-4 rounded-2xl border border-stone-800 space-y-2">
            <div class="flex justify-between items-center"><span class="text-stone-400">Ülke / Konum:</span><strong class="text-yellow-400 text-sm" x-text="selectedCar ? selectedCar.country + ' - ' + selectedCar.airports : ''"></strong></div>
            <div class="flex justify-between items-center"><span class="text-stone-400">Tedarikçi Firma:</span><strong class="text-white" x-text="selectedCar ? selectedCar.supplierName : ''"></strong></div>
            <div class="flex justify-between items-center"><span class="text-stone-400">İletişim (Telefon):</span><strong class="text-emerald-400 font-mono" x-text="selectedCar ? selectedCar.supplierContact : ''"></strong></div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div class="bg-[#1a1616] p-3 rounded-xl border border-stone-800 text-center">
              <span class="text-[10px] text-stone-400 block uppercase font-bold">Yıl</span>
              <span class="text-base font-black text-white" x-text="selectedCar ? selectedCar.year : ''"></span>
            </div>
            <div class="bg-[#1a1616] p-3 rounded-xl border border-stone-800 text-center">
              <span class="text-[10px] text-stone-400 block uppercase font-bold">Yakıt / Vites</span>
              <span class="text-base font-black text-yellow-400" x-text="selectedCar ? selectedCar.fuelType : ''"></span>
            </div>
            <div class="bg-[#1a1616] p-3 rounded-xl border border-stone-800 text-center">
              <span class="text-[10px] text-stone-400 block uppercase font-bold">Bavul Kapasitesi</span>
              <span class="text-base font-black text-emerald-400" x-text="selectedCar ? selectedCar.luggageCapacity + ' Adet' : ''"></span>
            </div>
          </div>

          <div class="bg-[#1a1616] p-4 rounded-2xl border border-stone-800 flex justify-between items-center">
            <div>
              <span class="text-[10px] text-stone-400 block uppercase font-bold">Finansal Dağılım</span>
              <span class="text-lg font-black text-yellow-400" x-text="selectedCar ? selectedCar.supplierPrice + '€ Net / ' + selectedCar.customerPrice + '€ Satış' : ''"></span>
            </div>
            <span :class="selectedCar && selectedCar.available ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'" class="px-3 py-1.5 rounded-lg text-xs font-black border" x-text="selectedCar && selectedCar.available ? 'MÜSAİT' : 'KİRADA'"></span>
          </div>

          <a :href="'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(selectedCar ? selectedCar.airports + ' ' + selectedCar.country : '')" target="_blank" class="w-full gold-btn font-extrabold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center text-xs">
            <i class="fa-solid fa-map-location-dot mr-2 text-sm"></i> Haritada Konumu Göster (Google Maps)
          </a>
        </div>
      </div>
    </div>

    <!-- TEDARİKÇİ VERGİ DOSYASI MODALI -->
    <div x-show="selectedTaxSupplier" x-cloak class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div @click.outside="selectedTaxSupplier = null" class="max-w-lg w-full glass-card rounded-3xl p-8 shadow-2xl border gold-border relative text-stone-200">
        <button @click="selectedTaxSupplier = null" class="absolute top-6 right-6 w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center font-bold transition-all"><i class="fa-solid fa-xmark text-sm"></i></button>
        
        <div class="flex items-center space-x-3 mb-6 border-b border-stone-800 pb-4">
          <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl border border-emerald-500/30 shadow"><i class="fa-solid fa-file-invoice-dollar"></i></div>
          <div>
            <span class="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">Vergi & Mali Dosya</span>
            <h3 class="text-xl font-black text-white mt-1" x-text="selectedTaxSupplier ? selectedTaxSupplier.name : ''"></h3>
          </div>
        </div>

        <div class="space-y-4 text-xs">
          <div class="bg-[#1a1616] p-5 rounded-2xl border border-stone-800 space-y-3">
            <div class="flex justify-between items-center pb-2 border-b border-stone-800">
              <span class="text-stone-400 font-medium">Vergi Kimlik Numarası (VKN):</span>
              <strong class="text-yellow-400 font-mono text-sm" x-text="selectedTaxSupplier ? (selectedTaxSupplier.taxNumber || 'TR9876543210') : ''"></strong>
            </div>
            <div class="flex justify-between items-center pb-2 border-b border-stone-800">
              <span class="text-stone-400 font-medium">Vergi Dairesi:</span>
              <strong class="text-white" x-text="selectedTaxSupplier ? (selectedTaxSupplier.taxOffice || 'Merkez Kurumsal VD') : ''"></strong>
            </div>
            <div class="flex justify-between items-center pb-2 border-b border-stone-800">
              <span class="text-stone-400 font-medium">Kayıtlı Ticari Adres:</span>
              <strong class="text-stone-200 text-right max-w-[240px]" x-text="selectedTaxSupplier ? (selectedTaxSupplier.address || 'Global Ticaret Merkezi, No: 42') : ''"></strong>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-stone-400 font-medium">İletişim Hattı:</span>
              <strong class="text-emerald-400 font-mono" x-text="selectedTaxSupplier ? selectedTaxSupplier.contact : ''"></strong>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="bg-[#1a1616] p-4 rounded-xl border border-stone-800 text-center">
              <span class="text-[10px] text-stone-400 block uppercase font-bold mb-1">Toplam Araç Hacmi</span>
              <span class="text-xl font-black text-white" x-text="selectedTaxSupplier ? selectedTaxSupplier.carCount + ' Adet' : '0'"></span>
            </div>
            <div class="bg-[#1a1616] p-4 rounded-xl border border-stone-800 text-center">
              <span class="text-[10px] text-stone-400 block uppercase font-bold mb-1">Aktif Müsait Araç</span>
              <span class="text-xl font-black text-emerald-400" x-text="selectedTaxSupplier ? selectedTaxSupplier.activeCars + ' Adet' : '0'"></span>
            </div>
          </div>

          <div class="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl text-center text-emerald-400 font-bold">
            <i class="fa-solid fa-circle-check mr-1.5"></i> Mali Mükellefiyet Durumu: Aktif ve Uyumlu
          </div>
        </div>
      </div>
    </div>

    <footer class="w-full py-6 text-center text-xs text-stone-500 border-t border-stone-900 bg-[#141212]/80 backdrop-blur-sm" x-text="t('footer')">
      Tüm Hakları Saklıdır © 2026 FlexiDrive Global OS. Kurumsal B2B Araç Kiralama Ekosistemi.
    </footer>
  </div>

  <script>
    const TRANSLATIONS = {
      tr: { quickMenu: 'Hızlı Menü', fleet: 'Filo Operasyonları', suppliers: 'Tedarikçi Ağı', feed: 'Meta-Search Feed', supplierPortal: 'Tedarikçi Portalı', totalFleet: 'Toplam Filo', activeAvailable: 'Aktif / Müsait', dailyRevenue: 'Günlük Potansiyel Ciro', available: 'MÜSAİT', rented: 'KİRADA', netSale: 'Net / Satış:', published: 'Yayınlanma:', changeStatus: 'Durum Değiştir', removeCar: 'Aracı Kaldır', supplierReportTitle: 'Ülke Bazlı Tedarikçi Hacim Raporu', supplierReportSub: 'Ülkelere göre gruplanmış tedarikçi firmalarınız', metaTitle: 'Meta-Search Entegrasyon Merkezi', metaSub: 'Skyscanner ve Kayak gibi platformların envanterinizi çekeceği açık API adresi.', feedAddress: 'Resmi JSON Feed Bağlantı Adresi', copy: 'Kopyala', footer: 'Tüm Hakları Saklıdır © 2026 FlexiDrive Global OS.' },
      en: { quickMenu: 'Quick Menu', fleet: 'Fleet Operations', suppliers: 'Supplier Network', feed: 'Meta-Search Feed', supplierPortal: 'Supplier Portal', totalFleet: 'Total Fleet', activeAvailable: 'Active / Available', dailyRevenue: 'Daily Potential Revenue', available: 'AVAILABLE', rented: 'RENTED', netSale: 'Net / Sale:', published: 'Published:', changeStatus: 'Toggle Status', removeCar: 'Remove Car', supplierReportTitle: 'Country-Based Supplier Volume Report', supplierReportSub: 'Suppliers grouped by country', metaTitle: 'Meta-Search Integration Center', metaSub: 'Open API address for Skyscanner and Kayak.', feedAddress: 'Official JSON Feed Address', copy: 'Copy', footer: 'All Rights Reserved © 2026 FlexiDrive Global OS.' },
      de: { quickMenu: 'Schnellmenü', fleet: 'Flottenbetrieb', suppliers: 'Lieferantennetzwerk', feed: 'Meta-Search Feed', supplierPortal: 'Lieferantenportal', totalFleet: 'Gesamte Flotte', activeAvailable: 'Aktiv / Verfügbar', dailyRevenue: 'Ttäglicher Umsatz', available: 'VERFÜGBAR', rented: 'VERMIETET', netSale: 'Netto / Verkauf:', published: 'Veröffentlicht:', changeStatus: 'Status Ändern', removeCar: 'Fahrzeug Entfernen', supplierReportTitle: 'Länderbasieter Lieferantenbericht', supplierReportSub: 'Lieferanten nach Ländern gruppiert', metaTitle: 'Meta-Search Integrationszentrum', metaSub: 'Offene API-Adresse für Skyscanner und Kayak.', feedAddress: 'Offizielle JSON Feed Adresse', copy: 'Kopieren', footer: 'Alle Rechte vorbehalten © 2026 FlexiDrive Global OS.' },
      it: { quickMenu: 'Menu Rapido', fleet: 'Operazioni Flotta', suppliers: 'Rete Fornitori', feed: 'Meta-Search Feed', supplierPortal: 'Portale Fornitori', totalFleet: 'Flotta Totale', activeAvailable: 'Attivo / Disponibile', dailyRevenue: 'Potenziale Ricavo Giornaliero', available: 'DISPONIBILE', rented: 'AFFITTATO', netSale: 'Netto / Vendita:', published: 'Pubblicato:', changeStatus: 'Cambia Stato', removeCar: 'Rimuovi Auto', supplierReportTitle: 'Rapporto Fornitori per Paese', supplierReportSub: 'Fornitori raggruppati per paese', metaTitle: 'Centro Integrazione Meta-Search', metaSub: 'Indirizzo API aperto per Skyscanner e Kayak.', feedAddress: 'Indirizzo JSON Feed Ufficiale', copy: 'Copia', footer: 'Tutti i diritti riservati © 2026 FlexiDrive Global OS.' }
    };

    document.addEventListener('alpine:init', () => {
      Alpine.data('adminApp', () => ({
        isAdminLoggedIn: false,
        adminPasswordInput: '',
        adminLoginError: '',
        activeTab: 'admin',
        cars: [],
        supplierUsers: [],
        selectedCar: null,
        selectedTaxSupplier: null,
        currentLang: 'tr',
        windowOrigin: window.location.origin,
        async init() {
          const isAuth = localStorage.getItem('flexi_admin_auth');
          if (isAuth === 'true') {
            this.isAdminLoggedIn = true;
            await this.fetchCars();
            await this.fetchSupplierDetails();
          }
        },
        async loginAdmin() {
          this.adminLoginError = '';
          if (this.adminPasswordInput.trim() === 'eren2026') {
            this.isAdminLoggedIn = true;
            localStorage.setItem('flexi_admin_auth', 'true');
            await this.fetchCars();
            await this.fetchSupplierDetails();
          } else {
            this.adminLoginError = 'Hatalı Admin Şifresi!';
          }
        },
        logoutAdmin() {
          localStorage.removeItem('flexi_admin_auth');
          this.isAdminLoggedIn = false;
          this.adminPasswordInput = '';
        },
        openCarDetails(car) {
          this.selectedCar = car;
        },
        openTaxDetails(supplier) {
          const found = this.supplierUsers.find(u => u.companyName && u.companyName.trim().toLowerCase() === supplier.name.trim().toLowerCase());
          this.selectedTaxSupplier = {
            ...supplier,
            taxNumber: found ? (found.taxNumber || 'TR9876543210') : 'TR9876543210',
            taxOffice: found ? (found.taxOffice || 'Merkez Kurumsal VD') : 'Merkez Kurumsal VD',
            address: found ? (found.address || 'Global Ticaret Merkezi, No: 42') : 'Global Ticaret Merkezi, No: 42'
          };
        },
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
        async fetchSupplierDetails() {
          try {
            const res = await fetch('/api/suppliers/details');
            this.supplierUsers = await res.json();
          } catch (err) {}
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
          const flags = { 'Almanya': '🇩🇪', 'İtalya': '🇮🇹', 'Yunanistan': '🇬🇷', 'Hırvatistan': '🇭🇷', 'Karadağ': '🇲🇪', 'Türkiye': '🇹🇷', 'Sırbistan': '🇷🇸', 'Arnavutluk': '🇦🇱', 'Bosna Hersek': '🇧🇦', 'Bulgaristan': '🇧🇬', 'Kuzey Makedonya': '🇲🇰', 'Fransa': '🇫🇷', 'İspanya': '🇪🇸', 'Avusturya': '🇦🇹', 'İsviçre': '🇨🇭', 'Hollanda': '🇳🇱' };
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
              countryGroup.suppliersMap.set(supKey, { name: c.supplierName.trim(), contact: c.supplierContact, carCount: 0, activeCars: 0 });
            }
            const supObj = countryGroup.suppliersMap.get(supKey);
            supObj.carCount++;
            if (c.available) {
              supObj.activeCars++;
            }
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


// 5. TEDARİKÇİ PORTALI (Coca-Cola Kırmızısı & Lüks Altın Detaylar)
app.get('/tedarikci-paneli', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexiDrive Tedarikçi Portalı</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { 
      font-family: 'Plus Jakarta Sans', sans-serif; 
      color: #f8fafc; 
      background: linear-gradient(to bottom, rgba(13, 13, 13, 0.75), rgba(20, 18, 18, 0.92)), 
                  url('https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=1920&q=80');
      background-size: cover;
      background-position: center;
      background-attachment: fixed;
    }
    [x-cloak] { display: none !important; }
    .coke-red { background: linear-gradient(135deg, #f40009 0%, #b30005 100%); }
    .gold-border { border-color: rgba(212, 175, 55, 0.4); }
    .gold-badge { background: linear-gradient(135deg, rgba(212, 175, 55, 0.25), rgba(244, 0, 9, 0.2)); color: #ffd700; border: 1px solid rgba(212, 175, 55, 0.5); }
    .gold-btn { background: linear-gradient(135deg, #d4af37 0%, #aa820a 100%); color: #ffffff; box-shadow: 0 10px 25px -5px rgba(212, 175, 55, 0.4); }
    .gold-btn:hover { background: linear-gradient(135deg, #e6c555 0%, #d4af37 100%); }
    .glass-card { background: rgba(20, 18, 18, 0.88); backdrop-filter: blur(16px); border: 1px solid rgba(212, 175, 55, 0.3); box-shadow: 0 25px 50px -12px rgba(244, 0, 9, 0.2); }
    .car-card-bg {
      background-image: linear-gradient(to bottom, rgba(20, 18, 18, 0.96), rgba(20, 18, 18, 0.99)), url('https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80');
      background-size: cover;
      background-position: center;
    }
    .scrollable-nav { overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
    .scrollable-nav::-webkit-scrollbar { display: none; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #141212; border-radius: 4px; }
    ::-webkit-scrollbar-thumb { background: #d4af37; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #ffd700; }

    select {
      appearance: none;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffd700' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      background-size: 1.1em;
      padding-right: 2.2rem !important;
    }
    select::-ms-expand { display: none; }
  </style>
</head>
<body class="h-full flex flex-col justify-between" x-data="supplierPortal()">

  <div>
    <header class="bg-[#141212]/95 backdrop-blur-md border-b gold-border sticky top-0 z-40 shadow-2xl">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        <div @click="activeTab = 'cars'" class="flex items-center space-x-3 cursor-pointer group" title="Ana Menüye Dön">
          <div class="w-12 h-12 rounded-2xl coke-red flex items-center justify-center font-black text-xl text-white shadow-lg group-hover:scale-105 transition-transform border border-yellow-400/40">
            <i class="fa-solid fa-route text-yellow-300"></i>
          </div>
          <div class="flex flex-col">
            <div class="flex items-center space-x-2">
              <span class="text-2xl font-black tracking-tight text-white">FlexiDrive</span>
              <span class="text-[9px] font-extrabold gold-badge px-2.5 py-0.5 rounded-full uppercase tracking-widest" x-text="t('supplierBadge')">Tedarikçi</span>
            </div>
            <span class="text-[10px] text-stone-400 font-semibold tracking-wide flex items-center mt-0.5"><i class="fa-solid fa-users mr-1 text-yellow-400 text-[9px]"></i> users portal</span>
          </div>
        </div>
        
        <div class="flex items-center space-x-3">
          <div class="scrollable-nav flex items-center space-x-2 py-2" x-show="isLoggedIn">
            <button @click="activeTab = 'cars'" :class="activeTab === 'cars' ? 'gold-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center"><i class="fa-solid fa-car mr-2"></i> <span x-text="t('myCars')">Araçlarım</span></button>
            <button @click="activeTab = 'wallet'" :class="activeTab === 'wallet' ? 'gold-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center"><i class="fa-solid fa-wallet mr-2"></i> <span x-text="t('wallet')">Hesap Özeti</span></button>
            <button @click="activeTab = 'loyalty'" :class="activeTab === 'loyalty' ? 'gold-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center"><i class="fa-solid fa-award mr-2"></i> <span x-text="t('loyalty')">Sadakat Primi</span></button>
            <button @click="activeTab = 'stats'" :class="activeTab === 'stats' ? 'gold-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center"><i class="fa-solid fa-chart-line mr-2"></i> <span x-text="t('stats')">İstatistikler</span></button>
            
            <button @click="activeTab = 'add'" :class="activeTab === 'add' ? 'bg-yellow-500 text-stone-950 shadow-lg ring-2 ring-yellow-400' : 'gold-btn shadow-md hover:scale-105'" class="px-4 py-2.5 rounded-xl font-black text-xs transition-all inline-flex items-center border gold-border">
              <span class="w-5 h-5 rounded-full bg-[#141212] text-yellow-400 flex items-center justify-center mr-2 text-xs font-black shadow-inner"><i class="fa-solid fa-plus"></i></span> <span x-text="t('addCar')">Yeni Araç Ekle</span>
            </button>
          </div>

          <div class="relative inline-block" x-data="{ langOpen: false }">
            <button @click="langOpen = !langOpen" class="bg-[#1a1616] border gold-border text-yellow-400 px-3.5 py-2.5 rounded-xl font-black text-xs inline-flex items-center shadow">
              <i class="fa-solid fa-globe mr-1.5"></i> <span x-text="currentLang.toUpperCase()"></span>
            </button>
            <div x-show="langOpen" @click.outside="langOpen = false" x-cloak class="absolute right-0 mt-2 w-36 bg-[#1a1616] border gold-border rounded-xl shadow-2xl py-1 z-50 text-xs font-bold text-stone-200">
              <div @click="setLang('tr'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center"><span class="mr-2">🇹🇷</span> Türkçe</div>
              <div @click="setLang('en'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center"><span class="mr-2">🇬🇧</span> English</div>
              <div @click="setLang('de'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center"><span class="mr-2">🇩🇪</span> Deutsch</div>
              <div @click="setLang('it'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center"><span class="mr-2">🇮🇹</span> Italiano</div>
            </div>
          </div>

          <div class="relative inline-block" x-data="{ dotMenuOpen: false }">
            <button @click="dotMenuOpen = !dotMenuOpen" class="bg-[#1a1616] hover:bg-stone-800 border gold-border text-yellow-400 p-3 rounded-xl text-xs transition-all inline-flex items-center shadow" title="Seçenekler">
              <i class="fa-solid fa-ellipsis-vertical text-base"></i>
            </button>
            <div x-show="dotMenuOpen" @click.outside="dotMenuOpen = false" x-cloak class="absolute right-0 mt-2 w-48 bg-[#1a1616] border gold-border rounded-xl shadow-2xl py-2 z-50 text-xs font-bold text-stone-200">
              <a href="https://wa.me/905342258858" target="_blank" class="px-4 py-2.5 hover:bg-stone-800 flex items-center text-emerald-400"><i class="fa-brands fa-whatsapp mr-2.5 text-sm"></i> WhatsApp Destek</a>
              <a href="tel:05342258858" class="px-4 py-2.5 hover:bg-stone-800 flex items-center text-yellow-400"><i class="fa-solid fa-phone mr-2.5 text-sm"></i> Direkt Ara</a>
              <a href="mailto:support@flexidrive.app" class="px-4 py-2.5 hover:bg-stone-800 flex items-center text-stone-300"><i class="fa-solid fa-envelope mr-2.5 text-sm"></i> E-Posta Gönder</a>
              <div class="border-t border-stone-800 my-1" x-show="isLoggedIn"></div>
              <button x-show="isLoggedIn" @click="logout(); dotMenuOpen = false" class="w-full text-left px-4 py-2.5 hover:bg-rose-500/10 text-rose-400 flex items-center"><i class="fa-solid fa-right-from-bracket mr-2.5 text-sm"></i> Çıkış Yap</button>
            </div>
          </div>
        </div>

      </div>
    </header>

    <main class="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col justify-center items-center">

      <div x-show="!isLoggedIn" class="max-w-md w-full glass-card rounded-3xl p-8 shadow-2xl text-center border gold-border">
        
        <div class="flex bg-[#1a1616] p-1.5 rounded-2xl mb-6 shadow-inner border border-stone-800">
          <button @click="authMode = 'login'" :class="authMode === 'login' ? 'gold-btn shadow font-black' : 'text-stone-400 font-bold'" class="w-1/2 py-2.5 rounded-xl text-xs transition-all">Giriş Yap</button>
          <button @click="authMode = 'register'" :class="authMode === 'register' ? 'bg-stone-800 text-white shadow font-black' : 'text-stone-400 font-bold'" class="w-1/2 py-2.5 rounded-xl text-xs transition-all">Hesap Oluştur</button>
        </div>

        <div x-show="authMode === 'login'">
          <div class="w-14 h-14 gold-badge rounded-2xl flex items-center justify-center text-xl mx-auto mb-4 border"><i class="fa-solid fa-lock"></i></div>
          <h2 class="text-xl font-black text-white mb-1">Tedarikçi Girişi</h2>
          <p class="text-xs font-semibold text-stone-300 mb-6">Kayıtlı e-posta adresinizle giriş yapın.</p>
          
          <form @submit.prevent="loginSupplier()" class="space-y-4 text-left">
            <div>
              <label class="block text-[10px] font-bold text-stone-300 uppercase tracking-wider mb-1">E-Posta Adresi</label>
              <input type="email" autocomplete="email" x-model="loginEmail" required placeholder="ornek@firma.com" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-yellow-400 shadow-inner">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-stone-300 uppercase tracking-wider mb-1">Şifre</label>
              <input type="password" autocomplete="current-password" x-model="loginPassword" required placeholder="••••••••" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-yellow-400 shadow-inner">
            </div>
            <div x-show="loginError" x-text="loginError" class="text-xs font-bold text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/30 text-center"></div>
            <button type="submit" class="w-full gold-btn font-extrabold py-3.5 rounded-xl shadow-lg transition-all text-sm mt-2">Giriş Yap</button>
          </form>
        </div>

        <div x-show="authMode === 'register'">
          <div class="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center text-xl mx-auto mb-4 border border-emerald-500/30"><i class="fa-solid fa-user-plus"></i></div>
          <h2 class="text-xl font-black text-white mb-1">Yeni Tedarikçi Hesabı</h2>
          <p class="text-xs font-semibold text-stone-300 mb-6">Bilgilerinizi girerek anında hesabınızı oluşturun.</p>
          
          <form @submit.prevent="registerSupplier()" class="space-y-3 text-left">
            <div>
              <label class="block text-[10px] font-bold text-stone-300 uppercase tracking-wider mb-1">Ad Soyad</label>
              <input type="text" autocomplete="name" x-model="regForm.fullName" required placeholder="Eren Evren Barış" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold shadow-inner">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-stone-300 uppercase tracking-wider mb-1">E-Posta Adresi</label>
              <input type="email" autocomplete="email" x-model="regForm.email" required placeholder="eren@coca-cola.com" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold shadow-inner">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-stone-300 uppercase tracking-wider mb-1">Firma Adı (Rent a Car / Şirket)</label>
              <input type="text" x-model="regForm.companyName" required placeholder="Budva Rent a Car" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold shadow-inner">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-stone-300 uppercase tracking-wider mb-1">Şifre Belirleyin</label>
              <input type="password" autocomplete="new-password" x-model="regForm.password" required placeholder="••••••••" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold shadow-inner">
            </div>
            <div x-show="regMessage" x-text="regMessage" :class="isRegError ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'" class="p-2.5 rounded-lg border text-xs font-bold text-center"></div>
            <button type="submit" class="w-full bg-stone-800 hover:bg-stone-700 text-white font-black py-3 rounded-xl shadow transition-all text-xs mt-2">Hesabımı Oluştur</button>
          </form>
        </div>

      </div>

      <div x-show="isLoggedIn" x-cloak class="w-full space-y-6">
        
        <div @click="activeTab = 'cars'" class="glass-card rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-center cursor-pointer hover:border-yellow-400 transition-all">
          <div class="flex items-center space-x-4 mb-4 md:mb-0">
            <div class="w-14 h-14 rounded-2xl gold-btn flex items-center justify-center font-black text-xl text-white shadow"><i class="fa-solid fa-car-side"></i></div>
            <div>
              <h2 class="text-xl font-extrabold text-white" x-text="companyName"></h2>
              <p class="text-xs font-semibold text-stone-300 mt-0.5"><i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i> <span x-text="t('activePanel')">Aktif VIP Tedarikçi Paneli</span></p>
            </div>
          </div>
          <div class="flex space-x-4 bg-[#1a1616] p-3 rounded-2xl border border-stone-800 text-xs text-center text-stone-200">
            <div><span class="text-stone-400 block uppercase font-bold text-[10px]" x-text="t('totalCars')">Toplam Araç</span><span class="text-lg font-black text-white" x-text="myCars.length">0</span></div>
            <div class="border-l border-stone-800 pl-4"><span class="text-stone-400 block uppercase font-bold text-[10px]" x-text="t('availableCars')">Müsait Araç</span><span class="text-lg font-black text-emerald-400" x-text="myCars.filter(c => c.available).length">0</span></div>
          </div>
        </div>

        <div x-show="activeTab === 'cars'" x-transition>
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-extrabold text-white"><i class="fa-solid fa-car text-yellow-400 mr-2"></i> <span x-text="t('myCarsTitle')">Sistemdeki Araçlarım</span></h3>
            <button @click="activeTab = 'add'" class="gold-btn font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center"><span class="w-4 h-4 rounded-full bg-[#141212] text-yellow-400 flex items-center justify-center mr-1.5 text-[10px] shadow-inner"><i class="fa-solid fa-plus"></i></span> <span x-text="t('addCar')">Yeni Araç Ekle</span></button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto pr-2">
            <template x-for="car in myCars" :key="car._id">
              <div class="car-card-bg border gold-border rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all flex flex-col justify-between">
                <div>
                  <div class="flex justify-between items-start mb-3">
                    <div>
                      <span class="text-[10px] font-black px-2.5 py-0.5 rounded-full gold-badge uppercase" x-text="car.category"></span>
                      <h4 class="text-base font-extrabold text-white mt-2" x-text="car.brand + ' ' + car.model"></h4>
                      <p class="text-xs font-semibold text-stone-300 mt-1"><i class="fa-solid fa-location-dot text-yellow-400 mr-1"></i> <span x-text="car.country + ' / ' + car.airports"></span></p>
                    </div>
                    <span :class="car.available ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'" class="px-2.5 py-1 rounded-lg text-[10px] font-black border" x-text="car.available ? t('available') : t('rented')"></span>
                  </div>
                  <div class="bg-[#1a1616] backdrop-blur-sm p-3 rounded-2xl my-4 text-xs space-y-1.5 border border-stone-800 shadow-inner text-stone-200">
                    <div class="flex justify-between"><span class="text-stone-400 font-medium" x-text="t('publishedDate')">Yayınlanma Tarihi:</span><span class="font-extrabold text-stone-200" x-text="new Date(car.createdAt).toLocaleString('tr-TR')"></span></div>
                    <div class="flex justify-between"><span class="text-stone-400 font-medium" x-text="t('dailyNet')">Günlük Net Kazanç:</span><span class="font-black text-yellow-400" x-text="(car.supplierPrice || 0) + ' ' + car.currency"></span></div>
                  </div>
                </div>
                <div class="pt-4 border-t border-stone-800 flex justify-between items-center text-xs">
                  <span class="text-stone-400 font-semibold"><span x-text="t('year')">Yıl</span>: <strong class="text-white" x-text="car.year"></strong></span>
                  <button @click="toggleMyCarStatus(car._id)" class="bg-stone-800 hover:bg-stone-700 text-stone-200 px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm" x-text="t('changeStatus')">Durum Değiştir</button>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div x-show="activeTab === 'wallet'" x-cloak x-transition>
          <h3 class="text-lg font-extrabold text-white mb-6"><i class="fa-solid fa-wallet text-yellow-400 mr-2"></i> <span x-text="t('walletTitle')">Hesap Özeti & Finansal Rapor</span></h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="glass-card rounded-3xl p-6 shadow-xl">
              <span class="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-2" x-text="t('totalPotential')">Toplam Aktif Araç Kazanç Potansiyeli</span>
              <div class="text-3xl font-black text-yellow-400" x-text="totalSupplierEarnings + ' €'"></div>
            </div>
            <div class="glass-card rounded-3xl p-6 shadow-xl">
              <span class="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-2" x-text="t('modelHeader')">İş Modeli</span>
              <div class="text-xl font-extrabold text-white" x-text="t('modelDesc')">Global B2B Dağıtım Sözleşmesi</div>
            </div>
          </div>
        </div>

        <div x-show="activeTab === 'loyalty'" x-cloak x-transition>
          <h3 class="text-lg font-extrabold text-white mb-6"><i class="fa-solid fa-award text-yellow-400 mr-2"></i> <span x-text="t('loyaltyTitle')">VIP Sadakat Primi & Seviye Durumu</span></h3>
          <div class="glass-card rounded-3xl p-8 shadow-2xl relative overflow-hidden text-stone-200">
            <div class="flex items-center space-x-4 mb-6 pb-4 border-b border-stone-800">
              <div class="w-16 h-16 rounded-2xl gold-btn flex items-center justify-center text-3xl shadow"><i class="fa-solid fa-shield-halved"></i></div>
              <div>
                <h4 class="text-xl font-black text-white" x-text="t('loyaltyHeader')">FlexiDrive İş Ortaklığı Kademesi</h4>
                <p class="text-xs font-semibold text-stone-400" x-text="t('loyaltySub')">Sistemdeki kıdeminize göre özel prim kazanma modülü.</p>
              </div>
            </div>
            <div class="bg-[#1a1616] border border-stone-800 rounded-2xl p-6 text-center space-y-4 shadow-inner">
              <div class="w-12 h-12 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center text-xl mx-auto border border-yellow-500/30 shadow-inner"><i class="fa-solid fa-lock"></i></div>
              <div>
                <h5 class="text-base font-black text-white" x-text="t('lockedTitle')">Sadakat Primi Modülü Şu An Kilitli</h5>
                <p class="text-xs font-semibold text-stone-400 mt-1 max-w-lg mx-auto" x-text="t('lockedDesc')">
                  VIP Sadakat Primi ve ek ciro desteklerinden yararlanabilmeniz için en az 3 ay kesintisiz aktif iş ortaklığı yürütmeniz gerekmektedir.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div x-show="activeTab === 'stats'" x-cloak x-transition>
          <h3 class="text-lg font-extrabold text-white mb-6"><i class="fa-solid fa-chart-line text-yellow-400 mr-2"></i> <span x-text="t('statsTitle')">Kiralama Performans İstatistikleri</span></h3>
          <div class="glass-card rounded-3xl p-6 space-y-4 shadow-xl text-stone-200">
            <div class="flex justify-between items-center pb-4 border-b border-stone-800 text-xs">
              <span class="text-stone-400 font-bold" x-text="t('fleetShare')">Toplam Filo Havuzundaki Payınız</span>
              <span class="text-white font-black text-sm" x-text="myCars.length + ' Araç'"></span>
            </div>
            <div class="flex justify-between items-center text-xs">
              <span class="text-stone-400 font-bold" x-text="t('opStatus')">Operasyonel Durum</span>
              <span class="text-emerald-400 font-black bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 shadow-sm" x-text="t('activeStatus')">Sorunsuz & Aktif</span>
            </div>
          </div>
        </div>

        <div x-show="activeTab === 'add'" x-cloak x-transition class="glass-card rounded-3xl p-8 shadow-2xl relative overflow-hidden text-stone-200">
          <h3 class="text-xl font-black text-white mb-2"><i class="fa-solid fa-plus-circle text-yellow-400 mr-2"></i> <span x-text="t('addNewCar')">Filoya Yeni Araç Ekle</span></h3>
          <p class="text-xs font-semibold text-stone-400 mb-6"><span x-text="t('companyMatch')">Firma adınız otomatik eşleştirilmektedir:</span> <strong class="text-white" x-text="companyName"></strong></p>
          
          <form @submit.prevent="submitCar" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-4">
                <div>
                  <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('countrySelect')">Ülke Seçimi</label>
                  <select x-model="form.country" @change="updateCountryData(form.country)" required class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-4 py-3 text-white text-sm font-bold shadow-inner">
                    <option value="" disabled selected>Ülke Seçin</option>
                    <template x-for="c in countries" :key="c.name"><option :value="c.name" x-text="c.flag + ' ' + c.name"></option></template>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('airportSelect')">Havalimanı / Teslim Noktası</label>
                  <select x-model="form.airports" required :disabled="!form.country" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-4 py-3 text-white text-sm font-bold disabled:opacity-40 shadow-inner">
                    <option value="" disabled selected>Önce Ülke Seçin</option>
                    <template x-for="airport in availableAirports" :key="airport"><option :value="airport" x-text="airport"></option></template>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('panelPass')">Panel Şifreniz</label>
                  <input type="password" autocomplete="current-password" x-model="form.supplierPassword" required placeholder="••••••••" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-4 py-3 text-white text-sm font-bold shadow-inner">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('phoneNum')">İletişim Numarası (Telefon)</label>
                  <div class="flex space-x-2">
                    <select x-model="form.selectedDial" @change="updateDialCode(form.selectedDial)" class="w-36 bg-[#1a1616] border border-stone-700 rounded-xl px-2.5 py-3 text-yellow-400 text-xs font-mono font-bold shadow-inner">
                      <template x-for="c in countries" :key="c.dial">
                        <option :value="c.dial" x-text="c.flag + ' ' + c.dial"></option>
                      </template>
                    </select>
                    <input type="tel" x-model="form.phoneOnly" required placeholder="5XX XXX XX XX" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-4 py-3 text-white text-sm font-mono shadow-inner">
                  </div>
                </div>
              </div>

              <div class="space-y-4">
                <div class="flex space-x-3">
                  <div class="w-1/2">
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('brand')">Marka</label>
                    <select x-model="form.brand" @change="form.model = ''; availableModels = carData[form.brand] || []" required class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3 py-3 text-white text-sm font-bold shadow-inner">
                      <option value="" disabled selected>Marka Seçin</option>
                      <template x-for="(models, brandName) in carData" :key="brandName"><option :value="brandName" x-text="brandName"></option></template>
                    </select>
                  </div>
                  <div class="w-1/2">
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('model')">Model</label>
                    <select x-model="form.model" required :disabled="!form.brand" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3 py-3 text-white text-sm font-bold disabled:opacity-40 shadow-inner">
                      <option value="" disabled selected>Önce Marka Seçin</option>
                      <template x-for="modelName in availableModels" :key="modelName"><option :value="modelName" x-text="modelName"></option></template>
                    </select>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('year')">Yıl</label>
                    <input type="number" x-model="form.year" required min="2000" max="2027" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3 py-3 text-white text-sm font-bold shadow-inner">
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('category')">Sınıf</label>
                    <select x-model="form.category" required class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-2 py-3 text-white text-sm font-bold shadow-inner">
                      <option value="Ekonomik">Ekonomik</option><option value="SUV">SUV</option><option value="Sedan">Sedan</option><option value="Lüks">Lüks</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('fuel')">Yakıt</label>
                    <select x-model="form.fuelType" required class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-2 py-3 text-white text-sm font-bold shadow-inner">
                      <option value="Benzin">Benzin</option><option value="Dizel">Dizel</option><option value="Hibrit">Hibrit</option><option value="Elektrik">Elektrik</option>
                    </select>
                  </div>
                </div>

                <div class="flex space-x-3">
                  <div class="w-1/3">
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('luggage')">Bavul</label>
                    <input type="number" x-model="form.luggageCapacity" required min="0" max="10" placeholder="Adet" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3 py-3 text-white text-sm font-bold shadow-inner">
                  </div>
                  <div class="w-2/3">
                    <label class="block text-[10px] font-black text-yellow-400 uppercase tracking-wider mb-1" x-text="t('dailyNetEarn')">Günlük Net Kazanç (Max 400 €)</label>
                    <div class="relative">
                      <span class="absolute left-3 top-3 text-yellow-400 font-black text-base" x-text="form.currency"></span>
                      <input type="number" x-model="form.supplierPrice" required min="1" max="400" placeholder="Max 400" class="w-full bg-[#1a1616] border-2 border-stone-700 rounded-xl pl-8 pr-3 py-3 text-white text-sm font-black focus:border-yellow-400 shadow-inner">
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div x-show="message" x-text="message" :class="isError ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'" class="p-3 rounded-xl border text-sm font-bold text-center shadow-sm"></div>
            
            <button type="submit" class="w-full gold-btn font-black py-4 rounded-xl shadow-lg transition-all"><i class="fa-solid fa-cloud-arrow-up mr-2"></i> <span x-text="t('saveAndPublish')">Aracı Sisteme Kaydet ve Listeme Ekle</span></button>
          </form>
        </div>

      </div>

    </main>

    <!-- SOL ALT "LIVE DESK" CANLI DESTEK MASASI -->
    <a href="https://wa.me/905342258858?text=Merhaba,%20FlexiDrive%20tedarikçi%20destek%20hattından%20ulaşıyorum." target="_blank" class="fixed bottom-6 left-6 z-50 flex items-center space-x-3 bg-[#141212]/95 backdrop-blur-md border-2 border-yellow-400 py-3 px-4 rounded-full shadow-2xl hover:scale-105 transition-transform group" title="Live Desk - Canlı Destek Masası">
      <div class="w-10 h-10 rounded-full gold-btn flex items-center justify-center text-lg text-white shadow-inner animate-pulse">
        <i class="fa-solid fa-headset"></i>
      </div>
      <div class="flex flex-col pr-2">
        <span class="text-[9px] font-extrabold text-yellow-400 uppercase tracking-widest leading-none">Live Desk</span>
        <span class="text-xs font-black text-white mt-0.5">Canlı Destek Masası</span>
      </div>
    </a>
  </div>

  <footer class="w-full py-6 text-center text-xs text-stone-400 border-t border-stone-800 bg-[#141212]/90 backdrop-blur-sm" x-text="t('footer')">
    Tüm Hakları Saklıdır © 2026 FlexiDrive Global OS. Kurumsal B2B Araç Kiralama Ekosistemi.
  </footer>

  <script>
    const TRANSLATIONS = {
      tr: { quickMenu: 'Hızlı Menü', fleet: 'Filo Operasyonları', suppliers: 'Tedarikçi Ağı', feed: 'Meta-Search Feed', supplierPortal: 'Tedarikçi Portalı', totalFleet: 'Toplam Filo', activeAvailable: 'Aktif / Müsait', dailyRevenue: 'Günlük Potansiyel Ciro', available: 'MÜSAİT', rented: 'KİRADA', netSale: 'Net / Satış:', published: 'Yayınlanma:', changeStatus: 'Durum Değiştir', removeCar: 'Aracı Kaldır', supplierReportTitle: 'Ülke Bazlı Tedarikçi Hacim Raporu', supplierReportSub: 'Ülkelere göre gruplanmış tedarikçi firmalarınız', metaTitle: 'Meta-Search Entegrasyon Merkezi', metaSub: 'Skyscanner ve Kayak gibi platformların envanterinizi çekeceği açık API adresi.', feedAddress: 'Resmi JSON Feed Bağlantı Adresi', copy: 'Kopyala', footer: 'Tüm Hakları Saklıdır © 2026 FlexiDrive Global OS.' },
      en: { quickMenu: 'Quick Menu', fleet: 'Fleet Operations', suppliers: 'Supplier Network', feed: 'Meta-Search Feed', supplierPortal: 'Supplier Portal', totalFleet: 'Total Fleet', activeAvailable: 'Active / Available', dailyRevenue: 'Daily Potential Revenue', available: 'AVAILABLE', rented: 'RENTED', netSale: 'Net / Sale:', published: 'Published:', changeStatus: 'Toggle Status', removeCar: 'Remove Car', supplierReportTitle: 'Country-Based Supplier Volume Report', supplierReportSub: 'Suppliers grouped by country', metaTitle: 'Meta-Search Integration Center', metaSub: 'Open API address for Skyscanner and Kayak.', feedAddress: 'Official JSON Feed Address', copy: 'Copy', footer: 'All Rights Reserved © 2026 FlexiDrive Global OS.' },
      de: { quickMenu: 'Schnellmenü', fleet: 'Flottenbetrieb', suppliers: 'Lieferantennetzwerk', feed: 'Meta-Search Feed', supplierPortal: 'Lieferantenportal', totalFleet: 'Gesamte Flotte', activeAvailable: 'Aktiv / Verfügbar', dailyRevenue: 'Ttäglicher Umsatz', available: 'VERFÜGBAR', rented: 'VERMIETET', netSale: 'Netto / Verkauf:', published: 'Veröffentlicht:', changeStatus: 'Status Ändern', removeCar: 'Fahrzeug Entfernen', supplierReportTitle: 'Länderbasieter Lieferantenbericht', supplierReportSub: 'Lieferanten nach Ländern gruppiert', metaTitle: 'Meta-Search Integrationszentrum', metaSub: 'Offene API-Adresse für Skyscanner und Kayak.', feedAddress: 'Offizielle JSON Feed Adresse', copy: 'Kopieren', footer: 'Alle Rechte vorbehalten © 2026 FlexiDrive Global OS.' },
      it: { quickMenu: 'Menu Rapido', fleet: 'Operazioni Flotta', suppliers: 'Rete Fornitori', feed: 'Meta-Search Feed', supplierPortal: 'Meta-Search Feed', supplierPortal: 'Portale Fornitori', totalFleet: 'Flotta Totale', activeAvailable: 'Attivo / Disponibile', dailyRevenue: 'Potenziale Ricavo Giornaliero', available: 'DISPONIBILE', rented: 'AFFITTATO', netSale: 'Netto / Vendita:', published: 'Pubblicato:', changeStatus: 'Cambia Stato', removeCar: 'Rimuovi Auto', supplierReportTitle: 'Rapporto Fornitori per Paese', supplierReportSub: 'Fornitori raggruppati per paese', metaTitle: 'Centro Integrazione Meta-Search', metaSub: 'Indirizzo API aperto per Skyscanner e Kayak.', feedAddress: 'Indirizzo JSON Feed Ufficiale', copy: 'Copia', footer: 'Tutti i diritti riservati © 2026 FlexiDrive Global OS.' }
    };

    document.addEventListener('alpine:init', () => {
      Alpine.data('adminApp', () => ({
        isAdminLoggedIn: false,
        adminPasswordInput: '',
        adminLoginError: '',
        activeTab: 'admin',
        cars: [],
        supplierUsers: [],
        selectedCar: null,
        selectedTaxSupplier: null,
        currentLang: 'tr',
        windowOrigin: window.location.origin,
        async init() {
          const isAuth = localStorage.getItem('flexi_admin_auth');
          if (isAuth === 'true') {
            this.isAdminLoggedIn = true;
            await this.fetchCars();
            await this.fetchSupplierDetails();
          }
        },
        async loginAdmin() {
          this.adminLoginError = '';
          if (this.adminPasswordInput.trim() === 'eren2026') {
            this.isAdminLoggedIn = true;
            localStorage.setItem('flexi_admin_auth', 'true');
            await this.fetchCars();
            await this.fetchSupplierDetails();
          } else {
            this.adminLoginError = 'Hatalı Admin Şifresi!';
          }
        },
        logoutAdmin() {
          localStorage.removeItem('flexi_admin_auth');
          this.isAdminLoggedIn = false;
          this.adminPasswordInput = '';
        },
        openCarDetails(car) {
          this.selectedCar = car;
        },
        openTaxDetails(supplier) {
          const found = this.supplierUsers.find(u => u.companyName && u.companyName.trim().toLowerCase() === supplier.name.trim().toLowerCase());
          this.selectedTaxSupplier = {
            ...supplier,
            taxNumber: found ? (found.taxNumber || 'TR9876543210') : 'TR9876543210',
            taxOffice: found ? (found.taxOffice || 'Merkez Kurumsal VD') : 'Merkez Kurumsal VD',
            address: found ? (found.address || 'Global Ticaret Merkezi, No: 42') : 'Global Ticaret Merkezi, No: 42'
          };
        },
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
        async fetchSupplierDetails() {
          try {
            const res = await fetch('/api/suppliers/details');
            this.supplierUsers = await res.json();
          } catch (err) {}
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
          const flags = { 'Almanya': '🇩🇪', 'İtalya': '🇮🇹', 'Yunanistan': '🇬🇷', 'Hırvatistan': '🇭🇷', 'Karadağ': '🇲🇪', 'Türkiye': '🇹🇷', 'Sırbistan': '🇷🇸', 'Arnavutluk': '🇦🇱', 'Bosna Hersek': '🇧🇦', 'Bulgaristan': '🇧🇬', 'Kuzey Makedonya': '🇲🇰', 'Fransa': '🇫🇷', 'İspanya': '🇪🇸', 'Avusturya': '🇦🇹', 'İsviçre': '🇨🇭', 'Hollanda': '🇳🇱' };
          return flags[country] || '🏳️';
        },
        get groupedSuppliersByCountry() {
          const countryMap = new Map();
          this.cars.carsforEach || this.cars.forEach(c => {
            if (!c.supplierName || !c.country) return;
            const countryKey = c.country.trim();
            if (!countryMap.has(countryKey)) {
              countryMap.set(countryKey, { country: countryKey, flag: this.getFlag(countryKey), suppliersMap: new Map(), totalCars: 0 });
            }
            const countryGroup = countryMap.get(countryKey);
            countryGroup.totalCars++;
            const supKey = c.supplierName.trim().toLowerCase();
            if (!countryGroup.suppliersMap.has(supKey)) {
              countryGroup.suppliersMap.set(supKey, { name: c.supplierName.trim(), contact: c.supplierContact, carCount: 0, activeCars: 0 });
            }
            const supObj = countryGroup.suppliersMap.get(supKey);
            supObj.carCount++;
            if (c.available) {
              supObj.activeCars++;
            }
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


// 5. TEDARİKÇİ PORTALI (Red & Gold Edition)
app.get('/tedarikci-paneli', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexiDrive Tedarikçi Portalı</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { 
      font-family: 'Plus Jakarta Sans', sans-serif; 
      color: #f8fafc; 
      background: linear-gradient(to bottom, rgba(13, 13, 13, 0.75), rgba(20, 18, 18, 0.92)), 
                  url('https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=1920&q=80');
      background-size: cover;
      background-position: center;
      background-attachment: fixed;
    }
    [x-cloak] { display: none !important; }
    .coke-red { background: linear-gradient(135deg, #f40009 0%, #b30005 100%); }
    .gold-border { border-color: rgba(212, 175, 55, 0.4); }
    .gold-badge { background: linear-gradient(135deg, rgba(212, 175, 55, 0.25), rgba(244, 0, 9, 0.2)); color: #ffd700; border: 1px solid rgba(212, 175, 55, 0.5); }
    .gold-btn { background: linear-gradient(135deg, #d4af37 0%, #aa820a 100%); color: #ffffff; box-shadow: 0 10px 25px -5px rgba(212, 175, 55, 0.4); }
    .gold-btn:hover { background: linear-gradient(135deg, #e6c555 0%, #d4af37 100%); }
    .glass-card { background: rgba(20, 18, 18, 0.88); backdrop-filter: blur(16px); border: 1px solid rgba(212, 175, 55, 0.3); box-shadow: 0 25px 50px -12px rgba(244, 0, 9, 0.2); }
    .car-card-bg {
      background-image: linear-gradient(to bottom, rgba(20, 18, 18, 0.96), rgba(20, 18, 18, 0.99)), url('https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80');
      background-size: cover;
      background-position: center;
    }
    .scrollable-nav { overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
    .scrollable-nav::-webkit-scrollbar { display: none; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #141212; border-radius: 4px; }
    ::-webkit-scrollbar-thumb { background: #d4af37; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #ffd700; }

    select {
      appearance: none;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffd700' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      background-size: 1.1em;
      padding-right: 2.2rem !important;
    }
    select::-ms-expand { display: none; }
  </style>
</head>
<body class="h-full flex flex-col justify-between" x-data="supplierPortal()">

  <div>
    <header class="bg-[#141212]/95 backdrop-blur-md border-b gold-border sticky top-0 z-40 shadow-2xl">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        <div @click="activeTab = 'cars'" class="flex items-center space-x-3 cursor-pointer group" title="Ana Menüye Dön">
          <div class="w-12 h-12 rounded-2xl coke-red flex items-center justify-center font-black text-xl text-white shadow-lg group-hover:scale-105 transition-transform border border-yellow-400/40">
            <i class="fa-solid fa-route text-yellow-300"></i>
          </div>
          <div class="flex flex-col">
            <div class="flex items-center space-x-2">
              <span class="text-2xl font-black tracking-tight text-white">FlexiDrive</span>
              <span class="text-[9px] font-extrabold gold-badge px-2.5 py-0.5 rounded-full uppercase tracking-widest" x-text="t('supplierBadge')">Tedarikçi</span>
            </div>
            <span class="text-[10px] text-stone-400 font-semibold tracking-wide flex items-center mt-0.5"><i class="fa-solid fa-users mr-1 text-yellow-400 text-[9px]"></i> users portal</span>
          </div>
        </div>
        
        <div class="flex items-center space-x-3">
          <div class="scrollable-nav flex items-center space-x-2 py-2" x-show="isLoggedIn">
            <button @click="activeTab = 'cars'" :class="activeTab === 'cars' ? 'gold-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center"><i class="fa-solid fa-car mr-2"></i> <span x-text="t('myCars')">Araçlarım</span></button>
            <button @click="activeTab = 'wallet'" :class="activeTab === 'wallet' ? 'gold-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center"><i class="fa-solid fa-wallet mr-2"></i> <span x-text="t('wallet')">Hesap Özeti</span></button>
            <button @click="activeTab = 'loyalty'" :class="activeTab === 'loyalty' ? 'gold-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center"><i class="fa-solid fa-award mr-2"></i> <span x-text="t('loyalty')">Sadakat Primi</span></button>
            <button @click="activeTab = 'stats'" :class="activeTab === 'stats' ? 'gold-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center"><i class="fa-solid fa-chart-line mr-2"></i> <span x-text="t('stats')">İstatistikler</span></button>
            
            <button @click="activeTab = 'add'" :class="activeTab === 'add' ? 'bg-yellow-500 text-stone-950 shadow-lg ring-2 ring-yellow-400' : 'gold-btn shadow-md hover:scale-105'" class="px-4 py-2.5 rounded-xl font-black text-xs transition-all inline-flex items-center border gold-border">
              <span class="w-5 h-5 rounded-full bg-[#141212] text-yellow-400 flex items-center justify-center mr-2 text-xs font-black shadow-inner"><i class="fa-solid fa-plus"></i></span> <span x-text="t('addCar')">Yeni Araç Ekle</span>
            </button>
          </div>

          <div class="relative inline-block" x-data="{ langOpen: false }">
            <button @click="langOpen = !langOpen" class="bg-[#1a1616] border gold-border text-yellow-400 px-3.5 py-2.5 rounded-xl font-black text-xs inline-flex items-center shadow">
              <i class="fa-solid fa-globe mr-1.5"></i> <span x-text="currentLang.toUpperCase()"></span>
            </button>
            <div x-show="langOpen" @click.outside="langOpen = false" x-cloak class="absolute right-0 mt-2 w-36 bg-[#1a1616] border gold-border rounded-xl shadow-2xl py-1 z-50 text-xs font-bold text-stone-200">
              <div @click="setLang('tr'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center"><span class="mr-2">🇹🇷</span> Türkçe</div>
              <div @click="setLang('en'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center"><span class="mr-2">🇬🇧</span> English</div>
              <div @click="setLang('de'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center"><span class="mr-2">🇩🇪</span> Deutsch</div>
              <div @click="setLang('it'); langOpen = false" class="px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center"><span class="mr-2">🇮🇹</span> Italiano</div>
            </div>
          </div>

          <div class="relative inline-block" x-data="{ dotMenuOpen: false }">
            <button @click="dotMenuOpen = !dotMenuOpen" class="bg-[#1a1616] hover:bg-stone-800 border gold-border text-yellow-400 p-3 rounded-xl text-xs transition-all inline-flex items-center shadow" title="Seçenekler">
              <i class="fa-solid fa-ellipsis-vertical text-base"></i>
            </button>
            <div x-show="dotMenuOpen" @click.outside="dotMenuOpen = false" x-cloak class="absolute right-0 mt-2 w-48 bg-[#1a1616] border gold-border rounded-xl shadow-2xl py-2 z-50 text-xs font-bold text-stone-200">
              <a href="https://wa.me/905342258858" target="_blank" class="px-4 py-2.5 hover:bg-stone-800 flex items-center text-emerald-400"><i class="fa-brands fa-whatsapp mr-2.5 text-sm"></i> WhatsApp Destek</a>
              <a href="tel:05342258858" class="px-4 py-2.5 hover:bg-stone-800 flex items-center text-yellow-400"><i class="fa-solid fa-phone mr-2.5 text-sm"></i> Direkt Ara</a>
              <a href="mailto:support@flexidrive.app" class="px-4 py-2.5 hover:bg-stone-800 flex items-center text-stone-300"><i class="fa-solid fa-envelope mr-2.5 text-sm"></i> E-Posta Gönder</a>
              <div class="border-t border-stone-800 my-1" x-show="isLoggedIn"></div>
              <button x-show="isLoggedIn" @click="logout(); dotMenuOpen = false" class="w-full text-left px-4 py-2.5 hover:bg-rose-500/10 text-rose-400 flex items-center"><i class="fa-solid fa-right-from-bracket mr-2.5 text-sm"></i> Çıkış Yap</button>
            </div>
          </div>
        </div>

      </div>
    </header>

    <main class="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col justify-center items-center">

      <div x-show="!isLoggedIn" class="max-w-md w-full glass-card rounded-3xl p-8 shadow-2xl text-center border gold-border">
        
        <div class="flex bg-[#1a1616] p-1.5 rounded-2xl mb-6 shadow-inner border border-stone-800">
          <button @click="authMode = 'login'" :class="authMode === 'login' ? 'gold-btn shadow font-black' : 'text-stone-400 font-bold'" class="w-1/2 py-2.5 rounded-xl text-xs transition-all">Giriş Yap</button>
          <button @click="authMode = 'register'" :class="authMode === 'register' ? 'bg-stone-800 text-white shadow font-black' : 'text-stone-400 font-bold'" class="w-1/2 py-2.5 rounded-xl text-xs transition-all">Hesap Oluştur</button>
        </div>

        <div x-show="authMode === 'login'">
          <div class="w-14 h-14 gold-badge rounded-2xl flex items-center justify-center text-xl mx-auto mb-4 border"><i class="fa-solid fa-lock"></i></div>
          <h2 class="text-xl font-black text-white mb-1">Tedarikçi Girişi</h2>
          <p class="text-xs font-semibold text-stone-300 mb-6">Kayıtlı e-posta adresinizle giriş yapın.</p>
          
          <form @submit.prevent="loginSupplier()" class="space-y-4 text-left">
            <div>
              <label class="block text-[10px] font-bold text-stone-300 uppercase tracking-wider mb-1">E-Posta Adresi</label>
              <input type="email" autocomplete="email" x-model="loginEmail" required placeholder="ornek@firma.com" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-yellow-400 shadow-inner">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-stone-300 uppercase tracking-wider mb-1">Şifre</label>
              <input type="password" autocomplete="current-password" x-model="loginPassword" required placeholder="••••••••" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-yellow-400 shadow-inner">
            </div>
            <div x-show="loginError" x-text="loginError" class="text-xs font-bold text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/30 text-center"></div>
            <button type="submit" class="w-full gold-btn font-extrabold py-3.5 rounded-xl shadow-lg transition-all text-sm mt-2">Giriş Yap</button>
          </form>
        </div>

        <div x-show="authMode === 'register'">
          <div class="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center text-xl mx-auto mb-4 border border-emerald-500/30"><i class="fa-solid fa-user-plus"></i></div>
          <h2 class="text-xl font-black text-white mb-1">Yeni Tedarikçi Hesabı</h2>
          <p class="text-xs font-semibold text-stone-300 mb-6">Bilgilerinizi girerek anında hesabınızı oluşturun.</p>
          
          <form @submit.prevent="registerSupplier()" class="space-y-3 text-left">
            <div>
              <label class="block text-[10px] font-bold text-stone-300 uppercase tracking-wider mb-1">Ad Soyad</label>
              <input type="text" autocomplete="name" x-model="regForm.fullName" required placeholder="Eren Evren Barış" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold shadow-inner">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-stone-300 uppercase tracking-wider mb-1">E-Posta Adresi</label>
              <input type="email" autocomplete="email" x-model="regForm.email" required placeholder="eren@coca-cola.com" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold shadow-inner">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-stone-300 uppercase tracking-wider mb-1">Firma Adı (Rent a Car / Şirket)</label>
              <input type="text" x-model="regForm.companyName" required placeholder="Budva Rent a Car" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold shadow-inner">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-stone-300 uppercase tracking-wider mb-1">Şifre Belirleyin</label>
              <input type="password" autocomplete="new-password" x-model="regForm.password" required placeholder="••••••••" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold shadow-inner">
            </div>
            <div x-show="regMessage" x-text="regMessage" :class="isRegError ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'" class="p-2.5 rounded-lg border text-xs font-bold text-center"></div>
            <button type="submit" class="w-full bg-stone-800 hover:bg-stone-700 text-white font-black py-3 rounded-xl shadow transition-all text-xs mt-2">Hesabımı Oluştur</button>
          </form>
        </div>

      </div>

      <div x-show="isLoggedIn" x-cloak class="w-full space-y-6">
        
        <div @click="activeTab = 'cars'" class="glass-card rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-center cursor-pointer hover:border-yellow-400 transition-all">
          <div class="flex items-center space-x-4 mb-4 md:mb-0">
            <div class="w-14 h-14 rounded-2xl gold-btn flex items-center justify-center font-black text-xl text-white shadow"><i class="fa-solid fa-car-side"></i></div>
            <div>
              <h2 class="text-xl font-extrabold text-white" x-text="companyName"></h2>
              <p class="text-xs font-semibold text-stone-300 mt-0.5"><i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i> <span x-text="t('activePanel')">Aktif VIP Tedarikçi Paneli</span></p>
            </div>
          </div>
          <div class="flex space-x-4 bg-[#1a1616] p-3 rounded-2xl border border-stone-800 text-xs text-center text-stone-200">
            <div><span class="text-stone-400 block uppercase font-bold text-[10px]" x-text="t('totalCars')">Toplam Araç</span><span class="text-lg font-black text-white" x-text="myCars.length">0</span></div>
            <div class="border-l border-stone-800 pl-4"><span class="text-stone-400 block uppercase font-bold text-[10px]" x-text="t('availableCars')">Müsait Araç</span><span class="text-lg font-black text-emerald-400" x-text="myCars.filter(c => c.available).length">0</span></div>
          </div>
        </div>

        <div x-show="activeTab === 'cars'" x-transition>
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-extrabold text-white"><i class="fa-solid fa-car text-yellow-400 mr-2"></i> <span x-text="t('myCarsTitle')">Sistemdeki Araçlarım</span></h3>
            <button @click="activeTab = 'add'" class="gold-btn font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center"><span class="w-4 h-4 rounded-full bg-[#141212] text-yellow-400 flex items-center justify-center mr-1.5 text-[10px] shadow-inner"><i class="fa-solid fa-plus"></i></span> <span x-text="t('addCar')">Yeni Araç Ekle</span></button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto pr-2">
            <template x-for="car in myCars" :key="car._id">
              <div class="car-card-bg border gold-border rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all flex flex-col justify-between">
                <div>
                  <div class="flex justify-between items-start mb-3">
                    <div>
                      <span class="text-[10px] font-black px-2 py-0.5 rounded gold-badge uppercase" x-text="car.category"></span>
                      <h4 class="text-base font-extrabold text-white mt-2" x-text="car.brand + ' ' + car.model"></h4>
                      <p class="text-xs font-semibold text-stone-300 mt-1"><i class="fa-solid fa-location-dot text-yellow-400 mr-1"></i> <span x-text="car.country + ' / ' + car.airports"></span></p>
                    </div>
                    <span :class="car.available ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'" class="px-2.5 py-1 rounded-lg text-[10px] font-black border" x-text="car.available ? t('available') : t('rented')"></span>
                  </div>
                  <div class="bg-[#1a1616] backdrop-blur-sm p-3 rounded-2xl my-4 text-xs space-y-1.5 border border-stone-800 shadow-inner text-stone-200">
                    <div class="flex justify-between"><span class="text-stone-400 font-medium" x-text="t('publishedDate')">Yayınlanma Tarihi:</span><span class="font-extrabold text-stone-200" x-text="new Date(car.createdAt).toLocaleString('tr-TR')"></span></div>
                    <div class="flex justify-between"><span class="text-stone-400 font-medium" x-text="t('dailyNet')">Günlük Net Kazanç:</span><span class="font-black text-yellow-400" x-text="(car.supplierPrice || 0) + ' ' + car.currency"></span></div>
                  </div>
                </div>
                <div class="pt-4 border-t border-stone-800 flex justify-between items-center text-xs">
                  <span class="text-stone-400 font-semibold"><span x-text="t('year')">Yıl</span>: <strong class="text-white" x-text="car.year"></strong></span>
                  <button @click="toggleMyCarStatus(car._id)" class="bg-stone-800 hover:bg-stone-700 text-stone-200 px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm" x-text="t('changeStatus')">Durum Değiştir</button>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div x-show="activeTab === 'wallet'" x-cloak x-transition>
          <h3 class="text-lg font-extrabold text-white mb-6"><i class="fa-solid fa-wallet text-yellow-400 mr-2"></i> <span x-text="t('walletTitle')">Hesap Özeti & Finansal Rapor</span></h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="glass-card rounded-3xl p-6 shadow-xl">
              <span class="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-2" x-text="t('totalPotential')">Toplam Aktif Araç Kazanç Potansiyeli</span>
              <div class="text-3xl font-black text-yellow-400" x-text="totalSupplierEarnings + ' €'"></div>
            </div>
            <div class="glass-card rounded-3xl p-6 shadow-xl">
              <span class="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-2" x-text="t('modelHeader')">İş Modeli</span>
              <div class="text-xl font-extrabold text-white" x-text="t('modelDesc')">Global B2B Dağıtım Sözleşmesi</div>
            </div>
          </div>
        </div>

        <div x-show="activeTab === 'loyalty'" x-cloak x-transition>
          <h3 class="text-lg font-extrabold text-white mb-6"><i class="fa-solid fa-award text-yellow-400 mr-2"></i> <span x-text="t('loyaltyTitle')">VIP Sadakat Primi & Seviye Durumu</span></h3>
          <div class="glass-card rounded-3xl p-8 shadow-2xl relative overflow-hidden text-stone-200">
            <div class="flex items-center space-x-4 mb-6 pb-4 border-b border-stone-800">
              <div class="w-16 h-16 rounded-2xl gold-btn flex items-center justify-center text-3xl shadow"><i class="fa-solid fa-shield-halved"></i></div>
              <div>
                <h4 class="text-xl font-black text-white" x-text="t('loyaltyHeader')">FlexiDrive İş Ortaklığı Kademesi</h4>
                <p class="text-xs font-semibold text-stone-400" x-text="t('loyaltySub')">Sistemdeki kıdeminize göre özel prim kazanma modülü.</p>
              </div>
            </div>
            <div class="bg-[#1a1616] border border-stone-800 rounded-2xl p-6 text-center space-y-4 shadow-inner">
              <div class="w-12 h-12 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center text-xl mx-auto border border-yellow-500/30 shadow-inner"><i class="fa-solid fa-lock"></i></div>
              <div>
                <h5 class="text-base font-black text-white" x-text="t('lockedTitle')">Sadakat Primi Modülü Şu An Kilitli</h5>
                <p class="text-xs font-semibold text-stone-400 mt-1 max-w-lg mx-auto" x-text="t('lockedDesc')">
                  VIP Sadakat Primi ve ek ciro desteklerinden yararlanabilmeniz için en az 3 ay kesintisiz aktif iş ortaklığı yürütmeniz gerekmektedir.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div x-show="activeTab === 'stats'" x-cloak x-transition>
          <h3 class="text-lg font-extrabold text-white mb-6"><i class="fa-solid fa-chart-line text-yellow-400 mr-2"></i> <span x-text="t('statsTitle')">Kiralama Performans İstatistikleri</span></h3>
          <div class="glass-card rounded-3xl p-6 space-y-4 shadow-xl text-stone-200">
            <div class="flex justify-between items-center pb-4 border-b border-stone-800 text-xs">
              <span class="text-stone-400 font-bold" x-text="t('fleetShare')">Toplam Filo Havuzundaki Payınız</span>
              <span class="text-white font-black text-sm" x-text="myCars.length + ' Araç'"></span>
            </div>
            <div class="flex justify-between items-center text-xs">
              <span class="text-stone-400 font-bold" x-text="t('opStatus')">Operasyonel Durum</span>
              <span class="text-emerald-400 font-black bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 shadow-sm" x-text="t('activeStatus')">Sorunsuz & Aktif</span>
            </div>
          </div>
        </div>

        <div x-show="activeTab === 'add'" x-cloak x-transition class="glass-card rounded-3xl p-8 shadow-2xl relative overflow-hidden text-stone-200">
          <h3 class="text-xl font-black text-white mb-2"><i class="fa-solid fa-plus-circle text-yellow-400 mr-2"></i> <span x-text="t('addNewCar')">Filoya Yeni Araç Ekle</span></h3>
          <p class="text-xs font-semibold text-stone-400 mb-6"><span x-text="t('companyMatch')">Firma adınız otomatik eşleştirilmektedir:</span> <strong class="text-white" x-text="companyName"></strong></p>
          
          <form @submit.prevent="submitCar" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-4">
                <div>
                  <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('countrySelect')">Ülke Seçimi</label>
                  <select x-model="form.country" @change="updateCountryData(form.country)" required class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-4 py-3 text-white text-sm font-bold shadow-inner">
                    <option value="" disabled selected>Ülke Seçin</option>
                    <template x-for="c in countries" :key="c.name"><option :value="c.name" x-text="c.flag + ' ' + c.name"></option></template>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('airportSelect')">Havalimanı / Teslim Noktası</label>
                  <select x-model="form.airports" required :disabled="!form.country" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-4 py-3 text-white text-sm font-bold disabled:opacity-40 shadow-inner">
                    <option value="" disabled selected>Önce Ülke Seçin</option>
                    <template x-for="airport in availableAirports" :key="airport"><option :value="airport" x-text="airport"></option></template>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('panelPass')">Panel Şifreniz</label>
                  <input type="password" autocomplete="current-password" x-model="form.supplierPassword" required placeholder="••••••••" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-4 py-3 text-white text-sm font-bold shadow-inner">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('phoneNum')">İletişim Numarası (Telefon)</label>
                  <div class="flex space-x-2">
                    <select x-model="form.selectedDial" @change="updateDialCode(form.selectedDial)" class="w-36 bg-[#1a1616] border border-stone-700 rounded-xl px-2.5 py-3 text-yellow-400 text-xs font-mono font-bold shadow-inner">
                      <template x-for="c in countries" :key="c.dial">
                        <option :value="c.dial" x-text="c.flag + ' ' + c.dial"></option>
                      </template>
                    </select>
                    <input type="tel" x-model="form.phoneOnly" required placeholder="5XX XXX XX XX" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-4 py-3 text-white text-sm font-mono shadow-inner">
                  </div>
                </div>
              </div>

              <div class="space-y-4">
                <div class="flex space-x-3">
                  <div class="w-1/2">
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('brand')">Marka</label>
                    <select x-model="form.brand" @change="form.model = ''; availableModels = carData[form.brand] || []" required class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3 py-3 text-white text-sm font-bold shadow-inner">
                      <option value="" disabled selected>Marka Seçin</option>
                      <template x-for="(models, brandName) in carData" :key="brandName"><option :value="brandName" x-text="brandName"></option></template>
                    </select>
                  </div>
                  <div class="w-1/2">
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('model')">Model</label>
                    <select x-model="form.model" required :disabled="!form.brand" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3 py-3 text-white text-sm font-bold disabled:opacity-40 shadow-inner">
                      <option value="" disabled selected>Önce Marka Seçin</option>
                      <template x-for="modelName in availableModels" :key="modelName"><option :value="modelName" x-text="modelName"></option></template>
                    </select>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('year')">Yıl</label>
                    <input type="number" x-model="form.year" required min="2000" max="2027" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3 py-3 text-white text-sm font-bold shadow-inner">
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('category')">Sınıf</label>
                    <select x-model="form.category" required class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-2 py-3 text-white text-sm font-bold shadow-inner">
                      <option value="Ekonomik">Ekonomik</option><option value="SUV">SUV</option><option value="Sedan">Sedan</option><option value="Lüks">Lüks</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('fuel')">Yakıt</label>
                    <select x-model="form.fuelType" required class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-2 py-3 text-white text-sm font-bold shadow-inner">
                      <option value="Benzin">Benzin</option><option value="Dizel">Dizel</option><option value="Hibrit">Hibrit</option><option value="Elektrik">Elektrik</option>
                    </select>
                  </div>
                </div>

                <div class="flex space-x-3">
                  <div class="w-1/3">
                    <label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" x-text="t('luggage')">Bavul</label>
                    <input type="number" x-model="form.luggageCapacity" required min="0" max="10" placeholder="Adet" class="w-full bg-[#1a1616] border border-stone-700 rounded-xl px-3 py-3 text-white text-sm font-bold shadow-inner">
                  </div>
                  <div class="w-2/3">
                    <label class="block text-[10px] font-black text-yellow-400 uppercase tracking-wider mb-1" x-text="t('dailyNetEarn')">Günlük Net Kazanç (Max 400 €)</label>
                    <div class="relative">
                      <span class="absolute left-3 top-3 text-yellow-400 font-black text-base" x-text="form.currency"></span>
                      <input type="number" x-model="form.supplierPrice" required min="1" max="400" placeholder="Max 400" class="w-full bg-[#1a1616] border-2 border-stone-700 rounded-xl pl-8 pr-3 py-3 text-white text-sm font-black focus:border-yellow-400 shadow-inner">
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div x-show="message" x-text="message" :class="isError ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'" class="p-3 rounded-xl border text-sm font-bold text-center shadow-sm"></div>
            
            <button type="submit" class="w-full gold-btn font-black py-4 rounded-xl shadow-lg transition-all"><i class="fa-solid fa-cloud-arrow-up mr-2"></i> <span x-text="t('saveAndPublish')">Aracı Sisteme Kaydet ve Listeme Ekle</span></button>
          </form>
        </div>

      </div>

    </main>

    <!-- SOL ALT "LIVE DESK" CANLI DESTEK MASASI -->
    <a href="https://wa.me/905342258858?text=Merhaba,%20FlexiDrive%20tedarikçi%20destek%20hattından%20ulaşıyorum." target="_blank" class="fixed bottom-6 left-6 z-50 flex items-center space-x-3 bg-[#141212]/95 backdrop-blur-md border-2 border-yellow-400 py-3 px-4 rounded-full shadow-2xl hover:scale-105 transition-transform group" title="Live Desk - Canlı Destek Masası">
      <div class="w-10 h-10 rounded-full gold-btn flex items-center justify-center text-lg text-white shadow-inner animate-pulse">
        <i class="fa-solid fa-headset"></i>
      </div>
      <div class="flex flex-col pr-2">
        <span class="text-[9px] font-extrabold text-yellow-400 uppercase tracking-widest leading-none">Live Desk</span>
        <span class="text-xs font-black text-white mt-0.5">Canlı Destek Masası</span>
      </div>
    </a>
  </div>

  <footer class="w-full py-6 text-center text-xs text-stone-500 border-t border-stone-900 bg-[#141212]/80 backdrop-blur-sm" x-text="t('footer')">
    Tüm Hakları Saklıdır © 2026 FlexiDrive Global OS. Kurumsal B2B Araç Kiralama Ekosistemi.
  </footer>

  <script>
    const TRANSLATIONS = {
      tr: { quickMenu: 'Hızlı Menü', fleet: 'Filo Operasyonları', suppliers: 'Tedarikçi Ağı', feed: 'Meta-Search Feed', supplierPortal: 'Tedarikçi Portalı', totalFleet: 'Toplam Filo', activeAvailable: 'Aktif / Müsait', dailyRevenue: 'Günlük Potansiyel Ciro', available: 'MÜSAİT', rented: 'KİRADA', netSale: 'Net / Satış:', published: 'Yayınlanma:', changeStatus: 'Durum Değiştir', removeCar: 'Aracı Kaldır', supplierReportTitle: 'Ülke Bazlı Tedarikçi Hacim Raporu', supplierReportSub: 'Ülkelere göre gruplanmış tedarikçi firmalarınız', metaTitle: 'Meta-Search Entegrasyon Merkezi', metaSub: 'Skyscanner ve Kayak gibi platformların envanterinizi çekeceği açık API adresi.', feedAddress: 'Resmi JSON Feed Bağlantı Adresi', copy: 'Kopyala', footer: 'Tüm Hakları Saklıdır © 2026 FlexiDrive Global OS.' },
      en: { quickMenu: 'Quick Menu', fleet: 'Fleet Operations', suppliers: 'Supplier Network', feed: 'Meta-Search Feed', supplierPortal: 'Supplier Portal', totalFleet: 'Total Fleet', activeAvailable: 'Active / Available', dailyRevenue: 'Daily Potential Revenue', available: 'AVAILABLE', rented: 'RENTED', netSale: 'Net / Sale:', published: 'Published:', changeStatus: 'Toggle Status', removeCar: 'Remove Car', supplierReportTitle: 'Country-Based Supplier Volume Report', supplierReportSub: 'Suppliers grouped by country', metaTitle: 'Meta-Search Integration Center', metaSub: 'Open API address for Skyscanner and Kayak.', feedAddress: 'Official JSON Feed Address', copy: 'Copy', footer: 'All Rights Reserved © 2026 FlexiDrive Global OS.' },
      de: { quickMenu: 'Schnellmenü', fleet: 'Flottenbetrieb', suppliers: 'Lieferantennetzwerk', feed: 'Meta-Search Feed', supplierPortal: 'Lieferantenportal', totalFleet: 'Gesamte Flotte', activeAvailable: 'Aktiv / Verfügbar', dailyRevenue: 'Ttäglicher Umsatz', available: 'VERFÜGBAR', rented: 'VERMIETET', netSale: 'Netto / Verkauf:', published: 'Veröffentlicht:', changeStatus: 'Status Ändern', removeCar: 'Fahrzeug Entfernen', supplierReportTitle: 'Länderbasieter Lieferantenbericht', supplierReportSub: 'Lieferanten nach Ländern gruppiert', metaTitle: 'Meta-Search Integrationszentrum', metaSub: 'Offene API-Adresse für Skyscanner und Kayak.', feedAddress: 'Offizielle JSON Feed Adresse', copy: 'Kopieren', footer: 'Alle Rechte vorbehalten © 2026 FlexiDrive Global OS.' },
      it: { quickMenu: 'Menu Rapido', fleet: 'Operazioni Flotta', suppliers: 'Rete Fornitori', feed: 'Meta-Search Feed', supplierPortal: 'Portale Fornitori', totalFleet: 'Flotta Totale', activeAvailable: 'Attivo / Disponibile', dailyRevenue: 'Potenziale Ricavo Giornaliero', available: 'DISPONIBILE', rented: 'AFFITTATO', netSale: 'Netto / Vendita:', published: 'Pubblicato:', changeStatus: 'Cambia Stato', removeCar: 'Rimuovi Auto', supplierReportTitle: 'Rapporto Fornitori per Paese', supplierReportSub: 'Fornitori raggruppati per paese', metaTitle: 'Centro Integrazione Meta-Search', metaSub: 'Indirizzo API aperto per Skyscanner e Kayak.', feedAddress: 'Indirizzo JSON Feed Ufficiale', copy: 'Copia', footer: 'Tutti i diritti riservati © 2026 FlexiDrive Global OS.' }
    };

    document.addEventListener('alpine:init', () => {
      Alpine.data('adminApp', () => ({
        isAdminLoggedIn: false,
        adminPasswordInput: '',
        adminLoginError: '',
        activeTab: 'admin',
        cars: [],
        supplierUsers: [],
        selectedCar: null,
        selectedTaxSupplier: null,
        currentLang: 'tr',
        windowOrigin: window.location.origin,
        async init() {
          const isAuth = localStorage.getItem('flexi_admin_auth');
          if (isAuth === 'true') {
            this.isAdminLoggedIn = true;
            await this.fetchCars();
            await this.fetchSupplierDetails();
          }
        },
        async loginAdmin() {
          this.adminLoginError = '';
          if (this.adminPasswordInput.trim() === 'eren2026') {
            this.isAdminLoggedIn = true;
            localStorage.setItem('flexi_admin_auth', 'true');
            await this.fetchCars();
            await this.fetchSupplierDetails();
          } else {
            this.adminLoginError = 'Hatalı Admin Şifresi!';
          }
        },
        logoutAdmin() {
          localStorage.removeItem('flexi_admin_auth');
          this.isAdminLoggedIn = false;
          this.adminPasswordInput = '';
        },
        openCarDetails(car) {
          this.selectedCar = car;
        },
        openTaxDetails(supplier) {
          const found = this.supplierUsers.find(u => u.companyName && u.companyName.trim().toLowerCase() === supplier.name.trim().toLowerCase());
          this.selectedTaxSupplier = {
            ...supplier,
            taxNumber: found ? (found.taxNumber || 'TR9876543210') : 'TR9876543210',
            taxOffice: found ? (found.taxOffice || 'Merkez Kurumsal VD') : 'Merkez Kurumsal VD',
            address: found ? (found.address || 'Global Ticaret Merkezi, No: 42') : 'Global Ticaret Merkezi, No: 42'
          };
        },
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
        async fetchSupplierDetails() {
          try {
            const res = await fetch('/api/suppliers/details');
            this.supplierUsers = await res.json();
          } catch (err) {}
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
          const flags = { 'Almanya': '🇩🇪', 'İtalya': '🇮🇹', 'Yunanistan': '🇬🇷', 'Hırvatistan': '🇭🇷', 'Karadağ': '🇲🇪', 'Türkiye': '🇹🇷', 'Sırbistan': '🇷🇸', 'Arnavutluk': '🇦🇱', 'Bosna Hersek': '🇧🇦', 'Bulgaristan': '🇧🇬', 'Kuzey Makedonya': '🇲🇰', 'Fransa': '🇫🇷', 'İspanya': '🇪🇸', 'Avusturya': '🇦🇹', 'İsviçre': '🇨🇭', 'Hollanda': '🇳🇱' };
          return flags[country] || '🏳️';
        },
        get groupedSuppliersByCountry() {
          const countryMap = new Map();
          this.cars.forEach(c => {
            if (!c.supplierName || !c.country) return;
            const countryKey = c.country.taxNumber || c.country.trim(); // safe guard
            const actualCountry = c.country.trim();
            if (!countryMap.has(actualCountry)) {
              countryMap.set(actualCountry, { country: actualCountry, flag: this.getFlag(actualCountry), suppliersMap: new Map(), totalCars: 0 });
            }
            const countryGroup = countryMap.get(actualCountry);
            countryGroup.totalCars++;
            const supKey = c.supplierName.trim().toLowerCase();
            if (!countryGroup.suppliersMap.has(supKey)) {
              countryGroup.suppliersMap.set(supKey, { name: c.supplierName.trim(), contact: c.supplierContact, carCount: 0, activeCars: 0 });
            }
            const supObj = countryGroup.suppliersMap.get(supKey);
            supObj.carCount++;
            if (c.available) {
              supObj.activeCars++;
            }
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

app.listen(PORT, () => {
  console.log(`FlexiDrive Red & Gold Edition sunucusu http://localhost:${PORT} adresinde aktif!`);
});
