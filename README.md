# เว็บดูหุ้นสหรัฐ (แนวรับ-แนวต้าน, ข่าวแยกหมวด, วิเคราะห์แนวโน้ม, งบ) v3

ใช้ฟรีทั้งหมด: Finnhub (ราคา/ข่าว/งบ/ค้นหา) + Yahoo Finance (กราฟย้อนหลัง) + Vercel (โฮสต์)

## โครงสร้างไฟล์ (api และ public ต้องอยู่ระดับบนสุดของ repo)
```
api/     _lib.js _news.js analyze.js candles.js financials.js metrics.js news.js quote.js search.js
public/  index.html
package.json  vercel.json
```

## อัปเดตจาก v2
แทนที่ไฟล์ทั้งหมดด้วยไฟล์ใน zip นี้ (มีไฟล์ใหม่ api/_news.js และ api/analyze.js และ vercel.json เปลี่ยน) แล้ว push

## Environment Variables (ตั้งใน Vercel > Settings > Environment Variables แล้ว Redeploy)
- FINNHUB_KEY  (จำเป็น) จาก finnhub.io
- ANTHROPIC_API_KEY  (ไม่บังคับ) เปิดปุ่ม "วิเคราะห์เชิงลึกด้วย AI" ในการ์ดวิเคราะห์แนวโน้ม
- ANTHROPIC_MODEL  (ไม่บังคับ) ค่าเริ่มต้น claude-haiku-5-5

## สิ่งที่เปลี่ยนใน v3
1. แนวรับ-แนวต้าน: ค่าเริ่มต้นเป็น Swing High/Low + ถ่วงน้ำหนักวอลุ่ม (ราคากลางของโซน), ตาราง S1-S5 / R1-R3 และเส้น R4 บนกราฟ,
   เหนือจุดสูงสุดเดิมต่อด้วย Fibonacci Extension, มีช่อง "จดจำจำนวนเงินนี้ไว้" และ "ใช้ราคาปัจจุบันเป็น S0"
2. EMA/RSI ไม่ขาดใน TF week/month: ดึงข้อมูลย้อนหลังเกินช่วงที่โชว์ แล้วคำนวณ EMA20/50/200 และ RSI จากข้อมูลทั้งชุด
3. ตัวเลือกแบบเดียวกับตัวอย่าง: รูปแบบกราฟ, Overlays (EMA 20/50/200), ระยะ (1M 3M 6M YTD 1Y 2Y 5Y MAX), TF (day/week/month), ล็อกกราฟ
4. ข่าวแยกหมวด (ผลประกอบการ, ดีล, กฎหมาย, นักวิเคราะห์ ฯลฯ) พร้อมความรู้สึก บวก/ลบ/กลาง และระดับผลกระทบ สูง/กลาง/ต่ำ
   + การ์ดวิเคราะห์แนวโน้มบริษัท (จากงบ มูลค่า ข่าว) และสรุปเชิงลึกด้วย AI แบบเลือกเปิดได้

## ทดสอบ
/api/quote?symbol=AAPL  /api/news?symbol=AAPL  /api/analyze?symbol=AAPL  ต้องได้ JSON

ข้อมูลล่าช้าและไม่ใช่คำแนะนำการลงทุน
