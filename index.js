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
  year: { type: Number, default: 2024 },
  category: { type: String, default: "Ekonomik" },
  fuelType: { type: String, default: "Benzin" },
  luggageCapacity: { type: Number, default: 2 },
  supplierName: { type: String, required: true },
  supplierContact: { type: String, required: true },
  country: { type: String, default: "Karadağ" },
  airports: { type: String, default: "Belirtilmemiş" },
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
    res.status(500).json({ error: 'Araçlar getirilemedi' });
  }
});

app.post('/api/cars', async (req, res) => {
  try {
    const { brand, model, year, category, fuelType, luggageCapacity, supplierName, supplierContact, country, airports, supplierPrice, currency } = req.body;
    const commRate = 20; 
    const supPrice = parseFloat(supplierPrice);
    const customerPrice = Math.round(supPrice * (1 + commRate / 100));

    const newCar = new Car({
      brand, model, year: year || 2024, category: category || 'Ekonomik', fuelType: fuelType || 'Benzin', luggageCapacity: luggageCapacity || 2,
      supplierName: supplierName || 'Bağımsız Tedarikçi', supplierContact: supplierContact || 'Belirtilmemiş', country: country || 'Karadağ',
      airports: airports || 'Belirtilmemiş', supplierPrice: supPrice, commissionRate: commRate, customerPrice, currency: currency || '€', available: true
    });

    await newCar.save();
    res.status(201).json({ message: 'Araç başarıyla eklendi!', car: newCar });
  } catch (err) {
    res.status(400).json({ error: 'Hata oluştu', details: err.message });
  }
});

app.patch('/api/cars/:id/status', async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ error: 'Araç bulunamadı' });
    car.available = !car.available;
    await car.save();
    res.json({ message: 'Durum güncellendi', car });
  } catch (err) {
    res.status(500).json({ error: 'Durum değiştirilemedi' });
  }
});

// 4. Global Arayüz 
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr" class="h-full bg-slate-950">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexiDrive Global Broker OS</title>
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
<body class="h-full text-slate-100 flex flex-col" x-data="flexiApp()">

  <!-- Header -->
  <header class="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="bg-indigo-600 text-white p-2 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/30"><i class="fa-solid fa-earth-europe"></i></div>
        <div><span class="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">FlexiDrive</span> <span class="text-xs text-slate-500 ml-1 font-bold">Global HQ</span></div>
      </div>
      <div class="flex items-center space-x-2 overflow-x-auto">
        <button @click="activeTab = 'admin'" :class="activeTab === 'admin' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'" class="px-5 py-2 rounded-xl font-semibold text-sm transition-all whitespace-nowrap">
          <i class="fa-solid fa-car mr-2"></i> Filo Yönetimi
        </button>
        <button @click="activeTab = 'partners'" :class="activeTab === 'partners' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'" class="px-5 py-2 rounded-xl font-semibold text-sm transition-all whitespace-nowrap">
          <i class="fa-solid fa-handshake mr-2"></i> Aktif Partnerler
        </button>
        <button @click="activeTab = 'supplier'" :class="activeTab === 'supplier' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'" class="px-5 py-2 rounded-xl font-semibold text-sm transition-all border border-emerald-500/30 whitespace-nowrap">
          <i class="fa-solid fa-plus-circle mr-2"></i> Araç Ekle (Tedarikçi)
        </button>
      </div>
    </div>
  </header>

  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

    <!-- SEKME 1: FİLO YÖNETİMİ -->
    <div x-show="activeTab === 'admin'" x-transition>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex justify-between items-center hover:border-slate-700 transition-all"><div><p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Filo</p><h3 class="text-3xl font-black mt-1 text-white" x-text="cars.length">0</h3></div><div class="text-indigo-400 text-3xl opacity-50"><i class="fa-solid fa-car"></i></div></div>
        <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex justify-between items-center hover:border-slate-700 transition-all"><div><p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Müsait</p><h3 class="text-3xl font-black mt-1 text-emerald-400" x-text="cars.filter(c => c.available).length">0</h3></div><div class="text-emerald-400 text-3xl opacity-50"><i class="fa-solid fa-circle-check"></i></div></div>
        <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex justify-between items-center hover:border-slate-700 transition-all"><div><p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Komisyon</p><h3 class="text-3xl font-black mt-1 text-cyan-400">%20</h3></div><div class="text-cyan-400 text-3xl opacity-50"><i class="fa-solid fa-percent"></i></div></div>
        <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm flex justify-between items-center overflow-hidden hover:border-slate-700 transition-all">
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
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300">
            <div class="flex justify-between items-start mb-3">
              <div>
                <span class="text-[10px] font-bold px-2 py-1 rounded bg-slate-800 text-indigo-400 uppercase tracking-widest" x-text="car.category"></span>
                <h3 class="text-lg font-extrabold text-white mt-2" x-text="car.brand + ' ' + car.model"></h3>
                <div class="flex space-x-3 mt-2 text-xs text-slate-400">
                  <span class="flex items-center"><i class="fa-regular fa-calendar mr-1 text-slate-500"></i><span x-text="car.year"></span></span>
                  <span class="flex items-center"><i class="fa-solid fa-gas-pump mr-1 text-slate-500"></i><span x-text="car.fuelType"></span></span>
                  <span class="flex items-center text-indigo-300 font-semibold"><i class="fa-solid fa-suitcase-rolling mr-1"></i><span x-text="(car.luggageCapacity || 0) + ' Bavul'"></span></span>
                </div>
              </div>
              <span :class="car.available ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-rose-400 bg-rose-400/10 border-rose-400/20'" class="px-2 py-1 rounded text-[10px] font-black border tracking-wider" x-text="car.available ? 'MÜSAİT' : 'KİRADA'"></span>
            </div>
            <div class="bg-slate-950/50 p-3 rounded-xl mb-4 mt-3 text-xs border border-slate-800/50">
              <div class="flex justify-between text-slate-300 mb-1.5"><span class="text-slate-500 font-medium">Tedarikçi:</span><span class="font-bold text-white" x-text="car.supplierName"></span></div>
              <div class="flex justify-between text-slate-300 mb-1.5"><span class="text-slate-500 font-medium">İletişim:</span><span class="font-mono text-white" x-text="car.supplierContact"></span></div>
              <div class="flex justify-between text-slate-300"><span class="text-slate-500 font-medium">Lokasyon:</span><span class="font-bold text-indigo-400" x-text="getFlag(car.country) + ' ' + (car.airports || '')"></span></div>
            </div>
            <div class="flex justify-between items-end pt-3 border-t border-slate-800">
              <div>
                <span class="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-0.5">Flexi Kârı</span>
                <span class="text-xl font-black text-emerald-400" x-text="'+' + (car.customerPrice - car.supplierPrice) + ' ' + (car.currency || '€')"></span>
              </div>
              <button @click="toggleStatus(car._id)" class="text-xs bg-slate-800 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold transition-all duration-200">Durum Değiştir</button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- SEKME 2: AKTİF PARTNERLER -->
    <div x-show="activeTab === 'partners'" x-cloak x-transition>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-extrabold text-white">Sistemdeki Aktif Partnerleriniz</h2>
          <p class="text-sm text-slate-400 font-medium">Global tedarikçi ağınız ve kârlılık analiziniz</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <template x-for="supplier in uniqueSuppliers" :key="supplier.name">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 flex flex-col">
            <div class="flex justify-between items-start mb-5">
              <div class="flex items-center space-x-4">
                <div class="text-4xl drop-shadow-md" x-text="getFlag(supplier.country)"></div>
                <div><h3 class="text-lg font-bold text-white leading-tight" x-text="supplier.name"></h3><p class="text-xs text-slate-400 font-semibold mt-0.5" x-text="supplier.country"></p></div>
              </div>
              <div class="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded-xl text-xs font-black"><span x-text="supplier.carCount" class="text-sm"></span> Araç</div>
            </div>
            <div class="bg-slate-950 border border-slate-800/50 rounded-xl p-4 flex-1 mb-5 text-xs">
              <div class="text-slate-500 mb-1 font-bold uppercase tracking-wider text-[10px]">Havalimanları / Bölgeler</div>
              <div class="font-bold text-slate-200 mb-4" x-text="supplier.airports"></div>
              <div class="text-slate-500 mb-1 font-bold uppercase tracking-wider text-[10px]">İletişim Numarası</div>
              <div class="font-mono text-slate-200 font-bold" x-text="supplier.contact"></div>
            </div>
            <div class="pt-4 border-t border-slate-800">
              <span class="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-1">Günlük Potansiyel Kâr</span>
              <template x-for="(val, cur) in supplier.profits" :key="cur">
                <span class="text-2xl font-black text-emerald-400 mr-3" x-text="'+' + val + ' ' + cur"></span>
              </template>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- SEKME 3: TEDARİKÇİ PORTALI -->
    <div x-show="activeTab === 'supplier'" x-cloak x-transition class="max-w-4xl mx-auto">
      <div class="bg-slate-900 border border-slate-700 rounded-3xl p-8 shadow-2xl mb-8 relative overflow-hidden">
        <div class="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl"></div>
        <h3 class="text-2xl font-black text-white mb-2 relative z-10"><i class="fa-solid fa-handshake text-emerald-400 mr-2"></i> Tedarikçi Araç Giriş Portalı</h3>
        <p class="text-sm text-slate-400 mb-8 border-b border-slate-800 pb-5 relative z-10 font-medium">Lütfen ekleyeceğiniz aracın bilgilerini eksiksiz doldurunuz.</p>
        
        <form @submit.prevent="submitCar" class="space-y-8 relative z-10">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="space-y-5">
              <h4 class="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center"><i class="fa-solid fa-building mr-2"></i> Firma & Lokasyon</h4>
              <div class="bg-slate-950/50 p-5 rounded-2xl border border-slate-800/80 space-y-4">
                <div>
                  <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ülke Seçimi</label>
                  <select x-model="form.country" @change="updateCountryData(form.country)" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer">
                    <option value="" disabled selected>Ülke Seçin</option>
                    <template x-for="c in countries" :key="c.name">
                      <option :value="c.name" x-text="c.flag + ' ' + c.name"></option>
                    </template>
                  </select>
                </div>

                <div>
                  <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Firma Adı</label>
                  <input type="text" x-model="form.supplierName" required placeholder="Firma Adı (Örn: Budva Rent)" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors">
                </div>

                <div>
                  <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Telefon Numarası</label>
                  <div class="flex space-x-2">
                    <select x-model="form.dialCode" required class="w-1/3 bg-slate-900 border border-slate-700 rounded-xl px-2 py-3 text-white text-sm font-mono font-bold focus:outline-none cursor-pointer">
                      <template x-for="c in countries" :key="c.name">
                        <option :value="c.dial" x-text="c.flag + ' ' + c.dial"></option>
                      </template>
                    </select>
                    <input type="tel" x-model="form.phoneOnly" required pattern="[0-9]*" minlength="7" maxlength="12" title="Lütfen sadece rakam giriniz" placeholder="5XX XXX XX XX" class="w-2/3 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-indigo-500 transition-colors">
                  </div>
                </div>

                <div>
                  <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Havalimanı / Teslim Noktası</label>
                  <select x-model="form.airports" required :disabled="!form.country || availableAirports.length === 0" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer disabled:opacity-40">
                    <option value="" disabled selected>Önce Ülke Seçin</option>
                    <template x-for="airport in availableAirports" :key="airport">
                      <option :value="airport" x-text="airport"></option>
                    </template>
                  </select>
                </div>
              </div>
            </div>

            <div class="space-y-5">
              <h4 class="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center"><i class="fa-solid fa-car mr-2"></i> Araç Teknik Bilgileri</h4>
              <div class="bg-slate-950/50 p-5 rounded-2xl border border-slate-800/80 space-y-4">
                <div class="flex space-x-4">
                  <div class="w-1/2">
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Marka</label>
                    <select x-model="form.brand" @change="form.model = ''; availableModels = carData[form.brand] || []" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer">
                      <option value="" disabled selected>Marka Seçin</option>
                      <template x-for="(models, brandName) in carData" :key="brandName">
                        <option :value="brandName" x-text="brandName"></option>
                      </template>
                    </select>
                  </div>
                  <div class="w-1/2">
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Model</label>
                    <select x-model="form.model" required :disabled="!form.brand" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm font-bold disabled:opacity-40 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer">
                      <option value="" disabled selected>Önce Marka Seçin</option>
                      <template x-for="modelName in availableModels" :key="modelName">
                        <option :value="modelName" x-text="modelName"></option>
                      </template>
                    </select>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-3">
                  <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Yıl</label>
                    <input type="number" x-model="form.year" required min="2000" max="2027" placeholder="Yıl" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors">
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sınıf</label>
                    <select x-model="form.category" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-3 text-white text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer">
                      <option value="Ekonomik">Ekonomik</option><option value="SUV">SUV</option><option value="Sedan">Sedan</option><option value="Lüks">Lüks</option><option value="Minivan">Minivan</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Yakıt</label>
                    <select x-model="form.fuelType" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-3 text-white text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer">
                      <option value="Benzin">Benzin</option><option value="Dizel">Dizel</option><option value="Hibrit">Hibrit</option><option value="Elektrik">Elektrik</option>
                    </select>
                  </div>
                </div>

                <div class="flex space-x-4">
                  <div class="w-1/3">
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kapasite</label>
                    <input type="number" x-model="form.luggageCapacity" required min="0" max="10" placeholder="Kaç Bavul?" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors">
                  </div>
                  <div class="w-2/3">
                    <label class="block text-[10px] font-black text-emerald-400 uppercase tracking-wider mb-1.5">İstediğiniz Net Kazanç</label>
                    <div class="relative">
                      <span class="absolute left-4 top-3 text-emerald-400 font-black text-lg" x-text="form.currency"></span>
                      <input type="number" x-model="form.supplierPrice" required min="1" placeholder="Günlük Tutar" class="w-full bg-slate-900 border-2 border-emerald-500/40 rounded-xl pl-10 pr-4 py-3 text-white text-sm font-black focus:outline-none focus:border-emerald-500 transition-colors">
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div x-show="message" x-transition x-text="message" :class="isError ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'" class="p-4 rounded-xl border text-sm font-bold text-center"></div>
          
          <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg py-4 rounded-xl shadow-lg shadow-emerald-600/20 transition-all duration-300 transform hover:-translate-y-1">
            <i class="fa-solid fa-cloud-arrow-up mr-2"></i> Aracı Sisteme Kaydet
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
      { name: 'Bosna Hersek', flag: '🇧🇦', dial: '+387', currency: '€' },
      { name: 'Kuzey Makedonya', flag: '🇲🇰', dial: '+389', currency: '€' },
      { name: 'Kosova', flag: '🇽🇰', dial: '+383', currency: '€' },
      { name: 'Yunanistan', flag: '🇬🇷', dial: '+30', currency: '€' },
      { name: 'Bulgaristan', flag: '🇧🇬', dial: '+359', currency: '€' },
      { name: 'Almanya', flag: '🇩🇪', dial: '+49', currency: '€' },
      { name: 'İngiltere', flag: '🇬🇧', dial: '+44', currency: '£' },
      { name: 'Amerika', flag: '🇺🇸', dial: '+1', currency: '$' }
    ];

    const AIRPORT_DATABASE = {
      'Karadağ': ['Tivat (TIV)', 'Podgorica (TGD)'],
      'Türkiye': ['İstanbul (IST)', 'Sabiha Gökçen (SAW)', 'Antalya (AYT)', 'İzmir Adnan Menderes (ADB)', 'Ankara Esenboğa (ESB)', 'Dalaman (DLM)', 'Bodrum (BJV)'],
      'Sırbistan': ['Belgrad Nikola Tesla (BEG)', 'Niş (INI)'],
      'Arnavutluk': ['Tiran (TIA)'],
      'Bosna Hersek': ['Saraybosna (SJJ)', 'Tuzla (TZL)', 'Mostar (OMO)'],
      'Kuzey Makedonya': ['Üsküp (SKP)', 'Ohrid (OHD)'],
      'Kosova': ['Priştine (PRN)'],
      'Yunanistan': ['Atina (ATH)', 'Selanik (SKG)', 'Girit (HER)', 'Rodos (RHO)'],
      'Bulgaristan': ['Sofya (SOF)', 'Varna (VAR)', 'Burgaz (BOJ)'],
      'Almanya': ['Frankfurt (FRA)', 'Münih (MUC)', 'Berlin (BER)', 'Düsseldorf (DUS)', 'Köln (CGN)'],
      'İngiltere': ['Heathrow (LHR)', 'Gatwick (LGW)', 'Manchester (MAN)', 'Stansted (STN)'],
      'Amerika': ['JFK New York (JFK)', 'Los Angeles (LAX)', 'Miami (MIA)', 'Chicago (ORD)']
    };

    const CAR_DATABASE = {
      'Alfa Romeo': ['Giulietta', 'Giulia', 'Stelvio', 'Tonale'],
      'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron'],
      'BMW': ['1 Serisi', '2 Serisi', '3 Serisi', '4 Serisi', '5 Serisi', '7 Serisi', 'X1', 'X2', 'X3', 'X5', 'X7', 'i4', 'iX'],
      'BYD': ['Atto 3', 'Seal', 'Dolphin', 'Han', 'Tang'],
      'Chery': ['Tiggo 7 Pro', 'Tiggo 8 Pro', 'Omoda 5'],
      'Citroen': ['C3', 'C3 Aircross', 'C4', 'C4 X', 'C5 Aircross', 'C-Elysee', 'Berlingo', 'Ami'],
      'Cupra': ['Formentor', 'Leon', 'Ateca', 'Born'],
      'Dacia': ['Sandero', 'Sandero Stepway', 'Duster', 'Logan', 'Jogger', 'Spring'],
      'Fiat': ['Egea', 'Panda', '500', '500X', '500e', 'Linea', 'Fiorino', 'Doblo', 'Ducato'],
      'Ford': ['Fiesta', 'Focus', 'Puma', 'Kuga', 'Mustang Mach-E', 'Tourneo Courier', 'Transit'],
      'Honda': ['City', 'Civic', 'Accord', 'HR-V', 'CR-V', 'Jazz'],
      'Hyundai': ['i10', 'i20', 'i30', 'Elantra', 'Bayon', 'Kona', 'Tucson', 'Santa Fe', 'Ioniq 5', 'Ioniq 6'],
      'Jeep': ['Renegade', 'Compass', 'Avenger', 'Wrangler', 'Grand Cherokee'],
      'Kia': ['Picanto', 'Rio', 'Ceed', 'Stonic', 'Xceed', 'Niro', 'Sportage', 'Sorento', 'EV6', 'EV9'],
      'Land Rover': ['Range Rover', 'Range Rover Sport', 'Evoque', 'Velar', 'Defender', 'Discovery'],
      'Mazda': ['Mazda2', 'Mazda3', 'Mazda6', 'CX-3', 'CX-30', 'CX-5'],
      'Mercedes-Benz': ['A-Serisi', 'B-Serisi', 'C-Serisi', 'E-Serisi', 'S-Serisi', 'CLA', 'GLA', 'GLB', 'GLC', 'GLE', 'Vito', 'Sprinter'],
      'MG': ['ZS', 'HS', 'MG4', 'Marvel R'],
      'Mini': ['Cooper', 'Countryman', 'Clubman', 'Electric'],
      'Mitsubishi': ['Space Star', 'Colt', 'ASX', 'Eclipse Cross', 'L200'],
      'Nissan': ['Micra', 'Juke', 'Qashqai', 'X-Trail', 'Ariya'],
      'Opel': ['Corsa', 'Astra', 'Crossland', 'Mokka', 'Grandland', 'Combo', 'Zafira'],
      'Peugeot': ['208', '308', '408', '508', '2008', '3008', '5008', 'Rifter', 'Partner'],
      'Porsche': ['Macan', 'Cayenne', 'Panamera', 'Taycan', '911'],
      'Renault': ['Clio', 'Taliant', 'Megane', 'Megane E-Tech', 'Captur', 'Austral', 'Koleos', 'Zoe', 'Kangoo', 'Trafic', 'Master'],
      'Seat': ['Ibiza', 'Leon', 'Arona', 'Ateca', 'Tarraco'],
      'Skoda': ['Fabia', 'Scala', 'Octavia', 'Superb', 'Kamiq', 'Karoq', 'Kodiaq', 'Enyaq'],
      'Subaru': ['XV', 'Crosstrek', 'Forester', 'Outback'],
      'Suzuki': ['Swift', 'Vitara', 'S-Cross', 'Jimny', 'Ignis'],
      'Tesla': ['Model 3', 'Model Y', 'Model S', 'Model X'],
      'Toyota': ['Yaris', 'Yaris Cross', 'Corolla', 'Corolla Cross', 'C-HR', 'RAV4', 'Camry', 'Hilux', 'Proace'],
      'Volkswagen': ['Polo', 'Golf', 'Passat', 'Arteon', 'T-Cross', 'Taigo', 'T-Roc', 'Tiguan', 'Touareg', 'Caddy', 'Transporter', 'ID.3', 'ID.4', 'ID.5'],
      'Volvo': ['XC40', 'XC60', 'XC90', 'S60', 'S90', 'V60', 'V90', 'C40 Recharge']
    };

    document.addEventListener('alpine:init', () => {
      Alpine.data('flexiApp', () => ({
        activeTab: 'admin',
        cars: [],
        countries: GLOBAL_COUNTRIES,
        airportData: AIRPORT_DATABASE,
        carData: CAR_DATABASE,
        availableModels: [],
        availableAirports: [],
        form: { 
          brand: '', model: '', year: 2024, category: 'Ekonomik', fuelType: 'Benzin', luggageCapacity: '', 
          supplierName: '', phoneOnly: '', dialCode: '+382', country: '', airports: '', supplierPrice: '', currency: '€' 
        },
        message: '',
        isError: false,
        
        async init() { 
          await this.fetchCars(); 
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

        async fetchCars() {
          try {
            const res = await fetch('/api/cars');
            this.cars = await res.json();
          } catch (err) {}
        },

        get totalProfits() {
          const totals = {};
          this.cars.filter(c => c.available).forEach(c => {
            const cur = c.currency || '€';
            totals[cur] = (totals[cur] || 0) + (c.customerPrice - c.supplierPrice);
          });
          return totals;
        },

        async submitCar() {
          try {
            const fullContact = this.form.dialCode + ' ' + this.form.phoneOnly;
            const payload = { ...this.form, supplierContact: fullContact };

            const res = await fetch('/api/cars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) {
              this.isError = false; this.message = 'Aracınız başarıyla ağımıza eklendi!';
              
              const currentCountry = this.form.country;
              const currentDial = this.form.dialCode;
              const currentCurrency = this.form.currency;
              
              this.form = { brand: '', model: '', year: 2024, category: 'Ekonomik', fuelType: 'Benzin', luggageCapacity: '', supplierName: '', phoneOnly: '', dialCode: currentDial, country: currentCountry, airports: '', supplierPrice: '', currency: currentCurrency };
              this.availableModels = []; 
              
              await this.fetchCars();
              setTimeout(() => { this.message = ''; }, 3000); 
            } else { this.isError = true; this.message = 'Kayıt başarısız.'; }
          } catch (err) { this.isError = true; this.message = 'Bağlantı hatası!'; }
        },

        async toggleStatus(id) { await fetch('/api/cars/' + id + '/status', { method: 'PATCH' }); await this.fetchCars(); },
        
        getFlag(country) {
          const c = this.countries.find(x => x.name === country);
          return c ? c.flag : '🏳️';
        },

        get uniqueSuppliers() {
          const map = new Map();
          this.cars.forEach(c => {
            if (!c.supplierName) return;
            if (!map.has(c.supplierName)) { 
              map.set(c.supplierName, { name: c.supplierName, contact: c.supplierContact, country: c.country || '-', airports: c.airports || '-', carCount: 0, profits: {} }); 
            }
            const s = map.get(c.supplierName);
            s.carCount++;
            if (c.available) {
              const cur = c.currency || '€';
              s.profits[cur] = (s.profits[cur] || 0) + (c.customerPrice - c.supplierPrice);
            }
          });
          return Array.from(map.values());
        }
      }));
    });
  </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`FlexiDrive B2B sunucusu http://localhost:${PORT} adresinde aktif!`);
});