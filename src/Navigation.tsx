
import React, { useState, useEffect } from 'react';
import { Menu, X, ChevronDown, FileText, Calculator, Camera, Users, BookOpen } from 'lucide-react';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isBlogOpen, setIsBlogOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(false);
        setIsToolsOpen(false);
        setIsBlogOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const nav = document.getElementById('mobile-menu');
      const button = document.getElementById('menu-button');
      if (isOpen && nav && !nav.contains(event.target as Node) && !button?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const mainNavItems = [
    { label: 'Home', href: '#home' }
  ];

  const toolCategories = [
    {
      title: "Document Tools",
      items: [
        { label: 'Passport Photo Creator', href: '#passport-photo', icon: <Camera className="w-4 h-4" />, users: "15,000+" },
        { label: 'Resume Builder', href: '#resume-maker', icon: <FileText className="w-4 h-4" />, users: "12,000+" }
      ]
    },
    {
      title: "Financial Tools", 
      items: [
        { label: 'Salary Calculator', href: '#salary-calculator', icon: <Calculator className="w-4 h-4" />, users: "8,500+" },
        { label: 'Expense Splitter', href: '#fairshare', icon: <Users className="w-4 h-4" />, users: "5,200+" }
      ]
    }
  ];

  const blogCategories = [
    { label: 'Resume Tips & Guides', href: '#blog-resume' },
    { label: 'Salary & Finance', href: '#blog-finance' },
    { label: 'Photography & Design', href: '#blog-photo' },
    { label: 'All Articles', href: '#blog' }
  ];

  const handleNavClick = (href: string) => {
    setIsOpen(false);
    setIsToolsOpen(false);
    setIsBlogOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${
      scrolled ? 'bg-white/95 backdrop-blur-md shadow-xl border-b border-blue-200/50' : 'bg-white/90 backdrop-blur-md'
    }`}>
      <div className="container mx-auto px-4 lg:px-6">
        <div className="flex justify-between items-center h-18 lg:h-20">
          <div className="flex items-center">
            <span className="text-blue-900 text-2xl lg:text-3xl font-black tracking-tight hover:scale-110 transition-transform duration-300 cursor-pointer bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              SHADER7
            </span>
            <div className="hidden lg:block ml-4 text-sm text-blue-600 font-medium">
              Professional Tools Suite
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
            {mainNavItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.href)}
                className="text-blue-900 hover:text-blue-700 transition-all duration-300 font-semibold px-4 py-3 rounded-xl hover:bg-blue-100/50"
              >
                {item.label}
              </button>
            ))}
            
            {/* Tools Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                className="flex items-center gap-2 text-blue-900 hover:text-blue-700 transition-all duration-300 font-semibold px-4 py-3 rounded-xl hover:bg-blue-100/50"
              >
                Tools
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isToolsOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isToolsOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 py-4 z-50">
                  {toolCategories.map((category, categoryIndex) => (
                    <div key={categoryIndex} className="px-4 mb-4">
                      <div className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3 px-2">
                        {category.title}
                      </div>
                      {category.items.map((tool, toolIndex) => (
                        <button
                          key={tool.label}
                          onClick={() => handleNavClick(tool.href)}
                          className="flex items-center gap-3 w-full text-left px-3 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 rounded-xl group"
                        >
                          <div className="text-blue-600 group-hover:text-blue-700">
                            {tool.icon}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{tool.label}</div>
                            <div className="text-xs text-green-600">{tool.users} users</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Blog Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsBlogOpen(!isBlogOpen)}
                className="flex items-center gap-2 text-blue-900 hover:text-blue-700 transition-all duration-300 font-semibold px-4 py-3 rounded-xl hover:bg-blue-100/50"
              >
                <BookOpen className="w-4 h-4" />
                Blog
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isBlogOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isBlogOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-3 z-50">
                  {blogCategories.map((blog, index) => (
                    <button
                      key={blog.label}
                      onClick={() => handleNavClick(blog.href)}
                      className="block w-full text-left px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 text-sm font-medium"
                    >
                      {blog.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => handleNavClick('#about')}
              className="text-blue-900 hover:text-blue-700 transition-all duration-300 font-semibold px-4 py-3 rounded-xl hover:bg-blue-100/50"
            >
              About
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              id="menu-button"
              onClick={() => setIsOpen(!isOpen)}
              className="text-blue-900 hover:text-blue-700 transition-all duration-300 p-3 rounded-xl hover:bg-blue-100/50"
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div
          id="mobile-menu"
          className={`md:hidden absolute top-full left-0 right-0 bg-white/98 backdrop-blur-md transition-all duration-500 ease-in-out border-b border-blue-200/50 ${
            isOpen 
              ? 'opacity-100 visible transform translate-y-0' 
              : 'opacity-0 invisible transform -translate-y-2'
          }`}
        >
          <div className="px-4 py-6 space-y-2 max-h-[80vh] overflow-y-auto">
            {mainNavItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.href)}
                className="block w-full text-left text-blue-900 hover:bg-blue-100 transition-all duration-300 px-4 py-3 rounded-xl font-semibold text-lg"
              >
                {item.label}
              </button>
            ))}
            
            {/* Mobile Tools Menu */}
            <div className="pt-2 border-t border-blue-200/50">
              <div className="text-blue-700 font-bold px-4 py-2 text-sm uppercase tracking-wide">
                Tools
              </div>
              {toolCategories.map((category, categoryIndex) => (
                <div key={categoryIndex} className="ml-4 mb-4">
                  <div className="text-blue-600 font-semibold px-4 py-2 text-xs uppercase tracking-wide">
                    {category.title}
                  </div>
                  {category.items.map((tool) => (
                    <button
                      key={tool.label}
                      onClick={() => handleNavClick(tool.href)}
                      className="flex items-center gap-3 w-full text-left text-blue-800 hover:bg-blue-100 transition-all duration-300 px-6 py-3 rounded-xl text-sm"
                    >
                      {tool.icon}
                      <div>
                        <div className="font-medium">{tool.label}</div>
                        <div className="text-xs text-green-600">{tool.users} users</div>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Mobile Blog Menu */}
            <div className="pt-2 border-t border-blue-200/50">
              <div className="text-blue-700 font-bold px-4 py-2 text-sm uppercase tracking-wide">
                Blog
              </div>
              {blogCategories.map((blog) => (
                <button
                  key={blog.label}
                  onClick={() => handleNavClick(blog.href)}
                  className="block w-full text-left text-blue-800 hover:bg-blue-100 transition-all duration-300 px-6 py-3 rounded-xl text-sm font-medium"
                >
                  {blog.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleNavClick('#about')}
              className="block w-full text-left text-blue-900 hover:bg-blue-100 transition-all duration-300 px-4 py-3 rounded-xl font-semibold text-lg border-t border-blue-200/50 mt-4 pt-6"
            >
              About
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
