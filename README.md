# NKR Aqua Farm

React dashboard for tracking seed stocking, feed & FCR, water quality, growth, harvest & sales, and expenses across 14 tanks.

## Run locally

```
npm install
npm start
```

## Deploy to Vercel

1. Push this folder to a new GitHub repo.
2. Go to vercel.com → **Add New Project** → import the repo → Deploy.
   Vercel auto-detects Create React App, no extra config needed.

## Notes

- Data is saved in the browser's `localStorage`, so it stays on whichever
  device/browser you use the app on. It is **not** synced across devices.
- Built with React, Tailwind CSS, recharts, and lucide-react.
