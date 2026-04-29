export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbyfqTWYoBnuuDSc1isnaz3sBPWaZZGt0Sn_Qlz1gQP1l9b2Xjxrb2Oecch2iLxHyVqy1g/exec';
  try {
    const response = await fetch(SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.text();
    return res.status(200).json({ result: 'success', data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
