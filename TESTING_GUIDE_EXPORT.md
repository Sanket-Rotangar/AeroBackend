# Testing Guide - Data Export Enhancement

## Quick Test Checklist

### Backend API Testing

#### 1. Test Unlimited Sensor Data Export
```bash
# Start the backend server
npm start

# Test with curl (replace <token> with actual JWT token)
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/sensor-data?limit=0"
```

Expected: Returns all sensor data records without limit

#### 2. Test Unlimited Logs Export
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/logs?limit=0"
```

Expected: Returns all system logs without limit

### Frontend Testing

#### 1. Real-Time Data Page
- [ ] Navigate to Real-Time Data page
- [ ] Verify data loads without 100 record limit
- [ ] Click "Export CSV" button
- [ ] Verify CSV file downloads with name format: `sensor-data-YYYY-MM-DD.csv`
- [ ] Open CSV in Excel/Google Sheets
- [ ] Verify columns: Timestamp, Source ID, Source Type, Gateway ID, Data
- [ ] Click "Export JSON" button (existing feature)
- [ ] Verify JSON export still works

#### 2. Devices Page
- [ ] Navigate to Devices page
- [ ] Verify all devices are loaded
- [ ] Click "Export CSV" button
- [ ] Verify CSV downloads with name: `devices-YYYY-MM-DD.csv`
- [ ] Open CSV and verify columns:
  - Device ID
  - Device Name
  - Type
  - Location
  - Status
  - Firmware Version
  - Last Seen
- [ ] Verify button is disabled when no data

#### 3. Gateways Page
- [ ] Navigate to Gateways page
- [ ] Verify all gateways are loaded
- [ ] Click "Export CSV" button
- [ ] Verify CSV downloads with name: `gateways-YYYY-MM-DD.csv`
- [ ] Open CSV and verify columns:
  - Gateway ID
  - Gateway Name
  - Status
  - Node Count
  - Last Seen

#### 4. System Logs Page
- [ ] Navigate to System Logs page
- [ ] Verify all logs are loaded
- [ ] Click "Export CSV" button
- [ ] Verify CSV downloads with name: `system-logs-YYYY-MM-DD.csv`
- [ ] Open CSV and verify columns:
  - Timestamp
  - Level
  - Category
  - Message
  - Source ID
  - Details

#### 5. Test with Filters
- [ ] Apply filters on any page (e.g., search term, date range)
- [ ] Click "Export CSV"
- [ ] Verify only filtered data is exported
- [ ] Clear filters
- [ ] Export again and verify all data is exported

### Edge Cases to Test

#### Large Dataset Testing
- [ ] Test export with 1000+ records
- [ ] Verify browser doesn't freeze
- [ ] Check CSV file opens correctly
- [ ] Monitor browser memory usage

#### Special Characters Testing
- [ ] Create test data with:
  - Commas in fields
  - Quotes in fields
  - Newlines in messages
- [ ] Export to CSV
- [ ] Verify CSV parsing works correctly in Excel

#### Empty Data Testing
- [ ] Filter data to show no results
- [ ] Verify "Export CSV" button is disabled
- [ ] Verify "Export JSON" button is disabled

#### JSON Data Testing
- [ ] Verify complex JSON objects in sensor data are properly serialized in CSV
- [ ] Check that nested JSON is readable

### Performance Benchmarks

| Data Size | Expected Load Time | Expected Export Time |
|-----------|-------------------|---------------------|
| 100 records | < 1 second | < 1 second |
| 1,000 records | < 2 seconds | < 2 seconds |
| 10,000 records | < 5 seconds | < 5 seconds |

### Browser Compatibility

Test in these browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari

### Expected File Formats

#### CSV Format Example
```csv
Device ID,Device Name,Type,Location,Status,Firmware Version,Last Seen
"DEV001","Sensor 1","Temperature","Building A","online","v1.2.0","1/31/2026, 10:30:00 AM"
"DEV002","Sensor 2","Humidity","Building B","offline","v1.1.5","1/30/2026, 5:45:00 PM"
```

#### JSON Format Example (existing)
```json
[
  {
    "device_id": "DEV001",
    "device_name": "Sensor 1",
    "device_type": "Temperature",
    "location": "Building A",
    "status": "online",
    "firmware_version": "v1.2.0",
    "last_seen": "2026-01-31T10:30:00.000Z"
  }
]
```

## Common Issues and Solutions

### Issue 1: Export button not showing
**Solution**: Clear browser cache and reload the page

### Issue 2: CSV has wrong encoding
**Solution**: The CSV is UTF-8 encoded. Open in Excel using "Data" → "From Text/CSV" and select UTF-8 encoding

### Issue 3: Download doesn't start
**Solution**: Check browser's download settings and disable popup blocker for the site

### Issue 4: Data seems truncated
**Solution**: Verify backend server is running and check browser console for API errors

## Success Criteria

All tests pass when:
1. ✅ All data exports without artificial limits
2. ✅ CSV and JSON formats both work
3. ✅ Export buttons appear on all pages
4. ✅ Special characters are properly escaped
5. ✅ Filtered data exports correctly
6. ✅ Large datasets export without errors
7. ✅ File naming follows correct pattern
8. ✅ No console errors during export

## Rollback Plan

If issues are found:

1. Backend rollback:
```bash
git checkout HEAD~1 -- src/routes/api.routes.js
git checkout HEAD~1 -- src/services/database.mongodb.service.js
```

2. Frontend rollback:
```bash
git checkout HEAD~1 -- admin-dashboard/src/pages/*.jsx
```

3. Restart services:
```bash
npm start
cd admin-dashboard && npm run dev
```
