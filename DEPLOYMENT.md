# 🚀 Deployment Guide - المكتبة الإلكترونية للقصص

Complete guide to deploy the Electronic Story Library web application.

## 📋 Pre-Deployment Checklist

- [ ] Supabase project created and configured
- [ ] Database migrations applied
- [ ] Sample data (stories, forms, users) loaded
- [ ] Environment variables prepared
- [ ] All pages tested locally
- [ ] RTL layout verified on mobile devices
- [ ] Animations tested on various browsers
- [ ] Database backups configured

## 🔧 Local Setup (Development)

### 1. Prerequisites

```bash
# Check Node.js version (18+ required)
node --version
npm --version
```

### 2. Install Dependencies

```bash
cd /Users/staynza/Documents/OL
npm install
```

### 3. Configure Environment Variables

Create `.env.local` file:

```bash
# Copy from .env.example
cp .env.example .env.local
```

Edit `.env.local`:

```
# Get these from your Supabase project settings
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
GROQ_API_KEY=your_rotated_groq_api_key
AUTO_GRADING_RPC_SECRET=your_high_entropy_server_secret
```

The Groq key and grading secret are server-only deployment variables. The
grading secret must match the SHA-256 value configured in the deployed
`secure-auto-grading` Edge Function. Never expose a Supabase service-role key.

### 4. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## 🧪 Testing Locally

### Test All Three User Roles

1. **Admin Testing**
   - Code: use the active admin code stored securely outside the repository
   - Visit: http://localhost:3000
   - Check admin dashboard loads
   - Verify all menu items are clickable

2. **Teacher Testing**
   - Code: use the assigned teacher code (Grade 3)
   - Check teacher dashboard loads
   - Verify student management options

3. **Student Testing**
   - Code: Generate from teacher dashboard or use sample codes
   - Test story reading interface
   - Test form submission

### Performance Testing

```bash
# Build for production and test locally
npm run build
npm start
```

Test with:
- Mobile devices (iPhone, Android)
- Tablets
- Desktop (Chrome, Firefox, Safari)
- Slow 3G (DevTools)

## 🌐 Deploy to Vercel

### 1. Prepare for Deployment

```bash
# Ensure all files are committed
git status
git add .
git commit -m "Ready for deployment"
```

### 2. Connect to Vercel

**Option A: Using Vercel CLI**

```bash
npm i -g vercel
vercel login
vercel
```

**Option B: Using GitHub**

1. Push code to GitHub repository
2. Go to https://vercel.com/new
3. Import your GitHub repository
4. Vercel auto-detects Next.js configuration

### 3. Set Environment Variables in Vercel

In Vercel Dashboard:

1. Go to Project Settings → Environment Variables
2. Add the following variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_NAME=المكتبة الإلكترونية للقصص
```

3. Click "Save"

### 4. Deploy

```bash
# Deploy to production
vercel --prod
```

The app will be available at: `https://your-project.vercel.app`

## 📦 Alternative Deployment Options

### Netlify

```bash
npm i -g netlify-cli
netlify deploy --prod --dir=.next
```

### Docker (Self-Hosted)

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t story-library .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=your_url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
  story-library
```

## 🔐 Security Checklist

- [ ] Never commit `.env.local` files
- [ ] Use environment variables for all sensitive data
- [ ] Enable Supabase Row Level Security (RLS)
- [ ] Set up database backups
- [ ] Configure CORS properly
- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Set secure headers in Next.js config
- [ ] Review RLS policies before deployment

## 📊 Monitoring & Maintenance

### Set Up Monitoring

```bash
# Check server health
curl https://your-domain.com/api/health
```

### Database Backups

- Supabase automatically backs up daily
- Enable automated backups in Dashboard
- Test restore procedures monthly

### Performance Monitoring

- Use Vercel Analytics dashboard
- Monitor Core Web Vitals
- Check database query performance

## 🔄 Update & Maintenance

### Deploy Updates

```bash
# Make changes locally
git add .
git commit -m "Your update message"
git push

# Vercel auto-deploys or trigger manual deploy
vercel --prod
```

### Zero-Downtime Deployments

- Vercel handles zero-downtime deployments
- Database migrations: Create backward-compatible changes
- Use feature flags for new features

## 🚨 Troubleshooting

### Build Fails on Vercel

Check build logs:
```bash
# Local build test
npm run build
```

Common issues:
- Missing environment variables
- Type errors in TypeScript
- Outdated dependencies

### Database Connection Issues

1. Verify Supabase URL and key are correct
2. Check Supabase project is running
3. Ensure RLS policies allow anonymous access
4. Check CORS settings

### Slow Performance

1. Enable Supabase query performance
2. Add database indexes
3. Optimize images with WebP
4. Use Next.js Image Optimization

### RTL Layout Issues on Production

```bash
# Ensure dir="rtl" is set in HTML root
# Check lang="ar" attribute
# Verify all CSS media queries work
```

## 📈 Scaling Considerations

### Database Scaling

- Monitor query performance in Supabase Dashboard
- Add indexes to frequently queried columns
- Archive old activity logs
- Consider caching with Redis

### CDN & Caching

- Vercel includes global CDN by default
- Set Cache-Control headers for static assets
- Use Supabase CDN for large files

### Horizontal Scaling

- Vercel scales automatically
- Monitor concurrent connections
- Use serverless functions for heavy processing

## 🎯 Post-Deployment

### Smoke Tests

```bash
# Test main flows work
1. Login as student
2. Read a story
3. Submit a form
4. Check leaderboard
5. View profile
```

### User Feedback

- Gather user feedback
- Monitor error logs
- Fix issues quickly
- Plan new features

### Analytics

- Track user engagement
- Monitor time spent reading
- Analyze form submission rates
- Identify popular stories

## 📞 Support & Issues

### Getting Help

1. Check DATABASE_SCHEMA.md for data structure
2. Review df document for functions
3. Check Supabase documentation
4. Enable debug logs for troubleshooting

### Reporting Issues

When deploying, check:
- Vercel build logs
- Supabase dashboard logs
- Browser console errors
- Network tab in DevTools

## 🔄 Rollback Plan

If deployment has critical issues:

```bash
# Revert to previous version
vercel rollback

# Or redeploy specific version
vercel --prod --target=production
```

## 📅 Maintenance Schedule

- **Daily**: Check error logs
- **Weekly**: Review database performance
- **Monthly**: Test backup/restore
- **Quarterly**: Update dependencies
- **Annually**: Security audit

---

**Last Updated**: October 20, 2025  
**Status**: Ready for Production ✅
