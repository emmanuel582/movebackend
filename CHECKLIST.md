# Pre-Deployment Checklist for Hostinger VPS

## ✅ Code Quality & Security
- [x] TypeScript compilation successful (no errors)
- [x] All environment variables documented in `.env.example`
- [x] CORS configured for production (restricts origins)
- [x] Helmet.js enabled for security headers
- [x] JWT secret is strong and unique
- [x] Service role key used for Supabase (not anon key)
- [x] Error handling middleware in place
- [x] Logging configured (Morgan in production mode)
- [x] .gitignore prevents committing sensitive files

## ✅ Features Implemented
- [x] Authentication (JWT-based)
- [x] Email verification (OTP)
- [x] Identity verification (with admin approval)
- [x] Trip posting and management
- [x] Delivery request management
- [x] Matching system (travelers + deliveries)
- [x] Payment processing (Stripe)
- [x] Wallet system
- [x] Push notifications (Expo)
- [x] In-app notifications
- [x] Rating and dispute system
- [x] Admin dashboard
- [x] Bank details management
- [x] Maps integration

## ✅ Database & Storage
- [x] Supabase configured correctly
- [x] RLS policies in place (verify in Supabase dashboard)
- [x] File upload working (verification documents)
- [x] Database schema matches code expectations

## ✅ Third-Party Services
- [x] Stripe integration complete
  - Secret key configured
  - Webhook endpoint ready
  - Test mode vs production mode
- [x] SendGrid/SMTP configured for emails
- [x] Firebase configured for push notifications
- [x] Supabase service role key set

## ⚠️ Before Going Live

### 1. Environment Variables
Create `/var/www/movever-backend/.env` on VPS with:
```bash
NODE_ENV=production
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
JWT_SECRET=generate_a_strong_random_string_here
STRIPE_SECRET_KEY=sk_live_your_live_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
SMTP_PASS=your_sendgrid_api_key
FRONTEND_URL=https://yourdomain.com
```

### 2. Update Frontend API URL
In your React Native app, update the API base URL:
```typescript
// Hidden_success/services/api.ts
const API_URL = __DEV__ 
  ? 'http://localhost:5000/api' 
  : 'https://api.yourdomain.com/api';
```

### 3. Domain Setup
- Point `api.yourdomain.com` to your VPS IP
- Wait for DNS propagation (can take up to 48 hours)
- Run Certbot to get SSL certificate

### 4. Stripe Webhook Configuration
- Go to Stripe Dashboard → Webhooks
- Add endpoint: `https://api.yourdomain.com/api/payments/webhook`
- Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
- Copy webhook secret to `.env`

### 5. Supabase Configuration
- Add VPS IP to allowed IPs (if IP restrictions enabled)
- Verify RLS policies are active
- Test database connection from VPS

### 6. Testing Checklist
After deployment, test these flows:
- [ ] User registration and email verification
- [ ] User login
- [ ] Identity verification submission
- [ ] Post a trip (as traveler)
- [ ] Post a delivery request (as business)
- [ ] Match creation
- [ ] Payment processing
- [ ] Push notification delivery
- [ ] Wallet balance updates
- [ ] Admin approval workflow

## 🚀 Deployment Commands

```bash
# 1. Build locally
npm run build

# 2. Upload to VPS
scp -r dist package.json package-lock.json ecosystem.config.json root@your-vps-ip:/var/www/movever-backend/

# 3. SSH into VPS
ssh root@your-vps-ip

# 4. Install dependencies
cd /var/www/movever-backend
npm install --production

# 5. Create .env file
nano .env
# (paste your production environment variables)

# 6. Start with PM2
pm2 start ecosystem.config.json
pm2 save
pm2 startup

# 7. Configure Nginx (see DEPLOYMENT.md)

# 8. Setup SSL
sudo certbot --nginx -d api.yourdomain.com
```

## 📊 Monitoring

### Health Check
```bash
curl https://api.yourdomain.com/
# Should return: {"status":"success","message":"MOVEVER Backend API is running"}
```

### View Logs
```bash
pm2 logs movever-backend --lines 100
```

### Monitor Performance
```bash
pm2 monit
```

## 🔧 Troubleshooting

### Common Issues

**Issue: "Cannot find module"**
- Solution: Run `npm install --production` on VPS

**Issue: "Port already in use"**
- Solution: `pm2 delete all` then restart

**Issue: "CORS error"**
- Solution: Add your frontend domain to `allowedOrigins` in `app.ts`

**Issue: "Database connection failed"**
- Solution: Verify Supabase credentials and IP whitelist

**Issue: "Stripe webhook signature verification failed"**
- Solution: Update `STRIPE_WEBHOOK_SECRET` in `.env`

## 📝 Post-Deployment

- [ ] Monitor error logs for 24 hours
- [ ] Test all critical user flows
- [ ] Setup automated backups
- [ ] Configure monitoring/alerting (optional: UptimeRobot, Sentry)
- [ ] Document any production-specific configurations
- [ ] Share API documentation with team

## 🎯 Performance Optimization (Optional)

- Enable PM2 cluster mode (already configured in ecosystem.config.json)
- Setup Redis for caching (future enhancement)
- Enable Nginx gzip compression
- Setup CDN for static assets
- Database query optimization

---

**Ready to Deploy!** 🚀

Your backend is production-ready. Follow the deployment steps in `DEPLOYMENT.md` and use this checklist to ensure everything is configured correctly.
