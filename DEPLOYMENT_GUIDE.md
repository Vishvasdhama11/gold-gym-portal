# 🚀 IronPulse Gym - Deployment & Setup Guide

Is application ko deploy karna bohot aasan hai kyunki isme koi heavy external dependencies nahi hai. Ye Node.js native (`node:sqlite`, `node:http`, `node:crypto`) par chalta hai.

---

## 📌 Requirements
- **Node.js**: Version **22.0.0** ya usse upar (Node 22 me `node:sqlite` natively built-in hai).
- **RAM**: Minimum 512MB
- **Storage**: Minimum 1GB (database aur member photos ke liye)

---

## 🛠 Option 1: Render.com par Deploy (Sabse Aasan & Free/Easy)
1. Apne code ko **GitHub** par push karein.
2. [Render.com](https://render.com) par login karke **"New Web Service"** chunein.
3. Apna GitHub repository connect karein.
4. Settings me ye daalein:
   - **Environment**: `Node`
   - **Build Command**: *(khali chhod dein ya `npm install`)*
   - **Start Command**: `node server.js`
   - **Node Version**: Environment variables me `NODE_VERSION` = `22.20.0` daalein.
5. Click **"Deploy Web Service"**!
6. Render aapko free live HTTPS link de dega (jaise `https://ironpulse-gym.onrender.com`).

---

## 🛠 Option 2: Railway.app par Deploy
1. [Railway.app](https://railway.app) par jayein aur **"New Project"** -> **"Deploy from GitHub repo"** select karein.
2. Railway automatically `package.json` detect karke `node server.js` chala dega.
3. Settings me jaakar **Generate Domain** par click karein.
4. Aapka portal live ho jayega!

---

## 🛠 Option 3: VPS / Cloud Server (Hostinger, AWS, DigitalOcean, Ubuntu)
Agar aapke paas apna VPS (Ubuntu Linux) hai:

### Step 1: Server par Node.js 22 Install Karein
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v # Check karein v22.x aana chahiye
```

### Step 2: PM2 Process Manager Install Karein
```bash
sudo npm install -g pm2
```

### Step 3: Project Folder me Jake Start Karein
```bash
cd /path/to/premium-admin-user-portal
pm2 start server.js --name "ironpulse-gym"
pm2 save
pm2 startup
```

### Step 4: Domain & Free SSL (Nginx & Certbot)
Nginx configuration:
```nginx
server {
    server_name yourgymdomain.com www.yourgymdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10M;
    }
}
```
Free SSL activate karne ke liye:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourgymdomain.com -d www.yourgymdomain.com
```

---

## 👑 Login Credentials
- **Role**: Admin
- **Mobile Number**: `7302424139`
- **Password**: `jatt4321`

---

## 🧪 Pre-Deployment Tests Run Karne Ke Liye
```bash
node test-suite.js
```
