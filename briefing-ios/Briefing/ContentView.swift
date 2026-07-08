import SwiftUI

struct ContentView: View {
    @State private var authManager = AuthManager.shared

    var body: some View {
        Group {
            if authManager.isLoading {
                ZStack {
                    Color.bgPrimary.ignoresSafeArea()
                    VStack(spacing: 14) {
                        Rectangle()
                            .fill(Color.textPrimary)
                            .frame(width: 48, height: 2)
                        Text("Briefing")
                            .font(.system(size: 40, weight: .heavy, design: .serif))
                            .foregroundStyle(Color.textPrimary)
                        Rectangle()
                            .fill(Color.textPrimary)
                            .frame(width: 48, height: 2)
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
