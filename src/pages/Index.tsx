
import React from 'react';
import Header from '../components/Header';
import Navigation from '../components/Navigation';
import HeroSection from '../components/HeroSection';
import ToolsSection from '../components/ToolsSection';
import BlogSection from '../components/BlogSection';
import TrustSection from '../components/TrustSection';
import AboutSection from '../components/AboutSection';
import Footer from '../components/Footer';
import SEOHead from '../components/SEOHead';

const Index = () => {
  return (
    <>
      <SEOHead />
      <div 
        className="min-h-screen bg-slate-50 relative"
        style={{
          backgroundImage: 'url(https://i.postimg.cc/3rkTW4dd/Chat-GPT-Image-Jul-9-2025-at-12-41-09-PM.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px]"></div>
        
        <div className="relative z-10">
          <Navigation />
          <HeroSection />
          <Header />
          <main className="container mx-auto px-4 lg:px-6 py-8 sm:py-12 lg:py-16 max-w-7xl">
            <ToolsSection />
            <TrustSection />
            <BlogSection />
            <AboutSection />
          </main>
          <Footer />
        </div>
      </div>
    </>
  );
};

export default Index;
