import SwiftUI
import GoogleSignIn

struct LoginView: View {
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        ZStack {
            Color.bgPrimary.ignoresSafeArea()

            VStack(spacing: 32) {
                Spacer()

                // Nameplate
                VStack(spacing: 16) {
                    Rectangle()
                        .fill(Color.textPrimary)
                        .frame(width: 64, height: 2)
                        .fadeIn()

                    Text("Briefing")
                        .font(.system(size: 52, weight: .heavy, design: .serif))
                        .foregroundStyle(Color.textPrimary)
                        .fadeIn(delay: 0.1)

                    KickerText("Your personalized news, every day")
                        .fadeIn(delay: 0.2)

                    Rectangle()
                        .fill(Color.textPrimary)
                        .frame(width: 64, height: 2)
                        .fadeIn(delay: 0.2)
                }

                Spacer()

                // Sign in section
                VStack(spacing: 16) {
                    if let error {
                        ErrorBannerView(message: error, onDismiss: { self.error = nil })
                            .padding(.horizontal)
                    }

                    Button {
                        signInWithGoogle()
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "g.circle.fill")
                                .font(.title2)
                            Text("Sign in with Google")
                                .font(.buttonLabel)
                        }
                        .foregroundStyle(Color.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.bgCard)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.borderLight, lineWidth: 1)
                        )
                    }
                    .disabled(isLoading)
                    .opacity(isLoading ? 0.6 : 1)
                    .padding(.horizontal, 32)
                    .fadeIn(delay: 0.3)

                    if isLoading {
                        ProgressView()
                            .tint(Color.textPrimary)
                    }
                }

                Spacer()
                    .frame(height: 48)
            }
        }
    }

    private func signInWithGoogle() {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            error = "Unable to find root view controller"
            return
        }

        isLoading = true
        error = nil

        GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController) { result, signInError in
            if let signInError {
                self.error = signInError.localizedDescription
                self.isLoading = false
                return
            }

            guard let idToken = result?.user.idToken?.tokenString else {
                self.error = "Failed to get ID token from Google"
                self.isLoading = false
                return
            }

            Task {
                do {
                    try await AuthManager.shared.signIn(idToken: idToken)
                } catch {
                    self.error = error.localizedDescription
                }
                self.isLoading = false
            }
        }
    }
}
