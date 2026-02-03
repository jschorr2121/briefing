import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Briefing',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] p-6 md:p-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-[var(--muted)] mb-4">Last updated: February 2, 2026</p>

      <div className="space-y-6 text-[var(--foreground)] leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold mb-2">Overview</h2>
          <p>
            Briefing (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;the app&rdquo;) is a personalized news briefing
            service. We respect your privacy and are committed to protecting your personal data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Data We Collect</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Account information:</strong> Email address and name (via Google Sign-In)</li>
            <li><strong>News preferences:</strong> Topics you select for your briefings</li>
            <li><strong>Usage data:</strong> Briefing generation history, reading patterns</li>
            <li><strong>Device information:</strong> Push notification tokens (if enabled)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">How We Use Your Data</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Generate personalized news briefings based on your topics</li>
            <li>Send scheduled email briefings at your preferred time</li>
            <li>Send push notifications for daily briefings (if enabled)</li>
            <li>Improve the quality and relevance of briefings</li>
            <li>Process payments for Pro subscriptions</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Third-Party Services</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Google OAuth:</strong> For authentication</li>
            <li><strong>OpenAI:</strong> For AI-powered news generation and text-to-speech</li>
            <li><strong>Stripe:</strong> For payment processing</li>
            <li><strong>Upstash:</strong> For data caching</li>
            <li><strong>Vercel:</strong> For app hosting</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Data Storage & Security</h2>
          <p>
            Your data is stored securely using industry-standard encryption. We do not sell your
            personal data to third parties. Briefing content is cached temporarily and automatically
            expires.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Your Rights</h2>
          <p>You can:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access your account data through the app</li>
            <li>Delete your account and all associated data by contacting us</li>
            <li>Opt out of email briefings at any time</li>
            <li>Disable push notifications in your device settings</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Contact</h2>
          <p>
            For privacy questions or data deletion requests, contact us at{' '}
            <a href="mailto:clawdbotjake@gmail.com" className="text-[var(--accent)] underline">
              clawdbotjake@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
