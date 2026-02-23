import SwiftUI
import SwiftData
import GoogleSignIn

@main
struct BriefingApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
                .onAppear {
                    GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: AppConfig.googleClientID)
                }
        }
        .modelContainer(for: BriefingHistoryEntry.self)
    }
}

