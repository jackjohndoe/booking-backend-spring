# Frontend Integration Quick Start

Get your frontend connected to the Booking API in 5 minutes.

## 📱 React Native

**See:** [REACT_NATIVE_INTEGRATION.md](./REACT_NATIVE_INTEGRATION.md)

Quick setup:
```bash
npm install axios @react-native-async-storage/async-storage
```

```javascript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  baseURL: 'https://your-app-name.up.railway.app/api',
});

// Add token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Register
const register = async (name, email, password, role) => {
  const { data } = await api.post('/auth/register', {
    name, email, password, role: 'GUEST' // or 'HOST'
  });
  await AsyncStorage.setItem('token', data.token);
  return data;
};

// Login
const login = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password });
  await AsyncStorage.setItem('token', data.token);
  return data;
};
```

## 🌐 Web (React/Vue/Angular)

**See:** [FRONTEND_INTEGRATION_GUIDE.md](./FRONTEND_INTEGRATION_GUIDE.md)

Quick setup:
```bash
npm install axios
```

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://your-app-name.up.railway.app/api',
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Register
const register = async (name, email, password, role) => {
  const { data } = await api.post('/auth/register', {
    name, email, password, role: 'GUEST' // or 'HOST'
  });
  localStorage.setItem('token', data.token);
  return data;
};

// Login
const login = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password });
  localStorage.setItem('token', data.token);
  return data;
};
```

## 🔑 Key Endpoints

- **Register:** `POST /api/auth/register`
- **Login:** `POST /api/auth/login`
- **Get Listings:** `GET /api/listings`
- **Create Booking:** `POST /api/bookings`
- **Get Wallet:** `GET /api/wallet`

## 📚 Full Documentation

- **React Native:** [REACT_NATIVE_INTEGRATION.md](./REACT_NATIVE_INTEGRATION.md)
- **Web:** [FRONTEND_INTEGRATION_GUIDE.md](./FRONTEND_INTEGRATION_GUIDE.md)
- **Swagger UI:** `https://your-app-name.up.railway.app/swagger-ui.html`

## 🎯 User Roles

- **GUEST**: Can book listings, create reviews, manage wallet
- **HOST**: Can create and manage listings, view bookings

## ⚠️ Important

1. **API URL**: Replace `your-app-name.up.railway.app` with your actual Railway domain
2. **Token Storage**: Store JWT token securely (AsyncStorage for RN, localStorage for web)
3. **CORS**: Backend allows all origins (`*`) - no CORS issues
4. **Examples**: See Swagger UI for complete request/response examples

