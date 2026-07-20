import ConsoleModels

/// Direct port of `ROLE_RANK`/`roleAtLeast` in `shared/platformSchema.ts` —
/// used by `MembersViewModel` to gate "invite someone" and "revoke invite"
/// visibility exactly as `MembersScreen.tsx` does (`roleAtLeast(viewerRole,
/// 'manager')`). Lives in the app target rather than `ConsoleCore` so the
/// package's `swift test` count (151) stays untouched by this task, mirroring
/// how Task 6's `ReviewQueueViewModel` also stayed app-side.
enum PlatformRoleRank {
    static let rank: [PlatformRole: Int] = [
        .owner: 5,
        .manager: 4,
        .reviewer: 3,
        .collector: 2,
        .viewer: 1,
    ]

    static func atLeast(_ role: PlatformRole, _ minimum: PlatformRole) -> Bool {
        (rank[role] ?? 0) >= (rank[minimum] ?? 0)
    }
}
