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
      address: 'Merkez Ticaret Merkezi, Kat: 5, ' + companyName
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

    res.json({ success: true, companyName: user.companyName, fullName: user.fullName, email: user.email });
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

// 4. ADMIN HQ (Dark Beige Edition)
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr" class="h-full" style="background-color: #12100e;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexiDrive Admin HQ | Dark Beige Edition</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #12100e; color: #f7f4ee; }
    [x-cloak] { display: none !important; }
    .coke-red { background: linear-gradient(135deg, #f40009 0%, #a80005 100%); }
    .beige-border { border-color: rgba(216, 195, 165, 0.35); }
    .beige-badge { background: linear-gradient(135deg, rgba(216, 195, 165, 0.25), rgba(184, 159, 120, 0.15)); color: #e6d5bc; border: 1px solid rgba(216, 195, 165, 0.45); }
    .beige-btn { background: linear-gradient(135deg, #d8c3a5 0%, #b89f78 100%); color: #1c1815; box-shadow: 0 10px 25px -5px rgba(216, 195, 165, 0.3); font-weight: 800; }
    .beige-btn:hover { background: linear-gradient(135deg, #e8d8c8 0%, #c8ae88 100%); }
    .glass-card { background: rgba(26, 23, 21, 0.92); backdrop-filter: blur(16px); border: 1px solid rgba(216, 195, 165, 0.3); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6); }
    @keyframes pulse-beige {
      0% { box-shadow: 0 0 0 0 rgba(216, 195, 165, 0.8); }
      70% { box-shadow: 0 0 0 12px rgba(216, 195, 165, 0); }
      100% { box-shadow: 0 0 0 0 rgba(216, 195, 165, 0); }
    }
    .led-beige { width: 12px; height: 12px; background-color: #d8c3a5; border-radius: 50%; display: inline-block; animation: pulse-beige 2s infinite; }
    .scrollable-nav { overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
    .scrollable-nav::-webkit-scrollbar { display: none; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #1c1815; border-radius: 4px; }
    ::-webkit-scrollbar-thumb { background: #d8c3a5; border-radius: 4px; }
  </style>
</head>
<body class="h-full flex flex-col justify-between" x-data="adminApp()">

  <div x-show="!isAdminLoggedIn" class="fixed inset-0 z-50 flex items-center justify-center bg-[#12100e] p-4">
    <div class="max-w-md w-full glass-card rounded-3xl p-8 shadow-2xl text-center border beige-border">
      <div class="w-16 h-16 coke-red text-white rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg border border-red-400/40"><i class="fa-solid fa-crown text-[#e6d5bc]"></i></div>
      <h2 class="text-2xl font-black text-white mb-2" x-text="t('adminLoginTitle')">FlexiDrive Admin HQ</h2>
      <p class="text-xs font-semibold text-stone-400 mb-6" x-text="t('adminLoginSub')">Yönetici paneline erişmek için admin şifrenizi girin.</p>
      
      <form @submit.prevent="loginAdmin()" class="space-y-4">
        <input type="password" autocomplete="current-password" x-model="adminPasswordInput" required placeholder="Admin Şifresi (eren2026)" class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-4 py-3 text-white text-sm text-center font-bold focus:outline-none focus:border-[#d8c3a5] shadow-inner">
        <div x-show="adminLoginError" x-text="adminLoginError" class="text-xs font-bold text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/30"></div>
        <button type="submit" class="w-full beige-btn font-extrabold py-3.5 rounded-xl shadow-lg transition-all text-sm" x-text="t('adminLoginBtn')">Güvenli Giriş Yap</button>
      </form>
    </div>
  </div>

  <div x-show="isAdminLoggedIn" x-cloak class="flex-1 flex flex-col justify-between">
    <header class="bg-[#181513]/95 backdrop-blur-md border-b beige-border sticky top-0 z-40 shadow-2xl">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        <div class="flex items-center space-x-4">
          <div class="relative" x-data="{ menuOpen: false }">
            <div @click="menuOpen = !menuOpen" class="flex items-center space-x-3 cursor-pointer group" title="Ana Menü">
              <div class="w-12 h-12 rounded-2xl coke-red flex items-center justify-center font-black text-xl text-white shadow-lg group-hover:scale-105 transition-transform border border-red-400/40">
                <i class="fa-solid fa-route text-[#e6d5bc]"></i>
              </div>
              <div>
                <span class="text-2xl font-black tracking-tight text-white">FlexiDrive</span> 
                <span class="text-[9px] font-extrabold beige-badge px-2.5 py-0.5 rounded-full ml-1 uppercase tracking-widest">Admin HQ</span>
              </div>
            </div>

            <div x-show="menuOpen" @click.outside="menuOpen = false" x-cloak class="absolute left-0 mt-3 w-60 bg-[#181513] border beige-border rounded-2xl shadow-2xl py-2 z-50 text-xs font-bold text-stone-200">
              <div class="px-4 py-2 border-b border-stone-800 text-[10px] text-[#e6d5bc] uppercase tracking-widest font-black">Hızlı Menü</div>
              <a href="#" @click="activeTab = 'admin'; menuOpen = false" class="flex items-center px-4 py-3 hover:bg-stone-800 transition-all"><i class="fa-solid fa-car text-[#d8c3a5] mr-3 text-sm"></i> Filo Operasyonları</a>
              <a href="#" @click="activeTab = 'partners'; menuOpen = false" class="flex items-center px-4 py-3 hover:bg-stone-800 transition-all"><i class="fa-solid fa-earth-europe text-[#d8c3a5] mr-3 text-sm"></i> Tedarikçi Ağı</a>
              <a href="#" @click="activeTab = 'integrations'; menuOpen = false" class="flex items-center px-4 py-3 hover:bg-stone-800 transition-all"><i class="fa-solid fa-network-wired text-[#d8c3a5] mr-3 text-sm"></i> Meta-Search Feed</a>
              <div class="border-t border-stone-800 my-1"></div>
              <a href="/tedarikci-paneli" target="_blank" class="flex items-center px-4 py-3 text-emerald-400 hover:bg-stone-800 transition-all"><i class="fa-solid fa-external-link-alt mr-3 text-sm"></i> Tedarikçi Portalı</a>
            </div>
          </div>
        </div>

        <div class="scrollable-nav flex items-center space-x-2 py-2">
          <button @click="activeTab = 'admin'" :class="activeTab === 'admin' ? 'beige-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center">
            <i class="fa-solid fa-car mr-2"></i> Filo Operasyonları
          </button>
          <button @click="activeTab = 'partners'" :class="activeTab === 'partners' ? 'beige-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center">
            <i class="fa-solid fa-earth-europe mr-2"></i> Tedarikçi Ağı
          </button>
          <button @click="activeTab = 'integrations'" :class="activeTab === 'integrations' ? 'beige-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center">
            <i class="fa-solid fa-network-wired mr-2"></i> Meta-Search Feed
          </button>
          <a href="/tedarikci-paneli" target="_blank" class="beige-badge hover:opacity-90 px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all inline-flex items-center shadow-sm">
            <i class="fa-solid fa-external-link-alt mr-2"></i> Tedarikçi Portalı
          </a>

          <button @click="logoutAdmin()" class="text-rose-400 hover:bg-rose-500/10 p-2.5 rounded-xl text-xs transition-all ml-1 border border-rose-500/30 inline-flex items-center shadow-sm" title="Çıkış Yap"><i class="fa-solid fa-right-from-bracket text-base"></i></button>
        </div>

      </div>
    </header>

    <main class="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div x-show="activeTab === 'admin'" x-transition>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div class="glass-card p-6 rounded-3xl shadow-xl flex justify-between items-center"><div><p class="text-xs font-bold text-stone-400 uppercase tracking-wider">Toplam Filo</p><h3 class="text-3xl font-black mt-1 text-white" x-text="cars.length">0</h3></div><div class="text-[#d8c3a5] text-3xl"><i class="fa-solid fa-car"></i></div></div>
          
          <div class="glass-card p-6 rounded-3xl shadow-xl flex justify-between items-center">
            <div>
              <div class="flex items-center space-x-2">
                <p class="text-xs font-bold text-stone-400 uppercase tracking-wider">Aktif / Müsait</p>
                <span class="led-beige" title="Bej Statü LED"></span>
              </div>
              <h3 class="text-3xl font-black mt-1 text-emerald-400" x-text="cars.filter(c => c.available).length">0</h3>
            </div>
            <div class="text-emerald-400 text-3xl"><i class="fa-solid fa-circle-check"></i></div>
          </div>

          <div class="glass-card p-6 rounded-3xl shadow-xl flex justify-between items-center overflow-hidden">
            <div>
              <p class="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Günlük Potansiyel Ciro</p>
              <div class="flex flex-col space-y-1">
                <template x-for="(val, cur) in totalProfits" :key="cur"><span class="text-lg font-black text-[#d8c3a5] leading-none" x-text="val + ' ' + cur"></span></template>
                <span x-show="Object.keys(totalProfits).length === 0" class="text-lg font-black text-stone-500">0 €</span>
              </div>
            </div>
            <div class="text-[#d8c3a5] text-3xl"><i class="fa-solid fa-wallet"></i></div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <template x-for="car in cars" :key="car._id">
            <div @click="openCarDetails(car)" class="glass-card border beige-border rounded-3xl p-6 flex flex-col justify-between shadow-xl hover:border-[#d8c3a5] hover:scale-[1.02] cursor-pointer transition-all">
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div>
                    <span class="text-[9px] font-black px-2.5 py-0.5 rounded-full beige-badge uppercase" x-text="car.category"></span>
                    <h4 class="text-base font-extrabold text-white mt-1" x-text="car.brand + ' ' + car.model"></h4>
                  </div>
                  <span :class="car.available ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'" class="px-2.5 py-1 rounded-lg text-[10px] font-black border shadow-sm" x-text="car.available ? 'MÜSAİT' : 'KİRADA'"></span>
                </div>
                <p class="text-xs font-semibold text-stone-300 mt-1"><i class="fa-solid fa-building text-[#d8c3a5] mr-1"></i> <span x-text="car.supplierName"></span> (<span x-text="car.country"></span>)</p>
                
                <div class="bg-[#141211] p-3 rounded-2xl my-4 text-xs space-y-1.5 border border-stone-800 shadow-inner text-stone-200">
                  <div class="flex justify-between"><span class="text-stone-400 font-medium">Net / Satış:</span><span class="font-extrabold text-[#d8c3a5]" x-text="(car.supplierPrice || 0) + '€ / ' + (car.customerPrice || 0) + '€'"></span></div>
                  <div class="flex justify-between"><span class="text-stone-400 font-medium">Yayınlanma:</span><span class="font-extrabold text-stone-200" x-text="new Date(car.createdAt).toLocaleString('tr-TR')"></span></div>
                </div>
              </div>
              
              <div class="pt-4 border-t border-stone-800 flex justify-between items-center text-xs" @click.stop>
                <button @click="toggleStatus(car._id)" class="bg-stone-800 hover:bg-stone-700 text-stone-200 px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm">Durum Değiştir</button>
                <button @click="deleteCar(car._id)" class="bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm"><i class="fa-solid fa-trash-can mr-1"></i> Aracı Kaldır</button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div x-show="activeTab === 'partners'" x-cloak x-transition>
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-xl font-extrabold text-white">Ülke Bazlı Tedarikçi Hacim Raporu</h2>
            <p class="text-xs font-semibold text-stone-400 mt-1">Ülkelere göre gruplanmış tedarikçi firmalarınız</p>
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
                      <p class="text-xs font-semibold text-stone-400"><strong class="text-[#d8c3a5]" x-text="group.suppliers.length"></strong> Firma / <strong class="text-emerald-400" x-text="group.totalCars"></strong> Araç Hacmi</p>
                    </div>
                  </div>
                </div>
                <div class="space-y-3 max-h-96 overflow-y-auto pr-2">
                  <template x-for="supplier in group.suppliers" :key="supplier.name">
                    <div class="bg-[#141211] border border-stone-800 rounded-2xl p-4 flex justify-between items-center text-stone-200">
                      <div>
                        <h4 class="text-sm font-bold text-white" x-text="supplier.name"></h4>
                        <button @click="openTaxDetails(supplier)" class="text-xs font-semibold text-[#d8c3a5] hover:text-[#e8d8c8] mt-1 inline-flex items-center transition-colors text-left" title="Vergi ve Mali İşlemleri Görüntüle">
                          <i class="fa-solid fa-phone text-emerald-400 mr-1.5"></i> <span class="font-mono underline" x-text="supplier.contact"></span>
                          <span class="ml-2 text-[9px] beige-badge px-2.5 py-0.5 rounded-full shadow-sm"><i class="fa-solid fa-file-invoice-dollar mr-1"></i> Vergi Dosyası</span>
                        </button>
                      </div>
                      <div class="flex items-center space-x-2">
                        <div class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center shadow-inner">
                          <i class="fa-solid fa-circle-check mr-1 text-[9px]"></i> <span x-text="supplier.activeCars"></span> Aktif
                        </div>
                        <span class="beige-badge text-xs font-extrabold px-3 py-1 rounded-full shadow-sm" x-text="supplier.carCount + ' Araç'"></span>
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
            <div class="beige-btn p-3 rounded-2xl flex items-center justify-center text-xl shadow"><i class="fa-solid fa-satellite-dish"></i></div>
            <div>
              <h2 class="text-xl font-black text-white">Meta-Search Entegrasyon Merkezi</h2>
              <p class="text-xs font-semibold text-stone-400">Skyscanner ve Kayak gibi platformların envanterinizi çekeceği açık API adresi.</p>
            </div>
          </div>
          <div class="bg-[#141211] p-6 rounded-2xl border border-stone-800 space-y-2 shadow-inner">
            <span class="text-xs font-bold text-stone-300 uppercase tracking-wider block">Resmi JSON Feed Bağlantı Adresi</span>
            <div class="flex space-x-2">
              <input type="text" readonly :value="windowOrigin + '/api/feed/global-inventory'" class="w-full bg-[#0d0d0d] border border-stone-700 rounded-xl px-4 py-3 text-xs text-[#d8c3a5] font-mono font-bold focus:outline-none">
              <button @click="navigator.clipboard.writeText(windowOrigin + '/api/feed/global-inventory'); alert('URL kopyalandı!')" class="beige-btn font-extrabold px-5 py-3 rounded-xl text-xs whitespace-nowrap shadow">Kopyala</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <script>
    function adminApp() {
      return {
        isAdminLoggedIn: localStorage.getItem('flexi_admin_logged') === 'true',
        adminPasswordInput: '',
        adminLoginError: '',
        activeTab: 'admin',
        cars: [],
        selectedCar: null,
        selectedTaxSupplier: null,
        windowOrigin: window.location.origin,
        async init() {
          if (this.isAdminLoggedIn) { await this.fetchCars(); }
        },
        loginAdmin() {
          if (this.adminPasswordInput === 'eren2026') {
            localStorage.setItem('flexi_admin_logged', 'true');
            this.isAdminLoggedIn = true;
            this.adminLoginError = '';
            this.fetchCars();
          } else {
            this.adminLoginError = 'Hatalı admin şifresi!';
          }
        },
        logoutAdmin() {
          localStorage.removeItem('flexi_admin_logged');
          this.isAdminLoggedIn = false;
          this.adminPasswordInput = '';
        },
        async fetchCars() {
          try {
            const res = await fetch('/api/cars');
            this.cars = await res.json();
          } catch (err) {}
        },
        get totalProfits() {
          const map = {};
          this.cars.filter(c => c.available).forEach(c => {
            const cur = c.currency || '€';
            map[cur] = (map[cur] || 0) + (c.supplierPrice || 0);
          });
          return map;
        },
        get groupedSuppliersByCountry() {
          const countryMap = {};
          const countriesMeta = [
            { name: 'Almanya', flag: '🇩🇪' }, { name: 'İtalya', flag: '🇮🇹' }, { name: 'Yunanistan', flag: '🇬🇷' },
            { name: 'Hırvatistan', flag: '🇭🇷' }, { name: 'Karadağ', flag: '🇲🇪' }, { name: 'Türkiye', flag: '🇹🇷' },
            { name: 'Sırbistan', flag: '🇷🇸' }, { name: 'Arnavutluk', flag: '🇦🇱' }, { name: 'Bosna Hersek', flag: '🇧🇦' },
            { name: 'Bulgaristan', flag: '🇧🇬' }, { name: 'Kuzey Makedonya', flag: '🇲🇰' }, { name: 'Fransa', flag: '🇫🇷' },
            { name: 'İspanya', flag: '🇪🇸' }, { name: 'Avusturya', flag: '🇦🇹' }, { name: 'İsviçre', flag: '🇨🇭' }, { name: 'Hollanda', flag: '🇳🇱' }
          ];

          countriesMeta.forEach(cm => {
            countryMap[cm.name] = { country: cm.name, flag: cm.flag, suppliersMap: {} };
          });

          this.cars.forEach(car => {
            const cName = car.country || 'Türkiye';
            if (!countryMap[cName]) {
              countryMap[cName] = { country: cName, flag: '🌍', suppliersMap: {} };
            }
            const sName = car.supplierName || 'Bilinmeyen Firma';
            if (!countryMap[cName].suppliersMap[sName]) {
              countryMap[cName].suppliersMap[sName] = { name: sName, contact: car.supplierContact || '+90 500 000 0000', carCount: 0, activeCars: 0 };
            }
            countryMap[cName].suppliersMap[sName].carCount++;
            if (car.available) countryMap[cName].suppliersMap[sName].activeCars++;
          });

          const result = [];
          for (const cKey in countryMap) {
            const supArr = Object.values(countryMap[cKey].suppliersMap);
            if (supArr.length > 0) {
              const totalCars = supArr.reduce((acc, s) => acc + s.carCount, 0);
              result.push({ country: countryMap[cKey].country, flag: countryMap[cKey].flag, suppliers: supArr, totalCars });
            }
          }
          return result;
        },
        openCarDetails(car) { this.selectedCar = car; },
        openTaxDetails(supplier) { this.selectedTaxSupplier = supplier; },
        async toggleStatus(id) {
          await fetch('/api/cars/' + id + '/status', { method: 'PATCH' });
          await this.fetchCars();
        },
        async deleteCar(id) {
          if (confirm('Bu aracı sistemden kaldırmak istediğinize emin misiniz?')) {
            await fetch('/api/cars/' + id, { method: 'DELETE' });
            await this.fetchCars();
          }
        }
      }
    }
  </script>
</body>
</html>`);
});

// 5. TEDARİKÇİ PORTALI (/tedarikci-paneli - Porsche Arka Planlı + Koyu Bej Tema)
app.get('/tedarikci-paneli', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexiDrive Tedarikçi Portalı | Dark Beige Edition</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { 
      font-family: 'Plus Jakarta Sans', sans-serif; 
      color: #f7f4ee; 
      background: linear-gradient(to bottom, rgba(14, 12, 11, 0.82), rgba(22, 19, 17, 0.94)), 
                  url('https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=1920&q=80');
      background-size: cover;
      background-position: center;
      background-attachment: fixed;
    }
    [x-cloak] { display: none !important; }
    .coke-red { background: linear-gradient(135deg, #f40009 0%, #a80005 100%); }
    .beige-border { border-color: rgba(216, 195, 165, 0.45); }
    .beige-badge { background: linear-gradient(135deg, rgba(216, 195, 165, 0.25), rgba(184, 159, 120, 0.15)); color: #e6d5bc; border: 1px solid rgba(216, 195, 165, 0.5); }
    .beige-btn { background: linear-gradient(135deg, #d8c3a5 0%, #b89f78 100%); color: #1c1815; box-shadow: 0 10px 25px -5px rgba(216, 195, 165, 0.4); font-weight: 800; }
    .beige-btn:hover { background: linear-gradient(135deg, #e8d8c8 0%, #c8ae88 100%); }
    .glass-card { background: rgba(26, 23, 21, 0.94); backdrop-filter: blur(16px); border: 1px solid rgba(216, 195, 165, 0.4); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); }
    .car-card-bg {
      background-image: linear-gradient(to bottom, rgba(26, 23, 21, 0.96), rgba(26, 23, 21, 0.99)), url('https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80');
      background-size: cover;
      background-position: center;
    }
    .scrollable-nav { overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
    .scrollable-nav::-webkit-scrollbar { display: none; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #181513; border-radius: 4px; }
    ::-webkit-scrollbar-thumb { background: #d8c3a5; border-radius: 4px; }
    select {
      appearance: none;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23d8c3a5' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      background-size: 1.1em;
      padding-right: 2.2rem !important;
    }
  </style>
</head>
<body class="h-full flex flex-col justify-between" x-data="supplierPortal()">

  <div x-show="!isLoggedIn" class="fixed inset-0 z-50 flex items-center justify-center bg-[#12100e]/95 backdrop-blur-md p-4 overflow-y-auto">
    <div class="max-w-md w-full glass-card rounded-3xl p-8 shadow-2xl border beige-border my-8">
      <div class="w-16 h-16 coke-red text-white rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg border border-red-400/40"><i class="fa-solid fa-handshake text-[#e6d5bc]"></i></div>
      
      <div class="flex rounded-2xl bg-[#141211] p-1.5 mb-6 border border-stone-800">
        <button @click="authMode = 'login'" :class="authMode === 'login' ? 'beige-btn shadow' : 'text-stone-400 hover:text-white'" class="flex-1 py-2.5 rounded-xl font-bold text-xs transition-all">Giriş Yap</button>
        <button @click="authMode = 'register'" :class="authMode === 'register' ? 'beige-btn shadow' : 'text-stone-400 hover:text-white'" class="flex-1 py-2.5 rounded-xl font-bold text-xs transition-all">Hesap Oluştur</button>
      </div>

      <div x-show="authMode === 'login'" x-transition>
        <h2 class="text-xl font-black text-white mb-1 text-center">Tedarikçi Girişi</h2>
        <p class="text-xs font-semibold text-stone-400 mb-6 text-center">Kayıtlı e-posta adresinizle giriş yapın.</p>
        
        <form @submit.prevent="loginSupplier()" class="space-y-4">
          <div>
            <label class="block text-[10px] font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">E-Posta Adresi</label>
            <input type="email" x-model="loginEmail" required placeholder="ornek@sirket.com" class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-4 py-3 text-white text-xs font-bold focus:outline-none focus:border-[#d8c3a5] shadow-inner">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">Şifre</label>
            <input type="password" x-model="loginPassword" required placeholder="••••••••" class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-4 py-3 text-white text-xs font-bold focus:outline-none focus:border-[#d8c3a5] shadow-inner">
          </div>
          <div x-show="loginError" x-text="loginError" class="text-xs font-bold text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/30 text-center"></div>
          <button type="submit" class="w-full beige-btn font-extrabold py-3.5 rounded-xl shadow-lg transition-all text-xs">Giriş Yap</button>
        </form>
      </div>

      <div x-show="authMode === 'register'" x-cloak x-transition>
        <h2 class="text-xl font-black text-white mb-1 text-center">Yeni Tedarikçi Hesabı</h2>
        <p class="text-xs font-semibold text-stone-400 mb-6 text-center">Bilgilerinizi girerek anında hesabınızı oluşturun.</p>
        
        <form @submit.prevent="registerSupplier()" class="space-y-3">
          <div>
            <label class="block text-[10px] font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">Ad Soyad</label>
            <input type="text" x-model="regForm.fullName" required placeholder="Eren Evren Barış" class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold focus:outline-none focus:border-[#d8c3a5] shadow-inner">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">Firma Adı (Rent a Car / Şirket)</label>
            <input type="text" x-model="regForm.companyName" required placeholder="Barış Rent a Car" class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold focus:outline-none focus:border-[#d8c3a5] shadow-inner">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">E-Posta Adresi</label>
            <input type="email" x-model="regForm.email" required placeholder="eren@barisrentacar.com" class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold focus:outline-none focus:border-[#d8c3a5] shadow-inner">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">Şifre</label>
            <input type="password" x-model="regForm.password" required placeholder="••••••••" class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold focus:outline-none focus:border-[#d8c3a5] shadow-inner">
          </div>
          <div x-show="regMessage" x-text="regMessage" :class="isRegError ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'" class="text-xs font-bold p-2.5 rounded-lg border text-center"></div>
          <button type="submit" class="w-full beige-btn font-extrabold py-3.5 rounded-xl shadow-lg transition-all text-xs mt-2">Hesabımı Oluştur</button>
        </form>
      </div>
    </div>
  </div>

  <div x-show="isLoggedIn" x-cloak class="flex-1 flex flex-col justify-between">
    <header class="bg-[#181513]/95 backdrop-blur-md border-b beige-border sticky top-0 z-40 shadow-2xl">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        <div class="flex items-center space-x-3">
          <div class="w-12 h-12 rounded-2xl coke-red flex items-center justify-center font-black text-xl text-white shadow-lg border border-red-400/40">
            <i class="fa-solid fa-car-side text-[#e6d5bc]"></i>
          </div>
          <div>
            <span class="text-xl font-black tracking-tight text-white" x-text="companyName"></span> 
            <span class="text-[9px] font-extrabold beige-badge px-2.5 py-0.5 rounded-full ml-1 uppercase tracking-widest">Tedarikçi</span>
          </div>
        </div>

        <div class="scrollable-nav flex items-center space-x-2 py-2">
          <button @click="activeTab = 'cars'" :class="activeTab === 'cars' ? 'beige-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center">
            <i class="fa-solid fa-car mr-2"></i> Araçlarım
          </button>
          <button @click="activeTab = 'add'" :class="activeTab === 'add' ? 'beige-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center">
            <i class="fa-solid fa-plus-circle mr-2"></i> Yeni Araç Ekle
          </button>
          <button @click="activeTab = 'wallet'" :class="activeTab === 'wallet' ? 'beige-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center">
            <i class="fa-solid fa-wallet mr-2"></i> Hesap Özeti
          </button>
          <button @click="activeTab = 'loyalty'" :class="activeTab === 'loyalty' ? 'beige-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center">
            <i class="fa-solid fa-award mr-2"></i> Sadakat Primi
          </button>
          <button @click="activeTab = 'stats'" :class="activeTab === 'stats' ? 'beige-btn shadow-md' : 'text-stone-300 hover:bg-stone-800'" class="px-4 py-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center">
            <i class="fa-solid fa-chart-line mr-2"></i> İstatistikler
          </button>

          <button @click="logout()" class="text-rose-400 hover:bg-rose-500/10 p-2.5 rounded-xl text-xs transition-all ml-1 border border-rose-500/30 inline-flex items-center shadow-sm" title="Çıkış Yap"><i class="fa-solid fa-right-from-bracket text-base"></i></button>
        </div>

      </div>
    </header>

    <main class="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div x-show="activeTab === 'cars'" x-transition>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div class="glass-card p-6 rounded-3xl shadow-xl flex justify-between items-center"><div><p class="text-xs font-bold text-stone-400 uppercase tracking-wider">Toplam Araç</p><h3 class="text-3xl font-black mt-1 text-white" x-text="cars.length">0</h3></div><div class="text-[#d8c3a5] text-3xl"><i class="fa-solid fa-car"></i></div></div>
          
          <div class="glass-card p-6 rounded-3xl shadow-xl flex justify-between items-center">
            <div>
              <div class="flex items-center space-x-2">
                <p class="text-xs font-bold text-stone-400 uppercase tracking-wider">Müsait Araç</p>
                <span class="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"></span>
              </div>
              <h3 class="text-3xl font-black mt-1 text-emerald-400" x-text="cars.filter(c => c.available).length">0</h3>
            </div>
            <div class="text-emerald-400 text-3xl"><i class="fa-solid fa-circle-check"></i></div>
          </div>

          <div class="glass-card p-6 rounded-3xl shadow-xl flex justify-between items-center">
            <div>
              <p class="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Günlük Net Kazanç</p>
              <h3 class="text-2xl font-black text-[#d8c3a5]" x-text="totalSupplierEarnings + ' €'">0 €</h3>
            </div>
            <div class="text-[#d8c3a5] text-3xl"><i class="fa-solid fa-wallet"></i></div>
          </div>
        </div>

        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-extrabold text-white">Sistemdeki Araçlarım</h2>
          <button @click="activeTab = 'add'" class="beige-btn font-extrabold px-5 py-3 rounded-xl text-xs shadow-lg inline-flex items-center"><i class="fa-solid fa-plus mr-2"></i> Yeni Araç Ekle</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <template x-for="car in cars" :key="car._id">
            <div class="car-card-bg border beige-border rounded-3xl p-6 flex flex-col justify-between shadow-xl">
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div>
                    <span class="text-[9px] font-black px-2.5 py-0.5 rounded-full beige-badge uppercase" x-text="car.category"></span>
                    <h4 class="text-base font-extrabold text-white mt-1" x-text="car.brand + ' ' + car.model"></h4>
                  </div>
                  <span :class="car.available ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'" class="px-2.5 py-1 rounded-lg text-[10px] font-black border shadow-sm" x-text="car.available ? 'MÜSAİT' : 'KİRADA'"></span>
                </div>
                <p class="text-xs font-semibold text-stone-300 mt-1"><i class="fa-solid fa-map-pin text-[#d8c3a5] mr-1"></i> <span x-text="car.country + ' - ' + car.airports"></span></p>
                
                <div class="bg-[#141211] p-3 rounded-2xl my-4 text-xs space-y-1.5 border border-stone-800 shadow-inner text-stone-200">
                  <div class="flex justify-between"><span class="text-stone-400 font-medium">Net / Satış:</span><span class="font-extrabold text-[#d8c3a5]" x-text="car.supplierPrice + '€ / ' + car.customerPrice + '€'"></span></div>
                  <div class="flex justify-between"><span class="text-stone-400 font-medium">Yayınlanma:</span><span class="font-extrabold text-stone-200" x-text="new Date(car.createdAt).toLocaleDateString('tr-TR')"></span></div>
                </div>
              </div>
              
              <div class="pt-4 border-t border-stone-800 flex justify-between items-center text-xs">
                <button @click="toggleMyCarStatus(car._id)" class="w-full bg-stone-800 hover:bg-stone-700 text-stone-200 py-2.5 rounded-xl font-bold transition-all shadow-sm text-center">Durum Değiştir</button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div x-show="activeTab === 'add'" x-cloak x-transition>
        <div class="max-w-2xl mx-auto glass-card rounded-3xl p-8 shadow-2xl border beige-border">
          <div class="flex items-center space-x-3 mb-6 pb-4 border-b border-stone-800">
            <div class="w-12 h-12 rounded-2xl beige-btn flex items-center justify-center text-xl text-[#1c1815] shadow"><i class="fa-solid fa-car-side"></i></div>
            <div>
              <h2 class="text-xl font-black text-white">Filoya Yeni Araç Ekle</h2>
              <p class="text-xs font-semibold text-stone-400">Firma adınız otomatik eşleştirilmektedir: <strong class="text-[#d8c3a5]" x-text="companyName"></strong></p>
            </div>
          </div>

          <form @submit.prevent="submitCar()" class="space-y-4 text-xs">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">Ülke Seçimi</label>
                <select x-model="form.country" @change="updateCountryData($event.target.value)" required class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-[#d8c3a5] shadow-inner">
                  <option value="">Ülke Seçin</option>
                  <template x-for="c in countries" :key="c.name"><option :value="c.name" x-text="c.flag + ' ' + c.name"></option></template>
                </select>
              </div>
              <div>
                <label class="block font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">Havalimanı / Teslim Noktası</label>
                <select x-model="form.airports" required class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-[#d8c3a5] shadow-inner">
                  <option value="">Önce Ülke Seçin</option>
                  <template x-for="a in availableAirports" :key="a"><option :value="a" x-text="a"></option></template>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">Panel Şifreniz (Güvenlik)</label>
                <input type="password" x-model="form.supplierPassword" required placeholder="flexi2026" class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-[#d8c3a5] shadow-inner">
              </div>
              <div>
                <label class="block font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">İletişim Numarası (Telefon)</label>
                <div class="flex space-x-2">
                  <input type="text" readonly x-model="form.selectedDial" class="w-20 bg-[#0d0d0d] border border-[#d8c3a5]/50 rounded-xl px-3 py-3 text-[#d8c3a5] text-center font-bold">
                  <input type="text" x-model="form.phoneOnly" required placeholder="532 000 0000" class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-[#d8c3a5] shadow-inner">
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">Marka</label>
                <select x-model="form.brand" @change="availableModels = carData[$event.target.value] || []" required class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-[#d8c3a5] shadow-inner">
                  <option value="">Marka Seçin</option>
                  <template x-for="(mods, bName) in carData" :key="bName"><option :value="bName" x-text="bName"></option></template>
                </select>
              </div>
              <div>
                <label class="block font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">Model</label>
                <select x-model="form.model" required class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-[#d8c3a5] shadow-inner">
                  <option value="">Önce Marka Seçin</option>
                  <template x-for="mName in availableModels" :key="mName"><option :value="mName" x-text="mName"></option></template>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-4 gap-3">
              <div>
                <label class="block font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">Sınıf</label>
                <select x-model="form.category" class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-3 py-3 text-white font-bold focus:outline-none">
                  <option value="Ekonomik">Ekonomik</option><option value="SUV">SUV</option><option value="Lüks">Lüks</option><option value="VIP Minibüs">VIP Minibüs</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">Yakıt</label>
                <select x-model="form.fuelType" class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-3 py-3 text-white font-bold focus:outline-none">
                  <option value="Benzin">Benzin</option><option value="Dizel">Dizel</option><option value="Hybrid">Hybrid</option><option value="Elektrik">Elektrik</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">Yıl</label>
                <input type="number" x-model="form.year" class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-3 py-3 text-white font-bold text-center">
              </div>
              <div>
                <label class="block font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">Bavul</label>
                <input type="number" x-model="form.luggageCapacity" class="w-full bg-[#141211] border border-[#d8c3a5]/50 rounded-xl px-3 py-3 text-white font-bold text-center">
              </div>
            </div>

            <div>
              <label class="block font-bold text-[#d8c3a5] uppercase tracking-wider mb-1">Günlük Net Kazanç (Max 400 €)</label>
              <div class="relative">
                <input type="number" max="400" x-model="form.supplierPrice" required placeholder="120" class="w-full bg-[#141211] border-2 border-[#d8c3a5] rounded-xl px-4 py-3.5 text-[#d8c3a5] font-black text-lg focus:outline-none focus:border-[#e8d8c8] shadow-inner">
                <span class="absolute right-4 top-3.5 text-[#d8c3a5] font-bold text-lg" x-text="form.currency"></span>
              </div>
              <p class="text-[10px] text-stone-400 mt-1">Sistem otomatik olarak %20 komisyon ekleyerek müşteri satış fiyatını belirler.</p>
            </div>

            <div x-show="message" x-text="message" :class="isError ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'" class="p-3 rounded-xl border font-bold text-center"></div>

            <button type="submit" class="w-full beige-btn font-extrabold py-4 rounded-xl shadow-lg transition-all text-sm mt-4">Aracı Sisteme Kaydet ve Listeme Ekle</button>
          </form>
        </div>
      </div>

      <div x-show="activeTab === 'wallet'" x-cloak x-transition>
        <div class="glass-card rounded-3xl p-8 shadow-xl max-w-2xl mx-auto">
          <div class="flex items-center space-x-3 mb-6 pb-4 border-b border-stone-800">
            <div class="beige-btn p-3 rounded-2xl flex items-center justify-center text-xl shadow"><i class="fa-solid fa-wallet"></i></div>
            <div>
              <h2 class="text-xl font-black text-white">Hesap Özeti & Finansal Rapor</h2>
              <p class="text-xs font-semibold text-stone-400" x-text="companyName">Firma Mali Bilançosu</p>
            </div>
          </div>
          <div class="bg-[#141211] p-6 rounded-2xl border border-stone-800 space-y-4 shadow-inner">
            <div class="flex justify-between items-center"><span class="text-stone-400 font-medium">Toplam Aktif Araç Kazanç Potansiyeli:</span><strong class="text-[#d8c3a5] text-lg" x-text="totalSupplierEarnings + ' € / Gün'"></strong></div>
            <div class="flex justify-between items-center"><span class="text-stone-400 font-medium">İş Modeli:</span><strong class="text-white">Global B2B Dağıtım Sözleşmesi</strong></div>
          </div>
        </div>
      </div>

      <div x-show="activeTab === 'loyalty'" x-cloak x-transition>
        <div class="glass-card rounded-3xl p-8 shadow-xl max-w-2xl mx-auto text-center">
          <div class="w-16 h-16 coke-red text-[#e6d5bc] rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg border border-red-400/40"><i class="fa-solid fa-award"></i></div>
          <h2 class="text-xl font-black text-white mb-2">VIP Sadakat Primi & Seviye Durumu</h2>
          <p class="text-xs font-semibold text-stone-400 mb-6">Sistemdeki kıdeminize göre özel prim kazanma modülü.</p>
          <div class="bg-[#141211] border border-stone-800 p-6 rounded-2xl shadow-inner">
            <h4 class="text-sm font-extrabold text-[#d8c3a5] mb-2">Sadakat Primi Modülü Şu An Kilitli</h4>
            <p class="text-xs text-stone-400 leading-relaxed">VIP Sadakat Primi ve ek ciro desteklerinden yararlanabilmeniz için en az 3 ay kesintisiz aktif iş ortaklığı yürütmeniz gerekmektedir.</p>
          </div>
        </div>
      </div>

      <div x-show="activeTab === 'stats'" x-cloak x-transition>
        <div class="glass-card rounded-3xl p-8 shadow-xl max-w-2xl mx-auto">
          <div class="flex items-center space-x-3 mb-6 pb-4 border-b border-stone-800">
            <div class="beige-btn p-3 rounded-2xl flex items-center justify-center text-xl shadow"><i class="fa-solid fa-chart-line"></i></div>
            <div>
              <h2 class="text-xl font-black text-white">Kiralama Performans İstatistikleri</h2>
              <p class="text-xs font-semibold text-stone-400" x-text="companyName">Operasyonel Analiz</p>
            </div>
          </div>
          <div class="bg-[#141211] p-6 rounded-2xl border border-stone-800 space-y-4 shadow-inner text-xs">
            <div class="flex justify-between items-center"><span class="text-stone-400 font-medium">Toplam Filo Havuzundaki Payınız:</span><strong class="text-[#d8c3a5]" x-text="cars.length + ' Adet Araç'"></strong></div>
            <div class="flex justify-between items-center"><span class="text-stone-400 font-medium">Operasyonel Durum:</span><strong class="text-emerald-400">Sorunsuz & Aktif</strong></div>
          </div>
        </div>
      </div>
    </main>

    <footer class="w-full py-6 text-center text-xs text-stone-500 border-t border-stone-900 bg-[#181513]/80 backdrop-blur-sm">
      Tüm Hakları Saklıdır © 2026 FlexiDrive Global OS. Kurumsal B2B Tedarikçi Portalı.
    </footer>
  </div>

  <script>
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
      { name: 'Kuzey Makedonya', flag: '🇲🇰', dial: '+389', currency: 'ден' },
      { name: 'Fransa', flag: '🇫🇷', dial: '+33', currency: '€' },
      { name: 'İspanya', flag: '🇪🇸', dial: '+34', currency: '€' },
      { name: 'Avusturya', flag: '🇦🇹', dial: '+43', currency: '€' },
      { name: 'İsviçre', flag: '🇨🇭', dial: '+41', currency: 'CHF' },
      { name: 'Hollanda', flag: '🇳🇱', dial: '+31', currency: '€' }
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
      'Kuzey Makedonya': ['Üsküp (SKP)', 'Ohri (OHD)'],
      'Fransa': ['Paris Charles de Gaulle (CDG)', 'Nice (NCE)', 'Lyon (LYS)'],
      'İspanya': ['Madrid (MAD)', 'Barselona (BCN)', 'Malaga (AGP)'],
      'Avusturya': ['Viyana (VIE)', 'Salzburg (SZG)'],
      'İsviçre': ['Zürih (ZRH)', 'Cenevre (GVA)'],
      'Hollanda': ['Amsterdam Schiphol (AMS)']
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

    function supplierPortal() {
      return {
        isLoggedIn: false,
        authMode: 'login',
        loginEmail: '',
        loginPassword: '',
        loginError: '',
        regForm: { fullName: '', email: '', companyName: '', password: '' },
        regMessage: '',
        isRegError: false,
        companyName: '',
        activeTab: 'cars',
        cars: [],
        countries: GLOBAL_COUNTRIES,
        airportData: AIRPORT_DATABASE,
        carData: CAR_DATABASE,
        availableModels: [],
        availableAirports: [],
        form: { brand: '', model: '', year: 2026, category: 'Ekonomik', fuelType: 'Benzin', luggageCapacity: 2, supplierPassword: 'flexi2026', phoneOnly: '', selectedDial: '+382', country: '', airports: '', supplierPrice: '', currency: '€' },
        message: '',
        isError: false,

        async init() {
          const savedCompany = localStorage.getItem('flexi_supplier_company');
          if (savedCompany) { 
            this.companyName = savedCompany; 
            this.isLoggedIn = true; 
            await this.fetchSupplierCars(); 
          }
        },
        async fetchSupplierCars() {
          try { 
            const res = await fetch('/api/supplier/cars?company=' + encodeURIComponent(this.companyName)); 
            this.cars = await res.json(); 
          } catch (err) {}
        },
        async loginSupplier() {
          this.loginError = '';
          try {
            const res = await fetch('/api/supplier/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: this.loginEmail, password: this.loginPassword })
            });
            const data = await res.json();
            if (res.ok && data.success) {
              this.companyName = data.companyName;
              localStorage.setItem('flexi_supplier_company', this.companyName);
              this.isLoggedIn = true;
              await this.fetchSupplierCars();
            } else {
              this.loginError = data.error || 'Giriş başarısız.';
            }
          } catch (err) {
            this.loginError = 'Bağlantı hatası!';
          }
        },
        async registerSupplier() {
          this.regMessage = '';
          try {
            const res = await fetch('/api/supplier/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(this.regForm)
            });
            const data = await res.json();
            if (res.ok) {
              this.isRegError = false;
              this.regMessage = data.message;
              setTimeout(() => {
                this.authMode = 'login';
                this.loginEmail = this.regForm.email;
                this.regMessage = '';
              }, 2000);
            } else {
              this.isRegError = true;
              this.regMessage = data.error || 'Kayıt başarısız.';
            }
          } catch (err) {
            this.isRegError = true;
            this.regMessage = 'Bağlantı hatası!';
          }
        },
        logout() {
          localStorage.removeItem('flexi_supplier_company');
          this.isLoggedIn = false; 
          this.loginEmail = '';
          this.loginPassword = '';
          this.cars = [];
        },
        get totalSupplierEarnings() {
          return this.cars.filter(c => c.available).reduce((acc, c) => acc + (c.supplierPrice || 0), 0);
        },
        updateCountryData(val) {
          this.form.airports = ''; 
          const c = this.countries.find(x => x.name === val);
          if (c) { 
            this.form.currency = c.currency; 
            this.form.selectedDial = c.dial; 
            this.availableAirports = this.airportData[val] || []; 
          } else { 
            this.availableAirports = []; 
          }
        },
        async submitCar() {
          try {
            const priceVal = parseFloat(this.form.supplierPrice);
            if (priceVal > 400) { this.isError = true; this.message = 'Günlük net kazanç 400 € üzerinde olamaz!'; return; }

            const fullContact = this.form.selectedDial + ' ' + this.form.phoneOnly;
            const payload = { ...this.form, supplierName: this.companyName, supplierContact: fullContact, supplierPassword: 'flexi2026' };

            const res = await fetch('/api/cars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) {
              this.isError = false; this.message = 'Aracınız başarıyla yayına alındı!';
              await this.fetchSupplierCars(); this.activeTab = 'cars';
              setTimeout(() => { this.message = ''; }, 3000); 
            } else { 
              const errData = await res.json();
              this.isError = true; this.message = errData.error || 'Kayıt başarısız.'; 
            }
          } catch (err) { this.isError = true; this.message = 'Bağlantı hatası!'; }
        },
        async toggleMyCarStatus(id) {
          await fetch('/api/cars/' + id + '/status', { method: 'PATCH' });
          await this.fetchSupplierCars();
        }
      }
    }
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`FlexiDrive Dark Beige VIP Sunucu http://localhost:${PORT} adresinde aktif!`);
});
