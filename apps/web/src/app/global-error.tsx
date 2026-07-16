'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('Global error:', error);
  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            backgroundColor: '#0c0c0f',
            color: '#e0e0ea',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background decoration */}
          <div
            style={{
              position: 'absolute',
              top: '33%',
              right: '33%',
              width: '20rem',
              height: '20rem',
              borderRadius: '50%',
              background: 'rgba(248, 113, 113, 0.03)',
              filter: 'blur(64px)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '33%',
              left: '33%',
              width: '16rem',
              height: '16rem',
              borderRadius: '50%',
              background: 'rgba(251, 146, 60, 0.03)',
              filter: 'blur(64px)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ textAlign: 'center', maxWidth: '28rem', position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                width: '5rem',
                height: '5rem',
                margin: '0 auto 1.5rem',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '1rem',
                border: '1px solid rgba(248, 113, 113, 0.1)',
                background: 'rgba(248, 113, 113, 0.05)',
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#f87171"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: '#e0e0ea' }}>
              Critical error
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#7a7a8a', marginTop: '0.5rem' }}>
              A critical error occurred. Please try again.
            </p>
            {error.digest && (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '0.75rem',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: '#5a5a6a',
                  background: '#1a1a1f',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '0.5rem',
                }}
              >
                Error ID: {error.digest}
              </span>
            )}
            <button
              onClick={() => reset()}
              style={{
                marginTop: '1.5rem',
                padding: '0.625rem 1.25rem',
                borderRadius: '0.75rem',
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #5555e0)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.25)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(99, 102, 241, 0.25)';
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
