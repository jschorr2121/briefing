import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support - Briefing',
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] p-6 md:p-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Support</h1>
      <p className="text-[var(--muted)] mb-8">
        Need help with Briefing? We&apos;re here for you.
      </p>

      <div className="space-y-8 text-[var(--foreground)] leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold mb-3">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-[var(--foreground)]">How do I create a briefing?</h3>
              <p className="text-[var(--muted)] mt-1">
                Sign in, select your topics, and tap &ldquo;Generate Briefing&rdquo;. Your AI-powered
                briefing will be ready in seconds with the latest news on your chosen topics.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-[var(--foreground)]">How do scheduled briefings work?</h3>
              <p className="text-[var(--muted)] mt-1">
                Pro subscribers can schedule daily briefings delivered to their email at a time they
                choose. Go to the Schedule page to set your preferred delivery time and topics.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-[var(--foreground)]">Can I listen to my briefing?</h3>
              <p className="text-[var(--muted)] mt-1">
                Yes! Pro subscribers can listen to any briefing as audio, powered by OpenAI text-to-speech.
                Choose from 12 different voices in your settings.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-[var(--foreground)]">How do I add custom topics?</h3>
              <p className="text-[var(--muted)] mt-1">
                Tap the &ldquo;+&rdquo; button on the topics bar to add any custom topic. You can be as
                specific as you like — &ldquo;SpaceX launches&rdquo;, &ldquo;NYC restaurant openings&rdquo;,
                or &ldquo;React.js updates&rdquo;.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-[var(--foreground)]">How do I cancel my subscription?</h3>
              <p className="text-[var(--muted)] mt-1">
                Go to Account → Manage Subscription to access the Stripe billing portal where you can
                cancel or update your payment method at any time.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-[var(--foreground)]">How do I delete my account?</h3>
              <p className="text-[var(--muted)] mt-1">
                Send an email to the address below requesting account deletion. We&apos;ll remove
                your account and all associated data within 48 hours.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
          <p>
            For bug reports, feature requests, account issues, or any other questions:
          </p>
          <div className="mt-3 p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
            <p>
              📧 Email:{' '}
              <a href="mailto:clawdbotjake@gmail.com" className="text-[var(--accent)] underline">
                clawdbotjake@gmail.com
              </a>
            </p>
            <p className="text-[var(--muted)] text-sm mt-2">
              We typically respond within 24 hours.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Legal</h2>
          <div className="flex gap-4">
            <a href="/privacy" className="text-[var(--accent)] underline">Privacy Policy</a>
            <a href="/terms" className="text-[var(--accent)] underline">Terms of Service</a>
          </div>
        </section>
      </div>
    </div>
  );
}
