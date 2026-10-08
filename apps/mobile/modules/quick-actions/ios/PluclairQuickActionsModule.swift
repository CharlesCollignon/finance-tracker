import ExpoModulesCore
import UIKit

// A pressed home-screen quick action, handed to JavaScript as the address
// it opens (`userInfo.href`, set by plugins/with-quick-actions.js).
//
// iOS gives the app delegate the action, before JavaScript may be running:
// on a cold launch it comes with the launch options, and then again through
// `performActionFor`. So the address is kept until JavaScript takes it, and
// sent as an event to a listener already there.

let quickActionNotification = Notification.Name("PluclairQuickAction")

/// The address of an action JavaScript has not taken yet.
var pendingQuickActionHref: String?

func quickActionHref(_ item: UIApplicationShortcutItem?) -> String? {
  return item?.userInfo?["href"] as? String
}

public class PluclairQuickActionsAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    if let href = quickActionHref(launchOptions?[.shortcutItem] as? UIApplicationShortcutItem) {
      pendingQuickActionHref = href
    }
    return true
  }

  public func application(
    _ application: UIApplication,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    guard let href = quickActionHref(shortcutItem) else {
      completionHandler(false)
      return
    }
    pendingQuickActionHref = href
    NotificationCenter.default.post(name: quickActionNotification, object: href)
    completionHandler(true)
  }
}

public class PluclairQuickActionsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PluclairQuickActions")

    Events("onQuickAction")

    // The action that opened the app, once: null after it has been taken.
    Function("takePending") { () -> String? in
      let href = pendingQuickActionHref
      pendingQuickActionHref = nil
      return href
    }

    OnStartObserving {
      NotificationCenter.default.addObserver(
        self,
        selector: #selector(self.quickActionReceived),
        name: quickActionNotification,
        object: nil
      )
    }

    OnStopObserving {
      NotificationCenter.default.removeObserver(
        self,
        name: quickActionNotification,
        object: nil
      )
    }
  }

  @objc
  func quickActionReceived(_ notification: Notification) {
    guard let href = notification.object as? String else {
      return
    }
    pendingQuickActionHref = nil
    sendEvent("onQuickAction", ["href": href])
  }
}
