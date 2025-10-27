import Link from "next/link";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="min-h-screen">
          {/* Navigation Header */}
          <nav className="glass-card mx-4 mt-4 mb-8">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">G</span>
                </div>
                <h1 className="text-xl font-bold text-gradient">GhostGallery</h1>
              </div>
              <div className="flex space-x-2">
                <Link href="/" className="nav-link">🏛️ 展厅</Link>
                <Link href="/upload" className="nav-link">📤 上传作品</Link>
                <Link href="/rank" className="nav-link">🏆 艺术排行</Link>
                <Link href="/me" className="nav-link">👤 我的</Link>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="container mx-auto px-4 pb-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="text-center py-8 text-white/60">
            <p>匿名艺术作品上链展览 • 基于 FHEVM 同态加密</p>
          </footer>
        </div>
      </body>
    </html>
  );
}

