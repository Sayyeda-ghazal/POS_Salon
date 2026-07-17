# Offline POS — Deployment Guide (Windows)

Yeh app ek **offline desktop application** hai. Iska data har machine par **locally (SQLite)** rehta hai — koi server, hosting, ya internet zaroori nahi. Deployment ka matlab sirf itna hai:

> **Windows par ek installer (`.exe`) banao → salon owner ko bhejo → woh install karke use kare.** Baaki configuration (salon naam, loyalty rate, products/services) owner khud app ke **Settings** se karta hai.

Aap Karachi mein installer banao, Lahore wala owner apne PC par install kar lega.

---

## 0. Zaroori baat — Native module

Is app mein `better-sqlite3` ek **native module** hai jo har OS ke liye alag compile hota hai. Isi liye:

> **Windows ka installer hamesha ek Windows machine par banao** (jaisa aap kar rahe ho). Linux/Mac par bana `.exe` Windows par sahi nahi chalega.

`npm install` chalne par `postinstall` script khud-ba-khud `better-sqlite3` ko us machine ke Electron ke liye rebuild kar deti hai — is liye Windows par install karte hi yeh sahi ho jayega.

---

## 1. Build machine par ek baar setup (Windows)

1. **Node.js LTS** install karo (v20 ya v22): https://nodejs.org
2. **Git** (optional) ya project folder ko ZIP/USB se copy karo.
3. (Sirf agar `better-sqlite3` rebuild fail ho) **Visual Studio Build Tools** + "Desktop development with C++" install karo. Aam tor par prebuilt binary mil jaati hai, to iski zaroorat nahi padti.

---

## 2. Installer banao (`.exe`)

Project folder mein PowerShell/CMD khol kar:

```bash
npm install
npm run dist:win
```

- `npm install` — dependencies install + `better-sqlite3` ko Windows/Electron ke liye rebuild.
- `npm run dist:win` — app build karke NSIS installer banata hai.

**Output:** `release\` folder mein milega:

```
release\Offline POS Setup 0.1.0.exe
```

Yehi file salon ko bhejni hai.

> **Note:** Har nayi build se pehle `package.json` ka `"version"` barha do (jaise `0.1.0` → `0.1.1`) taaki purani/nayi build alag pehchani ja sakein.

---

## 3. Installer salon ko bhejo

Kisi bhi tareeqe se:

- **Google Drive / WeTransfer / Dropbox** — file upload karke link share karo (`.exe` ~100–200 MB hota hai).
- **USB drive** — agar koi ja raha ho.

---

## 4. Salon PC par install (Lahore)

1. `.exe` download karo aur **double-click** karo.
2. Windows **"Unknown publisher"** warning dikha sakta hai (kyunki app code-signed nahi):
   - **More info** → **Run anyway** par click karo. (App bilkul safe hai — yeh warning har unsigned app par aata hai.)
3. Install location choose karo → **Install** → **Finish / Launch**.
4. App khul jayegi. Pehli baar chalne par sample data (demo products/services/customers) seed ho jayega.

---

## 5. Pehli baar configuration (owner khud karta hai)

App ke andar **Settings** page par:

1. **Salon information** — apna salon naam, tagline, phone, email, address bharo → **Save salon info**.
   (Yeh receipt par bhi print hota hai.)
2. **Loyalty rules** — "Rupees per point (earning)" set karo (default 15 = har 15 PKR services par 1 point) aur minimum redeem points → **Save loyalty rules**.
3. **Inventory** aur **Services** pages par apne asli products/services add karo (demo wale delete kar sakte ho).
4. **Customers** add karte jao ya checkout ke waqt.

Bas — app istemaal ke liye tayyar hai.

---

## 6. Data kahan rehta hai + Backup

- Saara data locally is folder mein rehta hai (install location se **alag**):
  ```
  C:\Users\<username>\AppData\Roaming\Offline POS\offline-pos.sqlite3
  ```
- **Backup:** Settings → **Backup to Excel** → ek `salon-backup-<date>.xlsx` file save hoti hai (Excel mein khol kar dekhi ja sakti hai).
- **Restore:** Settings → **Restore from Excel** → koi purana `.xlsx` backup chun kar data wapas laaya ja sakta hai.

> Owner ko samjha do ke **haftay mein ek baar backup** le kar Google Drive/USB par rakhein — taaki PC kharab hone par data mehfooz rahe.

---

## 7. App ko baad mein update karna

Jab bhi naya version dena ho:

1. Code update karo, `package.json` mein `"version"` barha do.
2. `npm run dist:win` se naya `.exe` banao.
3. Owner ko bhejo → woh purani app ke upar install kar le.
4. **Uska data safe rehta hai** (kyunki data `AppData` mein hai, install folder mein nahi).

> Extra ehtiyat: update se pehle owner **Backup to Excel** le le, aur zaroorat pade to update ke baad **Restore** kar le.

---

## 8. (Optional) Custom app icon

Default Electron icon ki jagah apna icon chahiye to build se pehle:

```
assets\icon.ico   (256x256 .ico file)
```

`assets` folder bana kar `icon.ico` rakh do — electron-builder khud utha lega. (Icon na ho to bhi build chalta hai, bas default icon aayega.)

---

## 9. (Optional) Cloud build — GitHub Actions

Agar aage kabhi aapke paas Windows machine na ho, to code GitHub par push karke ek Windows CI runner se `.exe` cloud mein banwa sakte hain. (Yeh workflow zaroorat par set up ho sakta hai.)

---

## 10. Troubleshooting

| Masla | Hal |
|---|---|
| `better-sqlite3` / native error build par | `npm run rebuild:native` chalao, phir `npm run dist:win` |
| Install ke baad app na khule | `AppData\Roaming\Offline POS` folder delete karke dobara chalao (data reset ho jayega — pehle backup lo) |
| Port 5173 error | Yeh sirf **development** (`npm run electron:dev`) ka masla hai; **installed app** par iska koi asar nahi |
| "Unknown publisher" warning | Normal hai (unsigned app). Code-signing certificate (paid) se yeh hat sakta hai, magar zaroori nahi |

---

## Quick reference (build machine par)

```bash
# ek baar
npm install

# jab bhi naya installer banana ho
npm run dist:win
# → release\Offline POS Setup <version>.exe
```
