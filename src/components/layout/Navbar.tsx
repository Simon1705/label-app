'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiUser, FiLogOut, FiMenu, FiX, FiHome, FiDatabase, FiTag, FiUsers, FiGrid, FiPlusCircle } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      const offset = window.scrollY;
      if (offset > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const NavLink = ({ href, children, icon }: { href: string; children: React.ReactNode; icon?: React.ReactNode }) => {
    const isActive = pathname === href;
    return (
      <Link 
        href={href}
        className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
          isActive 
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' 
            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400'
        }`}
      >
        {icon && <span className="mr-2">{icon}</span>}
        {children}
        {isActive && (
          <motion.div
            layoutId="navbar-indicator"
            className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 hidden"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        )}
      </Link>
    );
  };

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className={`sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm transition-all duration-200 ${
        scrolled ? 'shadow-md' : 'shadow-sm border-b border-gray-200 dark:border-gray-800'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href={user ? (isAdmin ? '/admin/dashboard' : '/dashboard') : '/'} 
              className="flex-shrink-0 flex items-center group"
            >
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl mr-2 shadow-md group-hover:shadow-lg transition-all">
                L
              </div>
              <div className="flex flex-col">
                <motion.span 
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
                >
                  LabelApp
                </motion.span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 -mt-1">By MoN</span>
              </div>
            </Link>
            
            {/* Desktop Navigation */}
            {user && (
              <div className="hidden md:ml-8 md:flex md:space-x-2 relative">
                {isAdmin ? (
                  <>
                    <NavLink href="/admin/dashboard" icon={<FiGrid />}>Dashboard</NavLink>
                    <NavLink href="/admin/users" icon={<FiUsers />}>Users</NavLink>
                    <NavLink href="/admin/datasets" icon={<FiDatabase />}>Datasets</NavLink>
                  </>
                ) : (
                  <>
                    <NavLink href="/dashboard" icon={<FiHome />}>Dashboard</NavLink>
                    <NavLink href="/datasets" icon={<FiDatabase />}>My Datasets</NavLink>
                    <NavLink href="/datasets/join" icon={<FiPlusCircle />}>Join Dataset</NavLink>
                    <NavLink href="/labeling" icon={<FiTag />}>Labeling</NavLink>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Desktop User Menu */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-1.5">
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-2">
                    <FiUser size={14} />
                  </div>
                  <span>{user.username}</span>
                  {isAdmin && (
                    <span className="ml-2 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded-full shadow-sm">
                      Admin
                    </span>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={logout}
                  className="text-gray-700 dark:text-gray-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors cursor-pointer"
                >
                  <FiLogOut className="mr-1" /> Logout
                </Button>
              </div>
            ) : (
              <Link 
                href="/" 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-md transition-all px-4 py-2 rounded-full font-medium text-sm"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center">
            <button
              type="button"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
              onClick={toggleMenu}
              aria-label="Toggle menu"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isMenuOpen ? 'close' : 'open'}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {isMenuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
                </motion.div>
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu with animation */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            className="md:hidden bg-white dark:bg-gray-900 overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="px-3 pt-3 pb-3 space-y-2">
              {user && (
                isAdmin ? (
                  <>
                    <NavLink href="/admin/dashboard" icon={<FiGrid />}>Dashboard</NavLink>
                    <NavLink href="/admin/users" icon={<FiUsers />}>Users</NavLink>
                    <NavLink href="/admin/datasets" icon={<FiDatabase />}>Datasets</NavLink>
                  </>
                ) : (
                  <>
                    <NavLink href="/dashboard" icon={<FiHome />}>Dashboard</NavLink>
                    <NavLink href="/datasets" icon={<FiDatabase />}>My Datasets</NavLink>
                    <NavLink href="/datasets/join" icon={<FiPlusCircle />}>Join Dataset</NavLink>
                    <NavLink href="/labeling" icon={<FiTag />}>Labeling</NavLink>
                  </>
                )
              )}
            </div>
            <div className="pt-3 pb-3 border-t border-gray-200 dark:border-gray-800">
              {user ? (
                <div className="px-3 space-y-2">
                  <div className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-2">
                      <FiUser size={14} />
                    </div>
                    <span>{user.username}</span>
                    {isAdmin && (
                      <span className="ml-2 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded-full shadow-sm">
                        Admin
                      </span>
                    )}
                  </div>
                  <button
                    onClick={logout}
                    className="flex w-full items-center px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                  >
                    <FiLogOut className="mr-2" /> Logout
                  </button>
                </div>
              ) : (
                <div className="px-3">
                  <Link
                    href="/"
                    className="block px-3 py-2 rounded-lg text-center text-sm font-medium bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-md transition-all"
                  >
                    Login
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
} 