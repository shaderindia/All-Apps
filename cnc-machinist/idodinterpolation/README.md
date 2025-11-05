# ID/OD Helical Interpolation Generator

A professional web app for CNC machinists to generate **helical milling G-code** for **Fanuc**, **Haas**, and **Siemens** controls.  
Supports **ID/OD helical paths**, **G41/G42 cutter compensation**, and all three **planes (G17, G18, G19)** — with a live visual preview.

---

### ✨ Key Features

- ⚙️ **Dialect Presets** — Fanuc / Haas / Siemens  
  (includes G61/G64 motion modes and G28 vs G53 retract)
- 📱 **Mobile-Optimized Interface** — large touch targets, numeric input keyboard, sticky Generate/Download bar
- 🎯 **Live G-Code Preview** — CW/CCW indicator, ASCII direction arrows, and 2D circular plot showing engage point
- 🧩 **Full Interpolation Control**
  - ID & OD modes
  - Correct I/J/K sign reversal for G41/G42
  - Optional finish pass
  - Macro diameter mode (#500–#505)
  - Safety Z & XY clearance (OD)
  - Path control (G61 exact stop / G64 continuous)
  - Retract mode (G28 G91 Z0 / G53 Z0)
- 💾 **Offline Ready** — works directly in any browser, no installation or server required

---

### 🧠 How to Use

1. Open the app in your browser:  
   👉 [https://shader7.com/cnc-machinist/idodinterpolation/](https://shader7.com/cnc-machinist/idodinterpolation/)
2. Select your machining mode (ID / OD).
3. Enter tool diameter, workplane, pitch, feed, and other parameters.
4. Tap **Generate G-Code**.
5. View the preview or tap **Copy** / **Download .NC** to save your file.

---

### 🛠️ How to Host It Yourself

If you want to host or fork this project:

1. Create a new repository named **`idodinterpolation`**.  
2. Add these files:
