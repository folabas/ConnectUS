'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Gauge,
  Lock,
  MessageSquare,
  Radio,
  Users,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/Logo';
import { Reveal, RevealGroup } from '@/components/landing/Reveal';
import { SyncVisual } from '@/components/landing/SyncVisual';
import { useAuth } from '@/providers/AuthProvider';
import { EASE } from '@/lib/motion';
import { cn, focusRing } from '@/lib/ui';

/**
 * Smooth scrolling is a progressive enhancement, so it is code-split and never
 * blocks first paint. It also opts itself out on touch and reduced-motion.
 */
const SmoothScroll = dynamic(
  () => import('@/components/landing/SmoothScroll').then((m) => m.SmoothScroll),
  { ssr: false },
);

const CAPABILITIES = [
  {
    icon: Gauge,
    title: 'Sync that holds',
    body: 'Play, pause and seek propagate with the network delay measured out of them. No counting down over voice chat.',
  },
  {
    icon: MessageSquare,
    title: 'A conversation that stays',
    body: 'Chat lives with the room, not the tab. Arrive late and read back what you missed.',
  },
  {
    icon: Video,
    title: 'Faces, not just names',
    body: 'Peer-to-peer video and voice run beside the film, so you catch the reaction as it happens.',
  },
  {
    icon: Lock,
    title: 'Your door, your rules',
    body: 'Public rooms anyone can find, or private ones behind a code where you approve each arrival.',
  },
  {
    icon: Users,
    title: 'Built for a group',
    body: 'Up to ten people, a lobby to gather in, and one host holding the remote.',
  },
  {
    icon: Radio,
    title: 'Nothing to install',
    body: 'No extension, no download for your friends. Send a link and they are in the room.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Choose the film',
    body: 'Thousands of freely licensed titles, searchable from the library — or bring your own upload.',
  },
  {
    n: '02',
    title: 'Open the room',
    body: 'Name it, decide who gets in, and send the code. Everyone gathers in the lobby.',
  },
  {
    n: '03',
    title: 'Press play once',
    body: 'One press, and every screen lands on the same frame. You hold the remote for the rest.',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { status } = useAuth();
  const reduced = useReducedMotion();

  // Someone already signed in wants the product, not the pitch.
  useEffect(() => {
    if (status === 'authenticated') router.replace('/library');
  }, [status, router]);

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-white">
      <SmoothScroll />

      {/* Skip link: the first tab stop on the page, for keyboard and screen
          reader users who should not have to walk the nav every time. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#695CFF] focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0D0D0F]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo size={30} />
          <div className="flex items-center gap-1 sm:gap-3">
            <Link
              href="/auth"
              className={cn(
                // min-h-11 keeps the tap target at 44px on touch, where the
                // visual padding alone left it at 36.
                'flex min-h-11 items-center rounded-xl px-3 text-sm text-white/70 transition-colors hover:text-white sm:px-4',
                focusRing,
              )}
            >
              Sign in
            </Link>
            <Button
              onClick={() => router.push('/auth')}
              className="h-11 rounded-xl bg-white px-4 text-[#0D0D0F] hover:bg-white/90"
            >
              Get started
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        {/* ---------------------------------------------------------------- */}
        {/* Hero — the one cinematic moment on the page                      */}
        {/* ---------------------------------------------------------------- */}
        <section className="relative overflow-hidden px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24">
          {/* A single blurred gradient, not a stack of filters. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[-12rem] h-[36rem] w-[52rem] -translate-x-1/2 rounded-full bg-[#695CFF]/18 blur-[130px]"
          />

          <div className="relative mx-auto max-w-6xl">
            <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
              <div>
                <motion.p
                  initial={reduced ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-white/70"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Rooms are live right now
                </motion.p>

                <motion.h1
                  initial={reduced ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.06 }}
                  className="mt-6 text-[2.6rem] leading-[1.04] tracking-[-0.03em] sm:text-6xl lg:text-[4.2rem]"
                >
                  Everyone on the
                  <br />
                  same <span className="italic text-[#8B7FFF]">frame</span>.
                </motion.h1>

                <motion.p
                  initial={reduced ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.14 }}
                  className="mt-6 max-w-md text-lg leading-relaxed text-white/60"
                >
                  ConnectUs keeps a film in step across every screen, and puts the chat,
                  the reactions and everyone&apos;s faces right beside it.
                </motion.p>

                <motion.div
                  initial={reduced ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
                  className="mt-9 flex flex-col gap-3 sm:flex-row"
                >
                  <Button
                    onClick={() => router.push('/auth')}
                    className="group h-12 rounded-xl bg-[#695CFF] px-6 text-base hover:bg-[#5a4de6] sm:w-auto"
                  >
                    Start a watch party
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                  <Button
                    onClick={() => router.push('/auth?next=/rooms')}
                    variant="outline"
                    className="h-12 rounded-xl border-white/15 bg-transparent px-6 text-base text-white hover:bg-white/[0.06] sm:w-auto"
                  >
                    I have a code
                  </Button>
                </motion.div>

                <motion.p
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="mt-6 text-sm text-white/35"
                >
                  Free to start · No extension · Nothing for your friends to install
                </motion.p>
              </div>

              <SyncVisual />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Statement — negative space doing the work                        */}
        {/* ---------------------------------------------------------------- */}
        <section className="px-5 py-24 sm:px-8 sm:py-36">
          <Reveal level="section" className="mx-auto max-w-3xl text-center">
            <p className="text-[1.75rem] leading-[1.35] tracking-[-0.02em] text-white/85 sm:text-[2.5rem]">
              Watching something together used to mean being in the same room.
              <span className="text-white/35"> Then it meant three people counting
              down over a group chat and still landing four seconds apart.</span>
            </p>
          </Reveal>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Capabilities                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section className="px-5 pb-24 sm:px-8 sm:pb-36">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-xl">
              <h2 className="text-3xl tracking-[-0.02em] sm:text-4xl">
                What a room gives you
              </h2>
              <p className="mt-3 text-white/55">
                Six things, each of which had to be right for the evening to work.
              </p>
            </Reveal>

            <RevealGroup
              as="ul"
              delayChildren={0.05}
              className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3"
            >
              {CAPABILITIES.map((capability) => (
                <Reveal
                  as="li"
                  key={capability.title}
                  className="group bg-[#0D0D0F] p-7 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#695CFF]/12 transition-transform duration-300 group-hover:-translate-y-0.5">
                    <capability.icon className="h-[18px] w-[18px] text-[#8B7FFF]" />
                  </span>
                  <h3 className="mt-5 text-[17px] tracking-[-0.01em]">{capability.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-white/50">
                    {capability.body}
                  </p>
                </Reveal>
              ))}
            </RevealGroup>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* How it works                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section className="border-y border-white/[0.06] bg-white/[0.015] px-5 py-24 sm:px-8 sm:py-36">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-xl">
              <h2 className="text-3xl tracking-[-0.02em] sm:text-4xl">
                Three steps, then the film
              </h2>
            </Reveal>

            <RevealGroup className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-8">
              {STEPS.map((step) => (
                <Reveal key={step.n}>
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-sm text-[#8B7FFF]">{step.n}</span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <h3 className="mt-5 text-xl tracking-[-0.01em]">{step.title}</h3>
                  <p className="mt-2.5 leading-relaxed text-white/50">{step.body}</p>
                </Reveal>
              ))}
            </RevealGroup>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Catalog note — honest about where films come from                */}
        {/* ---------------------------------------------------------------- */}
        <section className="px-5 py-24 sm:px-8 sm:py-32">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl tracking-[-0.02em] sm:text-3xl">
              Thousands of films, properly licensed
            </h2>
            <p className="mt-4 leading-relaxed text-white/55">
              The library is built on public-domain and openly licensed cinema — searchable
              from inside the app, and free to watch. Bring your own uploads for
              anything else.
            </p>
          </Reveal>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Closing                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section className="px-5 pb-28 sm:px-8">
          <Reveal level="section" className="mx-auto max-w-6xl">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 px-6 py-20 text-center sm:px-16 sm:py-28">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(105,92,255,0.28),transparent_70%)]"
              />
              <div className="relative">
                <h2 className="mx-auto max-w-2xl text-3xl leading-[1.15] tracking-[-0.025em] sm:text-5xl">
                  Your next movie night is
                  <span className="italic text-[#8B7FFF]"> one link</span> away.
                </h2>
                <Button
                  onClick={() => router.push('/auth')}
                  className="group mt-10 h-12 rounded-xl bg-white px-7 text-base text-[#0D0D0F] hover:bg-white/90"
                >
                  Create your account
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 sm:flex-row">
          <Logo size={26} />
          <p className="text-center text-sm text-white/35 sm:text-right">
            © {new Date().getFullYear()} ConnectUs · Films under public-domain and open licences
          </p>
        </div>
      </footer>
    </div>
  );
}
