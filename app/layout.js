import './globals.css';

export const metadata = {
  title: 'Mantra Sangraha — your offline book of mantras',
  description:
    'Ad-free. Search a Hindu mantra or sloka, fetch the clean Devanagari from open public-domain sources, file it into your own book, and read it offline in a held foldable book with the words following the chant.',
  applicationName: 'Mantra Sangraha',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Mantra Sangraha', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/icons/apple-180.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0518',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.24.0/dist/tabler-icons.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
