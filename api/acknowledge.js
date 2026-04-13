const { google } = require('googleapis');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { purchaseToken, productId } = req.body;

  // Cek apakah data lengkap
  if (!purchaseToken || !productId) {
    return res.status(400).json({ error: 'Missing purchaseToken or productId' });
  }

  try {
    // 1. Setup Auth menggunakan Environment Variables di Vercel
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const androidPublisher = google.androidpublisher({
      version: 'v3',
      auth,
    });

    // 2. Kirim perintah Acknowledge ke Google Play
    // Sesuaikan package name dengan milik ChordyV
    await androidPublisher.purchases.products.acknowledge({
      packageName: 'io.github.mulfiethea_pixel.twa', // Pastikan ini sesuai package name-mu
      productId: productId,
      purchaseToken: purchaseToken,
    });

    return res.status(200).json({ success: true, message: 'Purchase acknowledged successfully!' });
  } catch (error) {
    console.error('Error acknowledging purchase:', error);
    return res.status(500).json({ error: error.message });
  }
}
