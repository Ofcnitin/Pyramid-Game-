import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {title:'Pyramid Game — Ranks Reveal People',description:'A social strategy game of choices, perception and consequence.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
