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

// 4. ADMIN HQ (/)
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
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0d0d0d; color
