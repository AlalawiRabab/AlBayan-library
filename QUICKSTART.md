# ⚡ Quick Start Guide - المكتبة الإلكترونية للقصص

Get up and running in 5 minutes! 🚀

## 1️⃣ Clone & Install (2 mins)

```bash
cd /Users/staynza/Documents/OL
npm install
```

## 2️⃣ Setup Environment (1 min)

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
GROQ_API_KEY=your_rotated_groq_api_key
AUTO_GRADING_RPC_SECRET=your_high_entropy_server_secret
```

Get the public Supabase values from project settings. Keep the Groq key and
grading secret server-only; the grading secret must match the deployed Edge
Function configuration.

## 3️⃣ Run Development Server (1 min)

```bash
npm run dev
```

Open: http://localhost:3000

## 4️⃣ Test With Demo Accounts (1 min)

### 👨‍💼 Admin
- **Code**: use the active admin code stored securely outside the repository
- **Dashboard**: Full system control

### 👨‍🏫 Teacher  
- **Code**: use the assigned teacher code (Grade 3)
- **Dashboard**: Student & content management

### 👦 Student
- **Code**: First student needs registration
- **Dashboard**: Story reading & forms

## 📁 Project Structure

```
src/
├── app/                 # All pages & layouts
├── components/          # Reusable UI components
├── lib/                # Utilities & Supabase client
└── types/              # TypeScript definitions
```

## 🎨 Key Components

- **Button** - All buttons with variants
- **Card** - Container component
- **StoryCard** - Story display card
- **AnimatedBackground** - Beautiful animated backdrop

## 🔧 Common Tasks

### Add a New Page

```bash
# Create directory
mkdir -p src/app/[section]/[page]

# Create page.tsx
touch src/app/[section]/[page]/page.tsx
```

Use template:

```tsx
'use client'
import AnimatedBackground from '@/components/AnimatedBackground'

export default function Page() {
  return (
    <AnimatedBackground>
      <div dir="rtl">
        {/* Your content */}
      </div>
    </AnimatedBackground>
  )
}
```

### Fetch Data from Database

```tsx
import { storiesService } from '@/lib/supabase'

// In component
const stories = await storiesService.getStoriesByGrade(3)
```

### Show Toast Notification

```tsx
import toast from 'react-hot-toast'

toast.success('تم بنجاح!')
toast.error('حدث خطأ')
```

### Use Global State

```tsx
import { useAppStore } from '@/lib/store'

const { user, isAuthenticated } = useAppStore()
```

## 🚀 Deploy

### To Vercel

```bash
npm i -g vercel
vercel login
vercel --prod
```

Set environment variables in Vercel Dashboard.

## 📚 Documentation

- **DATABASE_SCHEMA.md** - Complete database structure
- **DEPLOYMENT.md** - Full deployment guide
- **README.md** - Comprehensive documentation
- **df** - All system functions
- **Style** - Design system & tokens

## 🎨 Colors & Fonts

All configured in `tailwind.config.ts`:

```typescript
// Colors
primary: #48B8FF        // Sky Blue
secondary: #FFD44D      // Sunshine Yellow
accent-green: #4CD17E   // Fresh Green
accent-red: #FF6F6F     // Coral Red

// Fonts
font-arabic: Tajawal, Cairo
```

Use in Tailwind:

```html
<div class="bg-primary text-white font-bold">
  Sky Blue Button
</div>
```

## 🐛 Debugging

### Enable Console Logs

```typescript
console.log('Debug:', data)
```

### Check Types

```bash
# Open file to see TypeScript errors
# File: src/types/index.ts
```

### Database Issues

1. Check Supabase Dashboard
2. Verify RLS policies
3. Check network tab in DevTools

## 📱 Mobile Testing

```bash
# Get your machine IP
ipconfig getifaddr en0  # macOS
hostname -I             # Linux

# Access from phone/tablet
http://[your-ip]:3000
```

## 🔒 Security Notes

- ✅ Never commit `.env.local`
- ✅ Never expose service-role keys or server-only AI secrets
- ✅ Always use RTL (dir="rtl")
- ✅ Test RLS policies before deploy

## 💡 Tips & Tricks

### Faster Development

```bash
# Hot reload works automatically
# Just save file and refresh browser
```

### Disable Animations (for testing)

In `tailwind.config.ts`, set animations to instant.

### Clear Cache

```bash
rm -rf .next
npm run dev
```

## ❓ Common Issues

### "Supabase credentials not configured"

- Set `.env.local` with URL and key
- Restart dev server

### "Cannot find module '@/...'"

- Clear `.next` folder
- Restart dev server
- Check `tsconfig.json` paths

### RTL Layout Broken

- Ensure `dir="rtl"` on HTML element
- Use `text-right` class
- Check Tailwind CSS loaded

### Animations Slow on Mobile

- Reduce animation duration
- Use `will-change` CSS property
- Profile with DevTools

## 🚀 Next Steps

1. Read `DEPLOYMENT.md` for production setup
2. Check `DATABASE_SCHEMA.md` for data structure
3. Review `df` for all system functions
4. Customize stories and forms
5. Deploy to Vercel

## 📞 Need Help?

1. Check documentation files
2. Look at example components
3. Check Supabase docs
4. Review TypeScript types

---

**Ready to build? Let's go! 🎉**

Happy coding! ✨
