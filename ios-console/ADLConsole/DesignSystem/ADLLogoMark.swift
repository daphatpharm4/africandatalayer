import SwiftUI

struct ADLLogoMark: View {
    var size: CGFloat = 32
    var showsBackground: Bool = false

    var body: some View {
        ZStack {
            if showsBackground {
                RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                    .fill(ADLConsoleColor.navy)
            }

            VStack(spacing: size * 0.13) {
                Capsule()
                    .fill(ADLConsoleColor.gold)
                    .frame(width: size * 0.62, height: size * 0.10)

                Capsule()
                    .fill(ADLConsoleColor.terra)
                    .frame(width: size * 0.46, height: size * 0.10)

                Capsule()
                    .fill(ADLConsoleColor.gold)
                    .frame(width: size * 0.30, height: size * 0.10)
            }
        }
        .frame(width: size, height: size)
    }
}

#Preview {
    ADLLogoMark(size: 128, showsBackground: true)
        .padding()
}
