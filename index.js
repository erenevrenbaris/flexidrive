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
  country: { type: String, required: "Karadağ" },
  airports: { type: String, required: true },
  supplierPrice: { type: Number, required: true },
  commissionRate: { type: Number, default: 20 },
  customerPrice: { type: Number, required: true },
  currency: { type: String, default: "€" }, 
  available: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const Car = mongoose.model('Car', CarSchema);

// 3. API Rotaları (Güvenlik Korumalı)
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

    const newCar = new Car({
      brand, model, year: year || 2026, category: category || 'Ekonomik', fuelType: fuelType || 'Benzin', luggageCapacity: luggageCapacity || 2,
      supplierName, supplierContact, country, airports, supplierPrice: supPrice, commissionRate: commRate, customerPrice, currency: currency || '€', available: true
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

  <!-- Kurumsal Header -->
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

    <!-- PROFİL & KURUMSAL LİNK YÖNETİMİ -->
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

    <!-- SEKME 1: FİLO OPERASYONLARI -->
    <div x-show="activeTab === 'admin'" x-transition>
      
      <!-- ÖZET KARTLARI -->
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

      <!-- GELİŞMİŞ FİLTRELEME ÇUBUĞU (Ülke & Lokasyon) -->
      <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl mb-6 flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center space-x-2">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider"><i class="fa-solid fa-filter mr-1 text-indigo-400"></i> Ülke:</span>
            <select x-model="selectedCountry" @change="selectedAirport = ''" class="bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer">
              <option value="">Tüm Ülkeler</option>
              <template x-for="country in uniqueCountries" :key="country">
                <option :value="country" x-text="getFlag(country) + ' ' + country"></option>
              </template>
            </select>
          </div>

          <div class="flex items-center space-x-2" x-show="selectedCountry">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Havalimanı:</span>
            <select x-model="selectedAirport" class="bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer">
              <option value="">Tüm Noktalar</option>
              <template x-for="airport in uniqueAirportsForSelectedCountry" :key="airport">
                <option :value="airport" x-text="airport"></option>
              </template>
            </select>
          </div>
        </div>

        <div class="text-xs text-slate-400 font-semibold">
          Filtrelenen Filo: <span class="text-indigo-400 font-bold text-sm" x-text="filteredCars.length"></span> araç
        </div>
      </div>

      <!-- ARAÇ GRID LİSTESİ -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <template x-for="car in filteredCars" :key="car._id">
          <div @click="openDetail(car)" class="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all cursor-pointer flex flex-col justify-between group">
            <div>
              <div class="flex justify-between items-start mb-3">
                <div>
                  <span class="text-[10px] font-bold px-2 py-1 rounded bg-slate-800 text-indigo-400 uppercase tracking-widest" x-text="car.category"></span>
                  <h3 class="text-lg font-extrabold text-white mt-2 group-hover:text-indigo-400 transition-colors" x-text="car.brand + ' ' + car.model"></h3>
                  <div class="flex space-x-3 mt-2 text-xs text-slate-400">
                    <span><i class="fa-regular fa-calendar mr-1"></i><span x-text="car.year"></span></span>
                    <span><i class="fa-solid fa-gas-pump mr-1"></i><span x-text="car.fuelType"></span></span>
                    <span class="text-indigo-300 font-semibold"><i class="fa-solid fa-suitcase-rolling mr-1"></i><span x-text="(car.luggageCapacity || 2) + ' Bavul'"></span></span>
                  </div>
                </div>
                <span :class="car.available ? 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20' : 'text-rose-400 bg-rose-400/10 border-rose-500/20'" class="px-2 py-1 rounded text-[10px] font-black border" x-text="car.available ? 'MÜSAİT' : 'KİRADA'"></span>
              </div>
              <div class="bg-slate-950 p-3.5 rounded-xl mb-4 mt-3 text-xs border border-slate-800/60">
                <div class="flex justify-between text-slate-300 mb-1.5"><span class="text-slate-500">Tedarikçi:</span><span class="font-bold text-white" x-text="car.supplierName"></span></div>
                <div class="flex justify-between text-slate-300"><span class="text-slate-500">Lokasyon:</span><span class="font-bold text-indigo-400" x-text="getFlag(car.country) + ' ' + (car.airports || '')"></span></div>
              </div>
            </div>
            <div class="flex justify-between items-end pt-3 border-t border-slate-800">
              <div>
                <span class="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Flexi Kârı</span>
                <span class="text-lg font-black text-emerald-400" x-text="'+' + (car.customerPrice - car.supplierPrice) + ' ' + (car.currency || '€')"></span>
              </div>
              <span class="text-xs bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg font-bold group-hover:bg-indigo-600 group-hover:text-white transition-all"><i class="fa-solid fa-circle-info mr-1"></i> Detaylar</span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- SEKME 2: TEDARİKÇİ AĞI (PARTNERLER) -->
    <div x-show="activeTab === 'partners'" x-cloak x-transition>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-bold text-white">Sistemdeki Aktif Tedarikçileriniz</h2>
          <p class="text-sm text-slate-400">Balkanlar ve Avrupa partner ağınızın operasyonel analizi</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <template x-for="supplier in uniqueSuppliers" :key="supplier.name">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all flex flex-col">
            <div class="flex justify-between items-start mb-4">
              <div class="flex items-center space-x-3">
                <div class="text-3xl" x-text="getFlag(supplier.country)"></div>
                <div><h3 class="text-lg font-bold text-white" x-text="supplier.name"></h3><p class="text-xs text-slate-400" x-text="supplier.country"></p></div>
              </div>
              <div class="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg text-xs font-black"><span x-text="supplier.carCount"></span> Araç</div>
            </div>
            <div class="bg-slate-950 rounded-xl p-3.5 flex-1 mb-4 text-xs border border-slate-800">
              <div class="text-slate-500 mb-0.5 font-bold uppercase tracking-wider text-[10px]">Havalimanı / Bölge</div><div class="font-bold text-slate-200 mb-3" x-text="supplier.airports"></div>
              <div class="text-slate-500 mb-0.5 font-bold uppercase tracking-wider text-[10px]">İletişim Hattı</div><div class="font-mono text-indigo-300 font-bold" x-text="supplier.contact"></div>
            </div>
            <div class="pt-3 border-t border-slate-800">
              <span class="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Potansiyel Günlük Kâr</span>
              <template x-for="(val, cur) in supplier.profits" :key="cur">
                <span class="text-xl font-black text-emerald-400 mr-2" x-text="'+' + val + ' ' + cur"></span>
              </template>
            </div>
          </div>
        </template>
      </div>
    </div>

  </main>

  <!-- KİMDE NE VAR DETAY MODALI (ENTERPRISE DRILL-DOWN) -->
  <div x-show="selectedCar" x-cloak class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
    <div @click.away="selectedCar = null" class="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
      <button @click="selectedCar = null" class="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center font-bold"><i class="fa-solid fa-xmark"></i></button>
      
      <div class="flex items-center space-x-3 mb-6">
        <div class="text-3xl" x-text="getFlag(selectedCar?.country)"></div>
        <div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-indigo-400 uppercase tracking-widest" x-text="selectedCar?.category"></span>
          <h3 class="text-xl font-black text-white mt-1" x-text="selectedCar?.brand + ' ' + selectedCar?.model + ' (' + selectedCar?.year + ')'"></h3>
        </div>
      </div>

      <div class="space-y-4 text-xs mb-6">
        <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
          <div class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1"><i class="fa-solid fa-user-shield mr-1"></i> Tedarikçi Künyesi & İletişim</div>
          <div class="flex justify-between"><span class="text-slate-500">Firma Unvanı:</span><span class="font-bold text-white text-sm" x-text="selectedCar?.supplierName"></span></div>
          <div class="flex justify-between"><span class="text-slate-500">GSM / WhatsApp:</span><span class="font-mono text-emerald-400 font-bold" x-text="selectedCar?.supplierContact"></span></div>
          <div class="flex justify-between"><span class="text-slate-500">Ülke / Teslimat:</span><span class="font-bold text-indigo-300" x-text="selectedCar?.country + ' / ' + selectedCar?.airports"></span></div>
        </div>

        <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
          <div class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1"><i class="fa-solid fa-file-invoice-dollar mr-1"></i> Finansal Dağılım (%20 Komisyon)</div>
          <div class="flex justify-between"><span class="text-slate-500">Tedarikçi Net Talebi:</span><span class="font-bold text-white" x-text="selectedCar?.supplierPrice + ' ' + selectedCar?.currency"></span></div>
          <div class="flex justify-between"><span class="text-slate-500">Flexi Komisyon Oranı:</span><span class="font-bold text-cyan-400">%" + (selectedCar?.commissionRate || 20) + "</span></div>
          <div class="flex justify-between pt-2 border-t border-slate-800"><span class="text-slate-300 font-bold">Müşteri Satış Fiyatı:</span><span class="font-black text-emerald-400 text-sm" x-text="selectedCar?.customerPrice + ' ' + selectedCar?.currency"></span></div>
        </div>
      </div>

      <div class="flex space-x-3">
        <button @click="toggleStatus(selectedCar._id); selectedCar.available = !selectedCar.available" class="w-1/2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all text-xs flex items-center justify-center">
          <i class="fa-solid fa-power-off mr-2 text-indigo-400"></i> Durumu Değiştir
        </button>
        <button @click="selectedCar = null" class="w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all text-xs">Pencereyi Kapat</button>
      </div>
    </div>
  </div>

  <script>
    document.addEventListener('alpine:init', () => {
      Alpine.data('adminApp', () => ({
        activeTab: 'admin',
        cars: [],
        selectedCountry: '',
        selectedAirport: '',
        selectedCar: null,
        windowOrigin: window.location.origin,
        
        async init() { await this.fetchCars(); },
        
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

        get uniqueCountries() {
          return [...new Set(this.cars.map(c => c.country))].filter(Boolean);
        },

        get uniqueAirportsForSelectedCountry() {
          if (!this.selectedCountry) return [];
          const matched = this.cars.filter(c => c.country === this.selectedCountry);
          return [...new Set(matched.map(c => c.airports))].filter(Boolean);
        },

        get filteredCars() {
          return this.cars.filter(c => {
            const matchCountry = !this.selectedCountry || c.country === this.selectedCountry;
            const matchAirport = !this.selectedAirport || c.airports === this.selectedAirport;
            return matchCountry && matchAirport;
          });
        },

        openDetail(car) {
          this.selectedCar = car;
        },

        async toggleStatus(id) { 
          await fetch('/api/cars/' + id + '/status', { method: 'PATCH' }); 
          await this.fetchCars(); 
        },

        getFlag(country) {
          const flags = { 'Karadağ': '🇲🇪', 'Türkiye': '🇹🇷', 'Sırbistan': '🇷🇸', 'Arnavutluk': '🇦🇱', 'Bosna Hersek': '🇧🇦', 'Almanya': '🇩🇪', 'İngiltere': '🇬🇧', 'Amerika': '🇺🇸' };
          return flags[country] || '🏳️';
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
</html>`);
});


// 5. AYRI TEDARİKÇİ KAYIT PORTALI (/tedarikci-paneli)
app.get('/tedarikci-paneli', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr" class="h-full bg-slate-950">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexiDrive Tedarikçi Portal</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
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
<body class="h-full text-slate-100 flex items-center justify-center p-4" x-data="supplierApp()">

  <div class="max-w-3xl w-full bg-slate-900 border border-slate-700 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
    <div class="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl"></div>
    
    <div class="flex items-center space-x-3 mb-6 border-b border-slate-800 pb-4 relative z-10">
      <div class="bg-emerald-600 text-white p-3 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-emerald-600/30"><i class="fa-solid fa-handshake"></i></div>
      <div>
        <h3 class="text-2xl font-black text-white">FlexiDrive Tedarikçi Portalı</h3>
        <p class="text-xs text-slate-400 font-medium">Filo aracınızı kaydedin, uluslararası broker ağımızla hemen rezervasyon almaya başlayın.</p>
      </div>
    </div>
    
    <form @submit.prevent="submitCar" class="space-y-6 relative z-10">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div class="space-y-4">
          <h4 class="text-xs font-black text-indigo-400 uppercase tracking-widest"><i class="fa-solid fa-building mr-1"></i> Firma & Bölge</h4>
          
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
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Firma Adı</label>
            <input type="text" x-model="form.supplierName" required placeholder="Firma Adı (Örn: Budva Rent a Car)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm">
          </div>

          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Telefon Numarası (Sadece Rakam)</label>
            <div class="flex space-x-2">
              <select x-model="form.dialCode" required class="w-1/3 bg-slate-950 border border-slate-800 rounded-xl px-2 py-3 text-white text-sm font-mono font-bold">
                <template x-for="c in countries" :key="c.name">
                  <option :value="c.dial" x-text="c.flag + ' ' + c.dial"></option>
                </template>
              </select>
              <input type="tel" x-model="form.phoneOnly" required pattern="[0-9]*" minlength="7" maxlength="12" placeholder="5XX XXX XX XX" class="w-2/3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm font-mono">
            </div>
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
        </div>

        <div class="space-y-4">
          <h4 class="text-xs font-black text-indigo-400 uppercase tracking-widest"><i class="fa-solid fa-car mr-1"></i> Araç Teknik Detayları</h4>
          
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
              <input type="number" x-model="form.year" required min="2000" max="2027" placeholder="Yıl" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-white text-sm font-bold">
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
              <input type="number" x-model="form.luggageCapacity" required min="0" max="10" placeholder="Kapasite" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-white text-sm font-bold">
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
      
      <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-600/20 transition-all">
        <i class="fa-solid fa-cloud-arrow-up mr-2"></i> Aracı Sisteme Kaydet
      </button>
    </form>
  </div>

  <script>
    const GLOBAL_COUNTRIES = [
      { name: 'Karadağ', flag: '🇲🇪', dial: '+382', currency: '€' },
      { name: 'Türkiye', flag: '🇹🇷', dial: '+90', currency: '₺' },
      { name: 'Sırbistan', flag: '🇷🇸', dial: '+381', currency: '€' },
      { name: 'Arnavutluk', flag: '🇦🇱', dial: '+355', currency: '€' },
      { name: 'Bosna Hersek', flag: '🇧🇦', dial: '+387', currency: '€' },
      { name: 'Almanya', flag: '🇩🇪', dial: '+49', currency: '€' },
      { name: 'İngiltere', flag: '🇬🇧', dial: '+44', currency: '£' },
      { name: 'Amerika', flag: '🇺🇸', dial: '+1', currency: '$' }
    ];
    const AIRPORT_DATABASE = {
      'Karadağ': ['Tivat (TIV)', 'Podgorica (TGD)'],
      'Türkiye': ['İstanbul (IST)', 'Sabiha Gökçen (SAW)', 'Antalya (AYT)', 'İzmir (ADB)', 'Ankara (ESB)', 'Dalaman (DLM)', 'Bodrum (BJV)'],
      'Sırbistan': ['Belgrad (BEG)', 'Niş (INI)'],
      'Arnavutluk': ['Tiran (TIA)'],
      'Bosna Hersek': ['Saraybosna (SJJ)'],
      'Almanya': ['Frankfurt (FRA)', 'Münih (MUC)', 'Berlin (BER)'],
      'İngiltere': ['Heathrow (LHR)', 'Gatwick (LGW)'],
      'Amerika': ['JFK New York (JFK)', 'Miami (MIA)']
    };
    const CAR_DATABASE = {
      'Alfa Romeo': ['Giulietta', 'Giulia', 'Stelvio', 'Tonale'],
      'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8'],
      'BMW': ['1 Serisi', '3 Serisi', '5 Serisi', 'X1', 'X3', 'X5'],
      'BYD': ['Atto 3', 'Seal', 'Dolphin'],
      'Chery': ['Tiggo 7 Pro', 'Tiggo 8 Pro', 'Omoda 5'],
      'Citroen': ['C3', 'C4', 'C5 Aircross'],
      'Cupra': ['Formentor', 'Leon'],
      'Dacia': ['Sandero', 'Duster', 'Jogger'],
      'Fiat': ['Egea', 'Panda', '500', 'Fiorino', 'Doblo'],
      'Ford': ['Fiesta', 'Focus', 'Puma', 'Kuga'],
      'Honda': ['Civic', 'HR-V', 'CR-V'],
      'Hyundai': ['i20', 'Elantra', 'Tucson', 'Bayon'],
      'Kia': ['Rio', 'Ceed', 'Sportage', 'Stonic'],
      'Mercedes-Benz': ['A-Serisi', 'C-Serisi', 'E-Serisi', 'GLA', 'GLC', 'Vito'],
      'MG': ['ZS', 'HS', 'MG4'],
      'Nissan': ['Micra', 'Juke', 'Qashqai', 'X-Trail'],
      'Opel': ['Corsa', 'Astra', 'Mokka', 'Grandland'],
      'Peugeot': ['208', '308', '2008', '3008', '5008'],
      'Renault': ['Clio', 'Taliant', 'Megane', 'Captur', 'Austral'],
      'Skoda': ['Fabia', 'Octavia', 'Superb', 'Kamiq', 'Karoq', 'Kodiaq'],
      'Tesla': ['Model 3', 'Model Y', 'Model S'],
      'Toyota': ['Yaris', 'Corolla', 'C-HR', 'RAV4'],
      'Volkswagen': ['Polo', 'Golf', 'Passat', 'T-Roc', 'Tiguan', 'ID.4'],
      'Volvo': ['XC40', 'XC60', 'XC90']
    };

    document.addEventListener('alpine:init', () => {
      Alpine.data('supplierApp', () => ({
        countries: GLOBAL_COUNTRIES,
        airportData: AIRPORT_DATABASE,
        carData: CAR_DATABASE,
        availableModels: [],
        availableAirports: [],
        form: { 
          brand: '', model: '', year: 2026, category: 'Ekonomik', fuelType: 'Benzin', luggageCapacity: '', 
          supplierName: '', phoneOnly: '', dialCode: '+382', country: '', airports: '', supplierPrice: '', currency: '€' 
        },
        message: '',
        isError: false,
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
            const payload = { ...this.form, supplierContact: fullContact };

            const res = await fetch('/api/cars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) {
              this.isError = false; this.message = 'Aracınız başarıyla ağımıza eklendi!';
              const currentCountry = this.form.country;
              const currentDial = this.form.dialCode;
              const currentCurrency = this.form.currency;
              this.form = { brand: '', model: '', year: 2026, category: 'Ekonomik', fuelType: 'Benzin', luggageCapacity: '', supplierName: '', phoneOnly: '', dialCode: currentDial, country: currentCountry, airports: '', supplierPrice: '', currency: currentCurrency };
              this.availableModels = []; 
              setTimeout(() => { this.message = ''; }, 3000); 
            } else { this.isError = true; this.message = 'Kayıt başarısız.'; }
          } catch (err) { this.isError = true; this.message = 'Bağlantı hatası!'; }
        }
      }));
    });
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`FlexiDrive Enterprise sunucusu http://localhost:${PORT} adresinde aktif!`);
});
