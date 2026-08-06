import SwiftUI

struct AppStoreCaptureConfiguration {
    let frame: String
    let locale: String
    static var isEnabled: Bool { ProcessInfo.processInfo.environment["ADL_APP_STORE_CAPTURE"] == "1" }
    static var current: Self { let e = ProcessInfo.processInfo.environment; return .init(frame: e["ADL_APP_STORE_FRAME"] ?? "operation", locale: e["ADL_APP_STORE_LOCALE"] ?? "en-US") }
    var isFrench: Bool { locale.hasPrefix("fr") }
    func text(_ en: String, _ fr: String) -> String { isFrench ? fr : en }
}

struct AppStoreCaptureView: View {
    let configuration: AppStoreCaptureConfiguration

    private var title: String {
        let values = [
            "operation": ("Run field operations", "Pilotez les opérations terrain"),
            "capture": ("See every submission", "Suivez chaque contribution"),
            "review": ("Review with confidence", "Validez en toute confiance"),
            "manage": ("Keep projects moving", "Faites avancer les projets"),
            "recover": ("Resolve sync exceptions", "Résolvez les erreurs de synchro"),
            "bilingual": ("One console. Two languages.", "Une console. Deux langues.")
        ]
        let value = values[configuration.frame] ?? values["operation"]!
        return configuration.text(value.0, value.1)
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [ADLConsoleColor.navyDark, ADLConsoleColor.navyMid], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            VStack(spacing: 18) {
                Text("ADL CONSOLE").font(.system(size: 13, weight: .bold)).tracking(2).foregroundStyle(.white.opacity(0.7))
                Text(title).font(.system(size: 29, weight: .bold)).lineLimit(2).minimumScaleFactor(0.8).multilineTextAlignment(.center).foregroundStyle(.white).frame(maxWidth: .infinity).padding(.horizontal, 20)
                VStack(spacing: 16) {
                    HStack { VStack(alignment: .leading) { Text(configuration.text("OPERATIONS", "OPÉRATIONS")).font(.caption.bold()).foregroundStyle(ADLConsoleColor.terra); Text("Bonamoussadi").font(.title.bold()).foregroundStyle(ADLConsoleColor.navy) }; Spacer(); Image(systemName: "shield.checkered").font(.title).foregroundStyle(ADLConsoleColor.forest) }
                    HStack(spacing: 8) { metric("128", configuration.text("Today", "Aujourd'hui")); metric("94%", configuration.text("Quality", "Qualité")); metric("7", configuration.text("Queued", "En attente")) }
                    scene
                    HStack { Label(configuration.text("Map", "Carte"), systemImage: "map.fill"); Spacer(); Label(configuration.text("Review", "Validation"), systemImage: "checkmark.square.fill"); Spacer(); Label(configuration.text("Projects", "Projets"), systemImage: "folder.fill") }.font(.caption.bold()).foregroundStyle(ADLConsoleColor.navy)
                }.padding(22).background(.white).clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous)).shadow(color: .black.opacity(0.25), radius: 24, y: 12).padding(.horizontal, 18)
            }.padding(.vertical, 28)
        }.accessibilityIdentifier("app-store-screenshot-ready")
    }

    @ViewBuilder private var scene: some View {
        if configuration.frame == "review" || configuration.frame == "capture" {
            VStack(spacing: 10) { record("PHM-1042", configuration.text("Pharmacy", "Pharmacie"), "GPS · 3 m", ADLConsoleColor.forest); record("MNY-887", "Mobile Money", "2 photos", ADLConsoleColor.gold); record("RDS-219", configuration.text("Road segment", "Segment routier"), configuration.text("Needs review", "À vérifier"), ADLConsoleColor.terra) }
        } else if configuration.frame == "recover" {
            VStack(spacing: 10) { record("SYNC-018", configuration.text("Upload retry", "Nouvel envoi"), configuration.text("Connection restored", "Connexion rétablie"), ADLConsoleColor.forest); record("SYNC-021", configuration.text("Photo checksum", "Contrôle photo"), configuration.text("Operator assigned", "Opérateur assigné"), ADLConsoleColor.gold); action(configuration.text("RETRY VERIFIED ITEMS", "RÉESSAYER LES ÉLÉMENTS VÉRIFIÉS")) }
        } else if configuration.frame == "manage" {
            VStack(spacing: 10) { progress(configuration.text("Pharmacy coverage", "Couverture pharmacies"), 0.84, ADLConsoleColor.forest); progress(configuration.text("Road conditions", "État des routes"), 0.62, ADLConsoleColor.gold); progress(configuration.text("Retail audit", "Audit commercial"), 0.47, ADLConsoleColor.terra) }
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: 18).fill(ADLConsoleColor.navyWash).frame(height: 320)
                ForEach(Array([CGPoint(x: 72, y: 78), CGPoint(x: 182, y: 148), CGPoint(x: 288, y: 236), CGPoint(x: 128, y: 258)].enumerated()), id: \.offset) { item in Circle().fill([ADLConsoleColor.terra, ADLConsoleColor.forest, ADLConsoleColor.gold, ADLConsoleColor.navy][item.offset]).frame(width: 42, height: 42).position(item.element) }
                VStack { Spacer(); Text(configuration.text("Live coverage · 12 agents", "Couverture en direct · 12 agents")).font(.caption.bold()).foregroundStyle(.white).padding().background(ADLConsoleColor.navy).clipShape(Capsule()).padding(.bottom, 16) }
            }
        }
    }

    private func metric(_ value: String, _ label: String) -> some View { VStack { Text(value).font(.title3.bold()); Text(label).font(.caption2.bold()).foregroundStyle(.secondary) }.foregroundStyle(ADLConsoleColor.navy).frame(maxWidth: .infinity).padding(.vertical, 12).background(ADLConsoleColor.navyWash).clipShape(RoundedRectangle(cornerRadius: 12)) }
    private func record(_ id: String, _ title: String, _ detail: String, _ color: Color) -> some View { HStack { Circle().fill(color).frame(width: 12, height: 12); VStack(alignment: .leading) { Text(title).font(.body.bold()); Text("\(id) · \(detail)").font(.caption).foregroundStyle(.secondary) }; Spacer(); Image(systemName: "chevron.right") }.padding(15).background(ADLConsoleColor.navyWash).clipShape(RoundedRectangle(cornerRadius: 14)) }
    private func progress(_ title: String, _ value: Double, _ color: Color) -> some View { VStack(alignment: .leading, spacing: 8) { HStack { Text(title).font(.body.bold()); Spacer(); Text("\(Int(value * 100))%").font(.caption.bold()) }; ProgressView(value: value).tint(color) }.padding(16).background(ADLConsoleColor.navyWash).clipShape(RoundedRectangle(cornerRadius: 14)) }
    private func action(_ title: String) -> some View { Text(title).font(.caption.bold()).foregroundStyle(.white).frame(maxWidth: .infinity).padding().background(ADLConsoleColor.navy).clipShape(RoundedRectangle(cornerRadius: 14)) }
}
