# Salary Calculator - Quick Reference Guide

## 🚀 Quick Start

1. **Enter Your Information**
   - Employee Name
   - Company Name
   - Select Month and Year

2. **Set Your Salary Details**
   - Base Salary (RON)
   - Fixed Base Hours (default: 160)
   - Weekend Rate Multiplier (1x, 1.25x, 1.5x, or 2x)

3. **Fill in Your Hours**
   - Use the calendar to select hours worked each day
   - Optionally select shift type (8hrs, 12hrs, Day, Night, etc.)
   - Weekend days are highlighted in red

4. **Save Your Data**
   - Click "Save This Month" to store your data locally
   - Data is automatically restored when you return

5. **Generate Report**
   - Click "Generate Report" to preview
   - Download as PDF or JPG
   - Use zoom controls to adjust preview

---

## 📊 How Calculations Work

### Hourly Rate
```
Hourly Rate = Base Salary ÷ Fixed Base Hours
Example: 3200 RON ÷ 160 hours = 20 RON/hour
```

### Weekday Pay
```
Weekday Pay = Weekday Hours × Hourly Rate
Example: 120 hours × 20 RON = 2400 RON
```

### Weekend Pay
```
Weekend Pay = Weekend Hours × Hourly Rate × Weekend Multiplier
Example: 40 hours × 20 RON × 1.5 = 1200 RON
```

### Total Salary
```
Total Salary = Weekday Pay + Weekend Pay
Example: 2400 RON + 1200 RON = 3600 RON
```

---

## 💡 Tips & Best Practices

### Data Entry
- ✅ Fill in employee and company names before saving
- ✅ Use shift selectors for quick hour entry
- ✅ Save regularly to prevent data loss
- ✅ Review the hourly breakdown before generating reports

### Report Generation
- ✅ Verify all information is correct before generating
- ✅ Use PDF for official documents (better quality)
- ✅ Use JPG for quick sharing or preview
- ✅ Check the preview before downloading

### Currency Conversion
- ✅ Enable auto-update for live exchange rates
- ✅ Or manually enter your preferred RON to INR rate
- ✅ Rates update daily from Frankfurter API

---

## 🔧 Troubleshooting

### "No hours entered" warning
- **Cause**: Calendar has no hours filled in
- **Solution**: Enter hours for at least one day, or click "Yes" to generate empty report

### "Please enter Employee Name and Company Name"
- **Cause**: Required fields are empty
- **Solution**: Fill in both fields before saving or generating report

### "Error saving data"
- **Cause**: Browser storage is full
- **Solution**: Clear old data or browser cache

### PDF/JPG not downloading
- **Cause**: Browser blocked download or generation error
- **Solution**: Check browser permissions, try again, or try different format

### Data not loading
- **Cause**: Different month selected or data not saved
- **Solution**: Verify correct month is selected, check if data was saved

---

## 📱 Keyboard Shortcuts

- **Tab**: Navigate between fields
- **Enter**: Confirm selection in dropdowns
- **Esc**: Close report preview (when focused)

---

## 💾 Data Storage

### What Gets Saved
- ✅ Hours worked each day
- ✅ Shift types selected
- ✅ Employee and company names
- ✅ Salary and rate settings
- ✅ Save timestamp

### Where It's Stored
- 📍 Browser's localStorage (local to your device)
- 📍 Not synced across devices
- 📍 Persists until you clear browser data

### Data Privacy
- 🔒 All data stays on your device
- 🔒 No data sent to any server
- 🔒 No tracking or analytics on your data

---

## 📄 Report Features

### Report Includes
- Company name (as watermark and header)
- Employee information
- Salary breakdown
- Daily work log with dates and shifts
- Total hours (weekday and weekend)
- Days worked and days off
- Signature sections for employee and employer

### Report Quality
- **PDF**: High resolution (4x), PNG format, print-ready
- **JPG**: High resolution (4x), optimized quality
- **Size**: ~800KB for PDF, ~600KB for JPG

---

## 🌐 Currency Converter

### Features
- Convert between any supported currencies
- Live exchange rates updated daily
- Popular currencies displayed (RON, USD, GBP, INR, etc.)
- Manual refresh option

### For Salary Calculation
- Auto-update toggle for RON to INR rate
- Manual override option
- Rate displayed in salary breakdown

---

## ⚙️ Settings Explained

### Fixed Base Hours
- Standard monthly working hours
- Default: 160 hours (8 hours × 20 working days)
- Used to calculate hourly rate

### Weekend Rate Multiplier
- **1x**: No extra pay for weekends
- **1.25x**: 25% extra for weekends
- **1.5x**: 50% extra for weekends (time and a half)
- **2x**: Double pay for weekends

### Shift Types
- **8 hrs / 12 hrs**: Auto-fills hours
- **Off**: Sets hours to 0
- **A/B/C**: Shift codes (auto-fills 8 hours)
- **Day/Night**: Shift types (auto-fills 12 hours)
- **OT**: Overtime (manual hour entry)

---

## 📞 Support

### Common Questions

**Q: Can I use this for multiple employees?**
A: Yes, but data is stored per month. Save each employee's data separately or use different browsers/devices.

**Q: Is my data secure?**
A: Yes, all data is stored locally on your device. Nothing is sent to any server.

**Q: Can I edit a saved month?**
A: Yes, select the month, make changes, and click "Save This Month" again.

**Q: What if I work different hours each week?**
A: Enter actual hours for each day. The calculator handles variable schedules.

**Q: Can I export to Excel?**
A: Currently only PDF and JPG. Excel export is planned for future updates.

---

## 🎯 Example Scenarios

### Scenario 1: Regular Schedule
- **Setup**: 3200 RON, 160 base hours, 1x weekend rate
- **Work**: 8 hours/day, Monday-Friday, 4 weeks
- **Result**: 160 hours × 20 RON = 3200 RON

### Scenario 2: Weekend Work
- **Setup**: 3200 RON, 160 base hours, 1.5x weekend rate
- **Work**: 120 weekday hours + 40 weekend hours
- **Result**: (120 × 20) + (40 × 20 × 1.5) = 3600 RON

### Scenario 3: Overtime Schedule
- **Setup**: 3200 RON, 160 base hours, 2x weekend rate
- **Work**: 140 weekday hours + 60 weekend hours
- **Result**: (140 × 20) + (60 × 20 × 2) = 5200 RON

---

## 🔄 Updates & Improvements

### Recent Improvements (v2.0)
- ✅ 4x higher resolution for PDF/JPG
- ✅ Improved calculation accuracy
- ✅ Better error handling and validation
- ✅ Enhanced data persistence
- ✅ Loading indicators
- ✅ Comprehensive validation

### Coming Soon
- 📅 Excel export
- 📅 Email integration
- 📅 Cloud backup option
- 📅 Statistics dashboard
- 📅 Dark mode

---

## 📋 Checklist for Perfect Report

- [ ] Employee name entered
- [ ] Company name entered
- [ ] Month and year selected
- [ ] Base salary entered
- [ ] Fixed base hours set
- [ ] Weekend rate selected
- [ ] All working days filled in
- [ ] Hours reviewed and correct
- [ ] Data saved
- [ ] Report previewed
- [ ] Downloaded in preferred format

---

**Version**: 2.0  
**Last Updated**: November 2, 2025  
**Made with ❤️ by Nishikant Xalxo**
