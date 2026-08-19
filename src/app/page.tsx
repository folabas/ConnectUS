'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Check,
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
import { WatchRoomVisual } from '@/components/landing/WatchRoomVisual';
import { FilmReel } from '@/components/landing/FilmReel';
import {
  StepOneVisual,
  StepTwoVisual,
  StepThreeVisual,
} from '@/components/landing/StepVisual';
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
    body: 'Play, pause and seek propagate with the network delay measured out of them, so nobody is counting down over voice chat.',
  },
  {
    icon: MessageSquare,
    title: 'A conversation that stays',
    body: 'Chat lives with the room, not the tab. Arrive late and read back everything you missed.',
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
    body: 'Up to ten people, a lobby to gather in, and one host holding the remote — or nobody, if you prefer.',
  },
  {
    icon: Radio,
    title: 'Nothing to install',
    body: 'No extension and no download for your friends. Send a link and they are in the room.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Choose the film',
    body: 'Search thousands of public-domain titles from inside the app and add one to your library in a click.',
    Visual: StepOneVisual,
  },
  {
    n: '02',
    title: 'Open the room',
    body: 'Name it, decide who gets in, and share the six-character code. Everyone gathers in the lobby first.',
    Visual: StepTwoVisual,
  },
  {
    n: '03',
    title: 'Press play once',
    body: 'One press and every screen lands on the same frame. You hold the remote for the rest of the night.',
    Visual: StepThreeVisual,
  },
];

const REQUIREMENTS = [
  'A modern browser — Chrome, Edge, Firefox or Safari',
  'A free account, for you and for anyone joining',
  'A camera and microphone, only if you want to be seen and heard',
  'Nothing else: no extension, no plugin, no subscription',
];

const FAQ = [
  {
    q: 'Which films can I watch?',
    a: 'Public-domain and openly licensed cinema — thousands of titles, searchable from the library and free to watch. Modern studio releases are not available here, and no service can legally offer those to a third-party app.',
  },
  {
    q: 'Does everyone need an account?',
    a: 'Yes, so the host knows who is asking to come in and chat has a name against it. Signing up takes a moment and costs nothing.',
  },
  {
    q: 'What if my camera does not work?',
    a: 'You still get the film, the chat and the reactions, and you still see everyone else. Video is optional, and declining the camera prompt does not hold the room up.',
  },
  {
    q: 'How many people fit in a room?',
    a: 'Ten. Video is peer-to-peer, so beyond roughly six live cameras the bandwidth starts to tell on slower connections.',
  },
  {
    q: 'Can I watch something of my own?',
    a: 'Uploads are supported when configured, though the public catalogue is where most rooms start.',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { status } = useAuth();
  const reduced = useReducedMotion();

  // The landing page is a page, not a redirect. It used to bounce signed-in
  // visitors straight to /library, which meant nobody could actually read it
  // once they had an account — including anyone arriving from a shared link.
  const signedIn = status === 'authenticated';

  return (
    <div className="min-h-screen bg-[var(--bg)] text-white">
      <SmoothScroll />

      {/* Skip link: the first tab stop on the page, for keyboard and screen
          reader users who should not have to walk the nav every time. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--brand)] focus:px-4 focus:py-2 focus:text-[var(--brand-ink)]"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[var(--bg)]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo size={30} />

          <nav className="hidden items-center gap-6 text-sm text-white/55 md:flex" aria-label="Sections">
            <a href="#how" className={cn('rounded transition-colors hover:text-white', focusRing)}>
              How it works
            </a>
            <a href="#features" className={cn('rounded transition-colors hover:text-white', focusRing)}>
              Features
            </a>
            <a href="#library" className={cn('rounded transition-colors hover:text-white', focusRing)}>
              Library
            </a>
            <a href="#faq" className={cn('rounded transition-colors hover:text-white', focusRing)}>
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-1 sm:gap-3">
            {signedIn ? (
              <Button
                onClick={() => router.push('/library')}
                className="h-11 rounded-xl bg-[var(--brand)] px-4 text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]"
              >
                Open the app
              </Button>
            ) : (
              <>
                <Link
                  href="/auth"
                  className={cn(
                    'flex min-h-11 items-center rounded-xl px-3 text-sm text-white/70 transition-colors hover:text-white sm:px-4',
                    focusRing,
                  )}
                >
                  Sign in
                </Link>
                <Button
                  onClick={() => router.push('/auth')}
                  className="h-11 rounded-xl bg-white px-4 text-[var(--bg)] hover:bg-white/90"
                >
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main">
        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="relative overflow-hidden px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24">
          <div
            aria-hidden
            className="projector-beam pointer-events-none absolute left-1/2 top-[-16rem] h-[30rem] w-[38rem] -translate-x-1/2 rounded-full bg-[var(--brand)]/10 blur-[120px]"
          />

          <div className="relative mx-auto max-w-6xl">
            <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-12">
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
                  same <span className="italic text-[var(--brand-soft)]">frame</span>.
                </motion.h1>

                <motion.p
                  initial={reduced ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.14 }}
                  className="mt-6 max-w-md text-lg leading-relaxed text-white/60"
                >
                  ConnectUs is a watch party that actually stays in step. One person
                  presses play and every screen lands on the same second, with the chat,
                  the reactions and everyone&apos;s faces right beside the film.
                </motion.p>

                <motion.div
                  initial={reduced ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
                  className="mt-9 flex flex-col gap-3 sm:flex-row"
                >
                  <Button
                    onClick={() => router.push(signedIn ? '/rooms/new' : '/auth')}
                    className="group h-12 rounded-xl bg-[var(--brand)] px-6 text-base text-[var(--brand-ink)] hover:bg-[var(--brand-hover)] sm:w-auto"
                  >
                    {signedIn ? 'Host a room' : 'Start a watch party'}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                  <Button
                    onClick={() => router.push(signedIn ? '/rooms' : '/auth?next=/rooms')}
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
                  Free · No extension · Nothing for your friends to install
                </motion.p>
              </div>

              <WatchRoomVisual />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* The reel                                                         */}
        {/* ---------------------------------------------------------------- */}
        <section id="library" className="border-y border-white/[0.06] py-14">
          <Reveal className="mx-auto mb-8 max-w-6xl px-5 sm:px-8">
            <p className="text-sm uppercase tracking-[0.15em] text-white/35">
              In the library tonight
            </p>
          </Reveal>

          <FilmReel />

          <Reveal className="mx-auto mt-8 max-w-6xl px-5 sm:px-8">
            <p className="max-w-xl text-white/50">
              Thousands of public-domain and openly licensed films, searchable from inside
              the app and free to watch — no licensing fine print, no regional blackouts.
            </p>
          </Reveal>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Statement                                                        */}
        {/* ---------------------------------------------------------------- */}
        <section className="px-5 py-24 sm:px-8 sm:py-32">
          <Reveal level="section" className="mx-auto max-w-3xl text-center">
            <p className="text-[1.75rem] leading-[1.35] tracking-[-0.02em] text-white/85 sm:text-[2.5rem]">
              Watching something together used to mean being in the same room.
              <span className="text-white/35"> Then it meant three people counting down
              over a group chat and still landing four seconds apart.</span>
            </p>
          </Reveal>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* How it works                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="how"
          className="border-y border-white/[0.06] bg-white/[0.015] px-5 py-24 sm:px-8 sm:py-32"
        >
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-xl">
              <h2 className="text-3xl tracking-[-0.02em] sm:text-4xl">
                Three steps, then the film
              </h2>
            </Reveal>

            <div className="mt-14 flex flex-col gap-20 sm:gap-24">
              {STEPS.map((step, index) => {
                const isEven = index % 2 === 0;
                return (
                  <Reveal key={step.n}>
                    <div
                      className={cn(
                        'grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16',
                        !isEven && 'lg:[direction:rtl]',
                      )}
                    >
                      {/* Text side */}
                      <div className={cn(!isEven && 'lg:[direction:ltr]')}>
                        <div className="mb-5 flex items-center gap-3">
                          <span className="font-mono text-sm text-[var(--brand-soft)]">
                            {step.n}
                          </span>
                          <span className="h-px w-10 bg-white/10" />
                        </div>
                        <h3 className="text-2xl tracking-[-0.02em] sm:text-3xl">
                          {step.title}
                        </h3>
                        <p className="mt-3 max-w-sm leading-relaxed text-white/50">
                          {step.body}
                        </p>
                      </div>

                      {/* Visual side */}
                      <div
                        className={cn(
                          'rounded-2xl border border-white/[0.07] bg-[var(--bg)]/60 p-5 backdrop-blur-sm sm:p-7',
                          !isEven && 'lg:[direction:ltr]',
                        )}
                      >
                        <step.Visual />
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Capabilities                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section id="features" className="px-5 py-24 sm:px-8 sm:py-32">
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
                  className="group bg-[var(--bg)] p-7 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)]/12 transition-transform duration-300 group-hover:-translate-y-0.5">
                    <capability.icon className="h-[18px] w-[18px] text-[var(--brand-soft)]" />
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
        {/* What you need                                                    */}
        {/* ---------------------------------------------------------------- */}
        <section className="border-y border-white/[0.06] bg-white/[0.015] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <h2 className="text-3xl tracking-[-0.02em] sm:text-4xl">What you need</h2>
              <p className="mt-3 max-w-md text-white/55">
                Almost nothing, deliberately — the friction in a watch party is usually
                everyone installing something before the film can start.
              </p>
            </Reveal>

            <RevealGroup as="ul" className="space-y-4">
              {REQUIREMENTS.map((requirement) => (
                <Reveal as="li" key={requirement} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/15">
                    <Check className="h-3 w-3 text-[var(--brand-soft)]" />
                  </span>
                  <span className="leading-relaxed text-white/70">{requirement}</span>
                </Reveal>
              ))}
            </RevealGroup>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* FAQ                                                              */}
        {/* ---------------------------------------------------------------- */}
        <section id="faq" className="px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <h2 className="text-3xl tracking-[-0.02em] sm:text-4xl">Questions</h2>
            </Reveal>

            <RevealGroup as="ul" className="mt-10 divide-y divide-white/[0.07]">
              {FAQ.map((item) => (
                <Reveal as="li" key={item.q} className="py-6">
                  <h3 className="text-lg tracking-[-0.01em]">{item.q}</h3>
                  <p className="mt-2 leading-relaxed text-white/55">{item.a}</p>
                </Reveal>
              ))}
            </RevealGroup>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Closing                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section className="px-5 pb-28 sm:px-8">
          <Reveal level="section" className="mx-auto max-w-6xl">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 px-6 py-20 text-center sm:px-16 sm:py-28">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(227,154,46,0.16),transparent_70%)]"
              />
              <div className="relative">
                <h2 className="mx-auto max-w-2xl text-3xl leading-[1.15] tracking-[-0.025em] sm:text-5xl">
                  Your next movie night is
                  <span className="italic text-[var(--brand-soft)]"> one link</span> away.
                </h2>
                <Button
                  onClick={() => router.push(signedIn ? '/library' : '/auth')}
                  className="group mt-10 h-12 rounded-xl bg-white px-7 text-base text-[var(--bg)] hover:bg-white/90"
                >
                  {signedIn ? 'Open the app' : 'Create your account'}
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
