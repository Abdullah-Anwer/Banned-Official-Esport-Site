# BANNED OFFICIAL — Backend wali website

Express + MongoDB. Frontend `public/index.html` mein hai aur wohi server se serve hota hai,
isliye sirf ek hi cheez deploy karni hai.

## 1) MongoDB Atlas (free database)
1. https://www.mongodb.com/atlas pe account banao -> **M0 Free** cluster banao.
2. **Database Access** -> naya user banao (username + password yaad rakho).
3. **Network Access** -> *Add IP Address* -> **Allow access from anywhere (0.0.0.0/0)**.
4. **Connect -> Drivers** se connection string copy karo. Isme `<password>` ki jagah apna password likho
   aur `.net/` ke baad database ka naam likho, jaise `.net/banned-official?...`

## 2) Apne computer par chalao
```bash
npm install
cp .env.example .env     # phir .env kholo aur apni values bharo
npm start
```
Browser mein kholo: http://localhost:3000

`.env` mein:
- `MONGODB_URI` = Atlas wali string
- `ADMIN_PASSWORD` = admin panel ka password (apna mazboot password rakho)
- `JWT_SECRET` = koi bhi lambi random string

## 3) GitHub par daalo
```bash
git init && git add . && git commit -m "first"
```
GitHub par naya repo banao aur push karo. `.env` push nahi hoti (`.gitignore` mein hai).

## 4) Render par deploy (free)
1. https://render.com -> **New -> Web Service** -> apna GitHub repo chuno.
2. Build Command: `npm install`   |   Start Command: `npm start`
3. **Environment** mein teeno variables daalo: `MONGODB_URI`, `ADMIN_PASSWORD`, `JWT_SECRET`.
4. Deploy dabao. Aap ko `https://xxxx.onrender.com` link mil jayega.

Note: Render ka free plan 15 min bekaar rehne par so jata hai, pehli visit par 30-50 second lagte hain.

## Kaise kaam karta hai
- Users ke join request, tournament registration aur contact message **database mein save** hote hain.
- Navbar mein **Admin** dabao -> password daalo -> server password check karke 12 ghante ka token deta hai.
- Admin panel mein Join Requests / Registrations / Messages tabs mein sab users ka data nazar aata hai.
- Password browser ke code mein nahi hai, sirf server ke `.env` mein hai.
- Spam se bachne ke liye forms par rate limit laga hua hai.
"# Banned-Official-Esport-Site" 
