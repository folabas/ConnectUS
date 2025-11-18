import { motion } from 'framer-motion';
import { ArrowLeft, Bell, Volume2, Video, Globe, Lock, Moon, Palette } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Screen } from '../App';

interface SettingsProps {
  onNavigate: (screen: Screen) => void;
}

const settingsSections = [
  {
    title: 'Notifications',
    icon: Bell,
    settings: [
      { id: 'notif-sessions', label: 'Session invitations', enabled: true },
      { id: 'notif-messages', label: 'Chat messages', enabled: true },
      { id: 'notif-starting', label: 'Room starting soon', enabled: false }
    ]
  },
  {
    title: 'Video & Audio',
    icon: Video,
    settings: [
      { id: 'video-hd', label: 'HD quality by default', enabled: true },
      { id: 'audio-auto', label: 'Auto-adjust volume', enabled: false },
      { id: 'video-cam', label: 'Camera on by default', enabled: false }
    ]
  },
  {
    title: 'Privacy',
    icon: Lock,
    settings: [
      { id: 'privacy-profile', label: 'Public profile', enabled: true },
      { id: 'privacy-history', label: 'Show watch history', enabled: true },
      { id: 'privacy-online', label: 'Show online status', enabled: true }
    ]
  },
  {
    title: 'Appearance',
    icon: Palette,
    settings: [
      { id: 'theme-dark', label: 'Dark mode', enabled: true },
      { id: 'theme-compact', label: 'Compact view', enabled: false },
      { id: 'theme-animations', label: 'Enable animations', enabled: true }
    ]
  }
];

export function Settings({ onNavigate }: SettingsProps) {
  return (
    <div className="min-h-screen bg-[#0D0D0F] text-white">
      {/* Header */}
      <nav className="px-8 py-6 border-b border-white/5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => onNavigate('library')}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </nav>

      <div className="px-8 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-12"
          >
            <h1 className="text-4xl mb-3 tracking-tight">Settings</h1>
            <p className="text-white/60 text-lg">Manage your preferences and account</p>
          </motion.div>

          {/* Settings Sections */}
          <div className="space-y-6">
            {settingsSections.map((section, sectionIndex) => (
              <motion.div
                key={section.title}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: sectionIndex * 0.1 }}
                className="p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#695CFF]/20 to-[#8B7FFF]/20 flex items-center justify-center">
                    <section.icon className="w-5 h-5 text-[#695CFF]" />
                  </div>
                  <h2 className="text-xl tracking-tight">{section.title}</h2>
                </div>

                <div className="space-y-4">
                  {section.settings.map((setting, index) => (
                    <div
                      key={setting.id}
                      className={`flex items-center justify-between py-4 ${
                        index !== section.settings.length - 1 ? 'border-b border-white/5' : ''
                      }`}
                    >
                      <label htmlFor={setting.id} className="text-white/80 cursor-pointer">
                        {setting.label}
                      </label>
                      <Switch id={setting.id} defaultChecked={setting.enabled} />
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}

            {/* Account Actions */}
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10"
            >
              <h2 className="text-xl mb-6 tracking-tight">Account</h2>
              
              <div className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 border-white/10 hover:bg-white/5 rounded-2xl text-white"
                >
                  Change Password
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 border-white/10 hover:bg-white/5 rounded-2xl text-white"
                >
                  Export Data
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 border-red-500/20 hover:bg-red-500/10 rounded-2xl text-red-500"
                >
                  Delete Account
                </Button>
              </div>
            </motion.div>

            {/* Sign Out */}
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Button
                onClick={() => onNavigate('landing')}
                className="w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white"
              >
                Sign Out
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
