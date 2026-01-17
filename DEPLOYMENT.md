# Movever Backend - Production Deployment Guide

## Prerequisites
- Node.js 18+ installed on VPS
- PM2 for process management
- Nginx for reverse proxy
- SSL certificate (Let's Encrypt)

## Deployment Steps

### 1. Prepare VPS
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Upload Backend Code
```bash
# On your local machine, create a production build
cd movebackend
npm run build

# Upload to VPS (replace with your VPS IP)
scp -r dist package.json package-lock.json root@your-vps-ip:/var/www/movever-backend/
```

### 3. Setup on VPS
```bash
# SSH into VPS
ssh root@your-vps-ip

# Navigate to project directory
cd /var/www/movever-backend

# Install production dependencies only
npm install --production

# Create .env file (copy from .env.example and fill in real values)
nano .env
```

### 4. Configure Environment Variables
Edit `/var/www/movever-backend/.env` with your production values:
- Set `NODE_ENV=production`
- Add your Supabase credentials
- Add your Stripe keys
- Add your SendGrid API key
- Set `FRONTEND_URL` to your actual domain
- Generate a strong `JWT_SECRET`

### 5. Start with PM2
```bash
# Start the application
pm2 start dist/server.js --name movever-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

### 6. Configure Nginx
```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/movever-backend
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/movever-backend /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 7. Setup SSL with Let's Encrypt
```bash
sudo certbot --nginx -d api.yourdomain.com
```

### 8. Configure Firewall
```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## Monitoring & Maintenance

### View Logs
```bash
# PM2 logs
pm2 logs movever-backend

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Restart Application
```bash
pm2 restart movever-backend
```

### Update Application
```bash
# On local machine, rebuild
npm run build

# Upload new dist folder
scp -r dist root@your-vps-ip:/var/www/movever-backend/

# On VPS, restart
pm2 restart movever-backend
```

## Security Checklist
- ✅ Use strong JWT_SECRET
- ✅ Enable HTTPS only
- ✅ Set NODE_ENV=production
- ✅ Use service role key for Supabase
- ✅ Configure CORS to only allow your frontend domain
- ✅ Keep dependencies updated
- ✅ Setup automated backups
- ✅ Monitor error logs regularly

## Troubleshooting

### Application won't start
```bash
# Check PM2 logs
pm2 logs movever-backend --lines 100

# Check if port 5000 is in use
sudo lsof -i :5000
```

### Nginx errors
```bash
# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Test configuration
sudo nginx -t
```

### Database connection issues
- Verify Supabase credentials in .env
- Check if VPS IP is whitelisted in Supabase dashboard
- Test connection manually

## Performance Optimization
```bash
# Enable PM2 cluster mode for better performance
pm2 delete movever-backend
pm2 start dist/server.js --name movever-backend -i max

# Enable Nginx gzip compression
sudo nano /etc/nginx/nginx.conf
# Add: gzip on; gzip_types application/json;
```
