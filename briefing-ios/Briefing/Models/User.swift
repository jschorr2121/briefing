import Foundation

struct User: Codable, Equatable {
    let email: String
    let name: String?
    let image: String?
}

struct LoginResponse: Codable {
    let token: String
    let user: User
}
