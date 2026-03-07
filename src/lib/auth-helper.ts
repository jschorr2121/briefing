import { getServerSession } from 'next-auth';
import { validateMobileSession } from './mobile-auth';

interface AuthenticatedUser {
  email: string;
  name?: string | null;
  image?: string | null;
}

/**
 * Unified auth: checks for Bearer token first (mobile), falls back to NextAuth session (web).
 */
export async function getAuthenticatedUser(
  request: Request
): Promise<AuthenticatedUser | null> {
  // Check for mobile bearer token
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer brf_')) {
    const token = authHeader.slice(7); // "Bearer ".length
    const mobileUser = await validateMobileSession(token);
    if (mobileUser) {
      return {
        email: mobileUser.email,
        name: mobileUser.name,
        image: mobileUser.image,
      };
    }
    return null; // Invalid token — don't fall through to session
  }

  // Fall back to NextAuth session (web)
  const session = await getServerSession();
  if (session?.user?.email) {
    return {
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    };
  }

  return null;
}
