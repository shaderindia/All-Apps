
import React from 'react';
import { ArrowRight, CheckCircle, Users, Calculator, Camera, FileText, Star, TrendingUp } from 'lucide-react';

const HeroSection = () => {
  const toolCategories = [
    {
      title: "Document Tools",
      tools: [
        { icon: <Camera className="w-5 h-5" />, name: "Passport Photo Creator", users: "15,000+", description: "Create professional passport photos instantly" },
        { icon: <FileText className="w-5 h-5" />, name: "Resume Builder", users: "12,000+", description: "Build stunning resumes for engineers" }
      ]
    },
    {
      title: "Financial Tools", 
      tools: [
        { icon: <Calculator className="w-5 h-5" />, name: "Salary Calculator", users: "8,500+", description: "Calculate Romanian net salary" },
        { icon: <Users className="w-5 h-5" />, name: "Expense Splitter", users: "5,200+", description: "Split shared expenses fairly" }
      ]
    }
  ];

  const trustStats = [
    { icon: <Users className="w-6 h-6" />, value: "40,000+", label: "Happy Users" },
    { icon: <Star className="w-6 h-6" />, value: "4.9/5", label: "User Rating" },
    { icon: <TrendingUp className="w-6 h-6" />, value: "100%", label: "Free Forever" }
  ];

  return (
    <section className="w-full py-16 sm:py-20 lg:py-24 mt-16">
      <div className="container mx-auto px-4 lg:px-6">
        {/* Main Hero Content */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-100/80 backdrop-blur-sm text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Star className="w-4 h-4 fill-current" />
            Trusted by 40,000+ professionals worldwide
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-blue-900 via-purple-800 to-blue-900 bg-clip-text text-transparent">
              Free Professional Tools
            </span>
            <br />
            <span className="text-blue-900">for Everyone</span>
          </h1>
          
          <p className="text-xl sm:text-2xl lg:text-3xl text-blue-700 mb-8 max-w-4xl mx-auto leading-relaxed">
            Create passport photos, calculate salaries, build resumes, and split expenses - all completely free with professional results.
          </p>

          {/* Trust Stats */}
          <div className="flex flex-wrap justify-center gap-8 mb-12">
            {trustStats.map((stat, index) => (
              <div key={index} className="flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-4 border border-blue-200/50 shadow-lg">
                <div className="text-blue-600">{stat.icon}</div>
                <div className="text-left">
                  <div className="text-2xl font-bold text-blue-900">{stat.value}</div>
                  <div className="text-sm text-blue-600">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Main CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <a 
              href="#tools" 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-10 py-5 rounded-full font-bold text-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-300/50 shadow-xl"
            >
              Explore All Tools
              <ArrowRight className="w-6 h-6" />
            </a>
            
            <div className="flex items-center gap-2 text-blue-700 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-semibold">100% Free • No Registration Required</span>
            </div>
          </div>
        </div>

        {/* Tool Categories Preview */}
        <div className="max-w-6xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-center text-blue-900 mb-12">Choose Your Tool Category</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {toolCategories.map((category, categoryIndex) => (
              <div key={categoryIndex} className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 border border-blue-200/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
                <h3 className="text-2xl font-bold text-blue-900 mb-6 text-center">{category.title}</h3>
                <div className="space-y-4">
                  {category.tools.map((tool, toolIndex) => (
                    <div key={toolIndex} className="flex items-center gap-4 p-4 bg-blue-50/80 rounded-2xl hover:bg-blue-100/80 transition-colors duration-200">
                      <div className="text-blue-600 bg-white rounded-xl p-3 shadow-md">
                        {tool.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-blue-900">{tool.name}</div>
                        <div className="text-sm text-blue-600">{tool.description}</div>
                        <div className="text-xs text-green-600 font-medium">{tool.users} users</div>
                      </div>
                      <button className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-blue-700 transition-colors duration-200">
                        Use Now
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Featured Banner Image */}
        <div className="max-w-5xl mx-auto">
          <div className="relative">
            <img 
              src="https://i.postimg.cc/3rkTW4dd/Chat-GPT-Image-Jul-9-2025-at-12-41-09-PM.png"
              alt="SHADER7 Professional Tools Suite - Create, Calculate, Build with AI"
              className="w-full h-auto rounded-3xl shadow-2xl hover:scale-[1.02] transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 to-transparent rounded-3xl"></div>
            <div className="absolute bottom-6 left-6 right-6 text-center">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl">
                <h3 className="text-xl font-bold text-blue-900 mb-2">
                  "This helped me prepare my job application perfectly!"
                </h3>
                <p className="text-blue-600 text-sm">- Sarah M., Software Engineer</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
