import UIKit
import SwiftUI
import Capacitor

class SnapLinkBridgeViewController: CAPBridgeViewController {
    private var glassHost: UIHostingController<SnapLinkLiquidGlassOverlay>?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.02, green: 0.06, blue: 0.13, alpha: 1.0)
        configureTransparentWebView()
        installLiquidGlassOverlay()
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        .lightContent
    }

    private func configureTransparentWebView() {
        webView?.isOpaque = false
        webView?.backgroundColor = .clear
        webView?.scrollView.backgroundColor = .clear
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
    }

    private func installLiquidGlassOverlay() {
        let host = UIHostingController(rootView: SnapLinkLiquidGlassOverlay())
        host.view.translatesAutoresizingMaskIntoConstraints = false
        host.view.backgroundColor = .clear
        host.view.isUserInteractionEnabled = false

        addChild(host)
        view.insertSubview(host.view, at: 0)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        host.didMove(toParent: self)
        glassHost = host
    }
}

struct SnapLinkLiquidGlassOverlay: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.02, green: 0.07, blue: 0.16),
                    Color(red: 0.10, green: 0.28, blue: 0.58),
                    Color(red: 0.74, green: 0.93, blue: 1.00)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            Circle()
                .fill(Color.white.opacity(0.24))
                .blur(radius: 46)
                .frame(width: 260, height: 260)
                .offset(x: -130, y: -220)

            Circle()
                .fill(Color.cyan.opacity(0.22))
                .blur(radius: 56)
                .frame(width: 320, height: 320)
                .offset(x: 150, y: 190)

            RoundedRectangle(cornerRadius: 44, style: .continuous)
                .fill(.ultraThinMaterial)
                .opacity(0.32)
                .frame(width: 260, height: 160)
                .rotationEffect(.degrees(-14))
                .offset(x: 130, y: -250)
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}
