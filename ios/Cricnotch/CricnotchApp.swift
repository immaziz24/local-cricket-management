import SwiftUI
import WebKit

@main
struct CricnotchApp: App {
    var body: some Scene {
        WindowGroup { CricketWebsite() }
    }
}

struct CricketWebsite: UIViewRepresentable {
    private static let home = URL(string: "https://localcricket.plateria.in/")!

    func makeCoordinator() -> NavigationDelegate { NavigationDelegate() }

    func makeUIView(context: Context) -> WKWebView {
        let view = WKWebView()
        view.navigationDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = true
        view.load(URLRequest(url: Self.home))
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}

    final class NavigationDelegate: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else {
                decisionHandler(.cancel)
                return
            }
            if url.scheme == "https", url.host == CricketWebsite.home.host,
               url.port == nil || url.port == 443 {
                if action.targetFrame == nil {
                    webView.load(action.request)
                    decisionHandler(.cancel)
                } else {
                    decisionHandler(.allow)
                }
                return
            }
            if action.navigationType == .linkActivated,
               ["https", "mailto", "tel"].contains(url.scheme ?? "") {
                UIApplication.shared.open(url)
            }
            decisionHandler(.cancel)
        }
    }
}
