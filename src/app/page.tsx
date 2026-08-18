'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  MessageCircle,
  MonitorPlay,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/AuthProvider';
import { cn, focusRing, surface } from '@/lib/ui';

const FEATURES = [
  {
    icon: MonitorPlay,
    title: 'Playback that stays in sync',
    body: 'The host drives play, pause and seek. Everyone else follows within a fraction of a second, no counting down out loud.',
  },
  {
    icon: MessageCircle,
    title: 'Chat and reactions in the room',
    body: 'Talk over the film without talking over the film. Reactions float past the screen; the conversation persists.',
  },
  {
    icon: Video,
    title: 'See each other',
    body: 'Peer-to-peer video and audio alongside the movie, so you catch the reaction as well as the message.',
  },
  {
    icon: Users,
    title: 'Your room, your rules',
    body: 'Public rooms anyone can browse, or private ones behind a code with the host approving each arrival.',
  },
];

const STEPS = [
  { n: '01', title: 'Pick something to watch', body: 'Browse the library or bring your own upload.' },
  { n: '02', title: 'Open a room', body: 'Name it, set who can join, share the code or a link.' },
  { n: '03', title: 'Press play together', body: 'Everyone lands in the same second of the same film.' },
];

export default function LandingPage() {
  const router = useRouter();
  const { status } = useAuth();

  // Signed-in visitors get the library rather than the pitch.
  useEffect(() => {
    if (status === 'authenticated') router.replace('/library');
  }, [status, router]);

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-white">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0D0D0F]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#695CFF]">
              <Video className="h-5 w-5" />
            </span>
            <span className="text-lg font-medium tracking-tight">ConnectUs</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/auth"
              className={cn(
                'rounded-xl px-4 py-2 text-sm text-white/70 transition-colors hover:text-white',
                focusRing,
              )}
            >
              Sign in
            </Link>
            <Button
              onClick={() => router.push('/auth')}
              className="h-10 rounded-xl bg-[#695CFF] px-4 hover:bg-[#5a4de6]"
            >
              Get started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-[#695CFF]/20 blur-[120px]" />

        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/70">
              <Sparkles className="h-3.5 w-3.5 text-[#8B7FFF]" />
              Watch together, from anywhere
            </span>

            <h1 className="mt-8 text-4xl leading-[1.1] tracking-tight sm:text-6xl">
              Movie night doesn&apos;t need
              <br />
              everyone in one room.
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/60">
              ConnectUs keeps the film in sync across every screen, and puts the chat, the
              reactions and everyone&apos;s faces right next to it.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                onClick={() => router.push('/auth')}
                className="h-12 w-full rounded-xl bg-[#695CFF] px-8 hover:bg-[#5a4de6] sm:w-auto"
              >
                Start a watch party
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                onClick={() => router.push('/auth?next=/rooms')}
                variant="outline"
                className="h-12 w-full rounded-xl border-white/15 bg-transparent px-8 text-white hover:bg-white/5 sm:w-auto"
              >
                Join with a code
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: index * 0.06 }}
              className={cn(surface, 'p-6')}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#695CFF]/15">
                <feature.icon className="h-5 w-5 text-[#8B7FFF]" />
              </span>
              <h3 className="mt-4 text-lg tracking-tight">{feature.title}</h3>
              <p className="mt-2 leading-relaxed text-white/60">{feature.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl tracking-tight">Three steps to press play</h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n}>
              <span className="font-mono text-sm text-[#8B7FFF]">{step.n}</span>
              <h3 className="mt-3 text-xl tracking-tight">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-white/60">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#695CFF] to-[#5a4de6] p-10 text-center sm:p-16">
          <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <h2 className="text-3xl tracking-tight sm:text-4xl">Get everyone on the same scene</h2>
            <p className="mx-auto mt-4 max-w-lg text-white/80">
              Free to start. No extension to install, no downloads for your friends.
            </p>
            <Button
              onClick={() => router.push('/auth')}
              className="mt-8 h-12 rounded-xl bg-white px-8 text-[#695CFF] hover:bg-white/90"
            >
              Create your account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-white/40 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} ConnectUs</p>
          <p>Films provided under public-domain and open licences.</p>
        </div>
      </footer>
    </div>
  );
}
