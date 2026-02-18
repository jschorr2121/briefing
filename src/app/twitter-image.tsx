import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Briefing - Your Personal News Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Logo/Icon */}
        <div
          style={{
            fontSize: 80,
            marginBottom: 20,
          }}
        >
          📰
        </div>
        
        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: 'white',
            marginBottom: 16,
            letterSpacing: '-0.02em',
          }}
        >
          Briefing
        </div>
        
        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            color: '#a0a0a0',
            textAlign: 'center',
            maxWidth: 800,
          }}
        >
          Your Personal News Intelligence
        </div>
        
        {/* Features */}
        <div
          style={{
            display: 'flex',
            gap: 40,
            marginTop: 48,
          }}
        >
          {['AI-Powered', 'Personalized', 'Audio Ready'].map((feature) => (
            <div
              key={feature}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#60a5fa',
                fontSize: 24,
              }}
            >
              <span style={{ color: '#22c55e' }}>✓</span>
              {feature}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
