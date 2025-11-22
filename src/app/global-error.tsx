'use client';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html>
            <body>
                <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D0D0F] text-white">
                    <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
                    <p className="text-white/60 mb-6">{error.message || 'An unexpected error occurred'}</p>
                    <button
                        onClick={() => reset()}
                        className="px-6 py-3 rounded-xl bg-[#695CFF] hover:bg-[#5a4de6] text-white transition-colors"
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
