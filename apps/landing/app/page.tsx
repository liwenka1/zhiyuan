export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-7xl dark:text-white">纸鸢笔记</h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">优雅的 Markdown 编辑器，让写作更专注</p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <a
            href="#download"
            className="rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            立即下载
          </a>
          <a href="#features" className="text-sm leading-6 font-semibold text-gray-900 dark:text-white">
            了解更多 <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
          核心功能
        </h2>
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">实时预览</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">所见即所得的 Markdown 编辑体验</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">多格式导出</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">支持导出 PDF、HTML、图片等多种格式</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">跨平台支持</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">支持 Windows、macOS、Linux 三大平台</p>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="container mx-auto px-4 py-20">
        <div className="rounded-2xl bg-blue-600 px-6 py-16 text-center shadow-xl sm:px-16">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">开始使用纸鸢笔记</h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-blue-100">选择适合你的平台，立即下载体验</p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <a
              href="#"
              className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-blue-600 shadow-sm hover:bg-gray-50"
            >
              Windows
            </a>
            <a
              href="#"
              className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-blue-600 shadow-sm hover:bg-gray-50"
            >
              macOS
            </a>
            <a
              href="#"
              className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-blue-600 shadow-sm hover:bg-gray-50"
            >
              Linux
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12 text-center text-sm text-gray-600 dark:text-gray-400">
        <p>© 2025 纸鸢笔记. All rights reserved.</p>
      </footer>
    </div>
  );
}
