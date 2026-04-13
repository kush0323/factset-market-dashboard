import './globals.css';

export const metadata = {
  title: 'FactSet Market Dashboard',
  description: 'Interactive market dashboard built from FactSet email alerts.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
