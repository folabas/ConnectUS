import { motion } from 'framer-motion';
import { Play, Users, Video, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';

import { Screen } from '../App';

interface LandingPageProps {
  onNavigate: (screen: Screen) => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-white overflow-hidden">
      {/* Navigation */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-50 px-8 py-6 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center">
            <Video className="w-5 h-5" />
          </div>
          <span className="text-xl tracking-tight">ConnectUs</span>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => scrollToSection('features')}
            className="text-white/60 hover:text-white transition-colors"
          >
            Features
          </button>
          <button
            onClick={() => scrollToSection('how-it-works')}
            className="text-white/60 hover:text-white transition-colors"
          >
            How it works
          </button>
          <button
            onClick={() => scrollToSection('pricing')}
            className="text-white/60 hover:text-white transition-colors"
          >
            Pricing
          </button>
          <Button
            onClick={() => onNavigate('auth')}
            className="bg-white text-black hover:bg-white/90 rounded-full px-6"
          >
            Sign In
          </Button>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <div className="relative px-8 pt-20 pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-xl border border-white/10">
                <Sparkles className="w-4 h-4 text-[#695CFF]" />
                <span className="text-sm text-white/80">Watch together, anywhere</span>
              </div>

              <h1 className="text-7xl leading-[1.1] tracking-tight">
                Movie nights,
                <br />
                <span className="bg-gradient-to-r from-[#695CFF] via-[#8B7FFF] to-[#A99FFF] bg-clip-text text-transparent">
                  together
                </span>
              </h1>

              <p className="text-xl text-white/60 leading-relaxed max-w-md">
                Stream movies in perfect sync with friends. Real-time chat, reactions, and video calls — all in one beautiful platform.
              </p>

              <div className="flex items-center gap-4">
                <Button
                  onClick={() => onNavigate('auth')}
                  className="bg-[#695CFF] hover:bg-[#5a4de6] text-white rounded-full px-8 py-6 group"
                >
                  Start Watching
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/5 rounded-full px-8 py-6"
                >
                  See how it works
                </Button>
              </div>
            </motion.div>

            {/* Right Illustration */}
            <motion.div
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="relative"
            >
              <div className="relative aspect-square">
                {/* Floating Cards */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-0 right-0 w-64 h-80 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-2xl"
                >
                  <div className="w-full h-40 rounded-2xl bg-gradient-to-br from-[#695CFF]/20 to-[#8B7FFF]/20 mb-4" />
                  <div className="space-y-3">
                    <div className="h-3 bg-white/20 rounded-full w-3/4" />
                    <div className="h-3 bg-white/10 rounded-full w-1/2" />
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  className="absolute bottom-0 left-0 w-72 h-48 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-2xl"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#695CFF] to-[#8B7FFF]" />
                    <div className="flex-1">
                      <div className="h-3 bg-white/20 rounded-full w-24 mb-2" />
                      <div className="h-2 bg-white/10 rounded-full w-16" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 bg-white/10 rounded-full" />
                    <div className="h-2 bg-white/10 rounded-full w-5/6" />
                  </div>
                </motion.div>

                {/* Ambient Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#695CFF]/20 via-transparent to-[#8B7FFF]/20 blur-3xl -z-10" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="px-8 py-32 bg-gradient-to-b from-transparent to-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl mb-4 tracking-tight">Everything you need</h2>
            <p className="text-xl text-white/60">Designed for seamless watching experiences</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Play className="w-6 h-6" />,
                title: "Perfect Sync",
                description: "Watch in perfect harmony with real-time synchronization"
              },
              {
                icon: <Users className="w-6 h-6" />,
                title: "Video Calls",
                description: "See reactions with built-in video chat for everyone"
              },
              {
                icon: <Video className="w-6 h-6" />,
                title: "Any Platform",
                description: "Works with your favorite streaming services seamlessly"
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ y: 40, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-colors group"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-2xl mb-3">{feature.title}</h3>
                <p className="text-white/60 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div id="how-it-works" className="px-8 py-32">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl mb-4 tracking-tight">How it works</h2>
            <p className="text-xl text-white/60">Get started in three simple steps</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: '01',
                title: 'Create or Join',
                description: 'Start a new room or join your friends with a simple link'
              },
              {
                step: '02',
                title: 'Pick a Movie',
                description: 'Choose from your favorite streaming platforms'
              },
              {
                step: '03',
                title: 'Watch Together',
                description: 'Enjoy perfectly synced playback with live chat and video'
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ y: 40, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-6xl mb-6 bg-gradient-to-r from-[#695CFF] to-[#8B7FFF] bg-clip-text text-transparent opacity-30">
                  {item.step}
                </div>
                <h3 className="text-2xl mb-3">{item.title}</h3>
                <p className="text-white/60 leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="pricing" className="px-8 py-32 bg-gradient-to-b from-transparent to-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl mb-4 tracking-tight">Simple pricing</h2>
            <p className="text-xl text-white/60">Choose the plan that works for you</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: 'Free',
                price: '$0',
                features: ['Up to 4 participants', 'HD streaming', 'Chat & reactions', 'Basic support']
              },
              {
                name: 'Pro',
                price: '$9',
                features: ['Up to 12 participants', '4K streaming', 'Video calls', 'Custom themes', 'Priority support'],
                featured: true
              },
              {
                name: 'Team',
                price: '$29',
                features: ['Unlimited participants', '4K streaming', 'Advanced features', 'White-label option', '24/7 support']
              }
            ].map((plan, index) => (
              <motion.div
                key={index}
                initial={{ y: 40, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`p-8 rounded-3xl border transition-all ${plan.featured
                    ? 'bg-gradient-to-br from-[#695CFF]/20 to-[#8B7FFF]/10 border-[#695CFF] scale-105'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
              >
                <h3 className="text-2xl mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-5xl">{plan.price}</span>
                  <span className="text-white/60">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="text-white/60 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#695CFF]" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => onNavigate('auth')}
                  className={`w-full rounded-2xl ${plan.featured
                      ? 'bg-[#695CFF] hover:bg-[#5a4de6] text-white'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                >
                  Get Started
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}