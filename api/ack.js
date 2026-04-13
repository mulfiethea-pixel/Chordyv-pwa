const { google } = require('googleapis');

export default async function handler(req, res) {
  // Hanya terima metode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { purchaseToken, productId } = req.body;
    const packageName = 'io.github.mulfiethea_pixel.twa'; // Nama package kamu

    // Ambil kunci rahasia dari Environment Variables yang kita input tadi
    const authData = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    
    const auth = new google.auth.JWT(
      authData.client_email,
      null,
      authData.private_key,
      ['https://www.googleapis.com/auth/androidpublisher']
    );

    const publisher = google.androidpublisher({ version: 'v3', auth });

    // Proses Acknowledge ke Google Play
    await publisher.purchases.products.acknowledge({
      packageName,
      productId,
      token: purchaseToken,
    });

    return res.status(200).json({ success: true, message: 'Purchase acknowledged successfully!' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
