import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[#f3f6fb] dark:bg-darkbg">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 pb-6 pt-1 lg:px-8 lg:pb-8">
          <div className="mx-auto w-full max-w-[1920px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
