module.exports = (req, res) => {
  const config = {
    WEB3FORMS_ACCESS_KEY: process.env.WEB3FORMS_ACCESS_KEY || '',
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    MAX_SEATS: process.env.MAX_SEATS || '100',
    STORAGE_BUCKET: process.env.STORAGE_BUCKET || 'payment-screenshots',
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 200;
  res.end(JSON.stringify(config));
};
