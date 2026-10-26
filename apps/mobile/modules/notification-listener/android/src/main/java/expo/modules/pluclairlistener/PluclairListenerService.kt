package expo.modules.pluclairlistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Android's notification listener, bound once the person grants « Accès aux
 * notifications ». Of everything the phone shows, it keeps the title and
 * text of the notifications posted by the bank apps the person picked
 * (`Store.getPackages`), and nothing from any other app: what it does not
 * keep it has not read. The app turns them into lines when it next opens
 * (`@finance/core/statement/notification`).
 */
class PluclairListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (!Store.getPackages(this).contains(sbn.packageName)) {
      return
    }
    val extras = sbn.notification?.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
    val text =
      (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
        ?: extras.getCharSequence(Notification.EXTRA_TEXT))
        ?.toString() ?: ""
    if (title.isBlank() && text.isBlank()) {
      return
    }
    Store.append(this, sbn.packageName, title, text, sbn.postTime)
  }
}
