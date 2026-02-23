import SwiftUI

struct ContentView: View {
    @State private var authManager = AuthManager.shared

    var body: some View {
        Group {
            if authManager.isLoading {
                ZStack {
                    Color.bgPrimary.ignoresSafeArea()
                    VStack(spacing: 16) {
                        Image(systemName: "newspaper.fill")
                            .font(.system(size: 48))
                            .foregroundStyle(Color.accent)
                        Text("Briefing")
                            .font(.heroTitle)
                            .foregroundStyle(Color.textPrimary)
                    }
                }
            } else if authManager.isSignedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .task {
            await authManager.restoreSession()
        }
    }
}
