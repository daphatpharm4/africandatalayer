import SwiftUI

struct AppStoreCaptureConfiguration {
    let frame: String
    let locale: String

    static var isEnabled: Bool { ProcessInfo.processInfo.environment["ADL_APP_STORE_CAPTURE"] == "1" }
    static var current: Self {
        let environment = ProcessInfo.processInfo.environment
        return .init(frame: environment["ADL_APP_STORE_FRAME"] ?? "map",
                     locale: environment["ADL_APP_STORE_LOCALE"] ?? "en-US")
    }
    var isFrench: Bool { locale.hasPrefix("fr") }
    func text(_ en: String, _ fr: String) -> String { isFrench ? fr : en }
}

struct AppStoreCaptureView: View {
    let configuration: AppStoreCaptureConfiguration

    private var copy: (String, String) {
        switch configuration.frame {
        case "capture": return (configuration.text("Capture trusted places", "Capturez des lieux fiables"), configuration.text("Camera + GPS verify every contribution", "Caméra + GPS vérifient chaque contribution"))
        case "offline": return (configuration.text("Keep working offline", "Continuez hors connexion"), configuration.text("Drafts stay safely on your device", "Vos brouillons restent sur votre appareil"))
        case "sync": return (configuration.text("Sync when ready", "Synchronisez au bon moment"), configuration.text("Review queued work before upload", "Vérifiez les éléments avant l'envoi"))
        case "progress": return (configuration.text("Quality moves you forward", "La qualité vous fait avancer"), configuration.text("Verified submissions earn XP", "Les contributions vérifiées rapportent des XP"))
        case "bilingual": return (configuration.text("Built for local fieldwork", "Conçu pour le terrain local"), configuration.text("English and French, one clear workflow", "Français et anglais, un flux clair"))
        default: return (configuration.text("Map what matters nearby", "Cartographiez l'essentiel"), configuration.text("Find high-value gaps across Bonamoussadi", "Repérez les zones prioritaires à Bonamoussadi"))
        }
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [ADLColor.navyDark, ADLColor.navyMid], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            VStack(spacing: 20) {
                BrandDiamond(size: 34)
                Text(copy.0).font(ADLFont.inter(29, .bold)).lineLimit(2).minimumScaleFactor(0.8).multilineTextAlignment(.center).foregroundStyle(.white).frame(maxWidth: .infinity).padding(.horizontal, 20)
                Text(copy.1).font(ADLFont.inter(16, .medium)).lineLimit(2).minimumScaleFactor(0.85).multilineTextAlignment(.center).foregroundStyle(.white.opacity(0.72)).padding(.horizontal, 20)
                VStack(spacing: 18) {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(configuration.text("FIELD MISSION", "MISSION TERRAIN")).font(ADLFont.inter(11, .bold)).tracking(1.3).foregroundStyle(ADLColor.terracotta)
                            Text("Bonamoussadi").font(ADLFont.inter(24, .bold)).foregroundStyle(ADLColor.navy)
                        }
                        Spacer()
                        Image(systemName: configuration.frame == "offline" ? "wifi.slash" : "location.fill").font(.title2).foregroundStyle(ADLColor.forest)
                    }
                    scene
                    HStack {
                        Label(configuration.text("Map", "Carte"), systemImage: "map.fill")
                        Spacer()
                        Label(configuration.text("Contribute", "Contribuer"), systemImage: "plus.circle.fill")
                        Spacer()
                        Label(configuration.text("Profile", "Profil"), systemImage: "person.fill")
                    }.font(ADLFont.inter(11, .semibold)).foregroundStyle(ADLColor.navy)
                }
                .padding(22).background(.white).clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous)).shadow(color: .black.opacity(0.24), radius: 24, y: 12).padding(.horizontal, 18)
            }.padding(.vertical, 26)
        }.accessibilityIdentifier("app-store-screenshot-ready")
    }

    @ViewBuilder private var scene: some View {
        if configuration.frame == "capture" {
            VStack(spacing: 14) {
                RoundedRectangle(cornerRadius: 20).fill(ADLColor.navyWash).frame(height: 235).overlay(Image(systemName: "camera.viewfinder").font(.system(size: 72)).foregroundStyle(ADLColor.navy))
                checklist([configuration.text("Live photo", "Photo en direct"), "GPS · 4 m", configuration.text("Category selected", "Catégorie choisie")])
            }
        } else if configuration.frame == "offline" || configuration.frame == "sync" {
            VStack(spacing: 12) {
                statusCard("tray.full.fill", configuration.text("3 drafts queued", "3 brouillons en attente"), configuration.text("Saved securely on this iPhone", "Enregistrés sur cet iPhone"), ADLColor.gold)
                statusCard("checkmark.shield.fill", configuration.text("Ready to sync", "Prêt à synchroniser"), configuration.text("Photos and GPS checks complete", "Photos et contrôles GPS terminés"), ADLColor.forest)
                if configuration.frame == "sync" { action(configuration.text("SYNC 3 CONTRIBUTIONS", "SYNCHRONISER 3 CONTRIBUTIONS")) }
            }
        } else if configuration.frame == "progress" {
            VStack(spacing: 16) {
                ZStack {
                    Circle().stroke(ADLColor.navyWash, lineWidth: 18)
                    Circle().trim(from: 0, to: 0.78).stroke(ADLColor.gold, style: StrokeStyle(lineWidth: 18, lineCap: .round)).rotationEffect(.degrees(-90))
                    VStack { Text("780").font(ADLFont.inter(42, .bold)); Text("XP").font(ADLFont.inter(12, .bold)) }.foregroundStyle(ADLColor.navy)
                }.frame(height: 210)
                checklist([configuration.text("12 verified places", "12 lieux vérifiés"), configuration.text("94% quality score", "Score qualité de 94 %"), configuration.text("Top 10 this week", "Top 10 cette semaine")])
            }
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: 20).fill(ADLColor.navyWash).frame(height: 330)
                Path { path in path.move(to: CGPoint(x: 12, y: 68)); path.addCurve(to: CGPoint(x: 330, y: 265), control1: CGPoint(x: 110, y: 35), control2: CGPoint(x: 205, y: 310)) }.stroke(.white, lineWidth: 12)
                ForEach(Array([CGPoint(x: 80, y: 92), CGPoint(x: 188, y: 182), CGPoint(x: 286, y: 254)].enumerated()), id: \.offset) { item in Circle().fill([ADLColor.terracotta, ADLColor.forest, ADLColor.gold][item.offset]).frame(width: 46, height: 46).position(item.element) }
                VStack { Spacer(); Text(configuration.text("7 priority zones nearby", "7 zones prioritaires à proximité")).font(ADLFont.inter(14, .bold)).foregroundStyle(.white).padding().background(ADLColor.navy).clipShape(Capsule()).padding(.bottom, 18) }
            }
        }
    }

    private func checklist(_ rows: [String]) -> some View { VStack(spacing: 10) { ForEach(rows, id: \.self) { row in HStack { Image(systemName: "checkmark.circle.fill").foregroundStyle(ADLColor.forest); Text(row).font(ADLFont.inter(14, .semibold)); Spacer() }.padding(12).background(ADLColor.navyWash).clipShape(RoundedRectangle(cornerRadius: 12)) } } }
    private func statusCard(_ icon: String, _ title: String, _ detail: String, _ color: Color) -> some View { HStack(spacing: 14) { Image(systemName: icon).font(.title2).foregroundStyle(color); VStack(alignment: .leading) { Text(title).font(ADLFont.inter(16, .bold)); Text(detail).font(ADLFont.inter(12, .medium)).foregroundStyle(.secondary) }; Spacer() }.padding(16).background(ADLColor.navyWash).clipShape(RoundedRectangle(cornerRadius: 16)) }
    private func action(_ title: String) -> some View { Text(title).font(ADLFont.inter(13, .bold)).foregroundStyle(.white).frame(maxWidth: .infinity).padding().background(ADLColor.navy).clipShape(RoundedRectangle(cornerRadius: 14)) }
}
