package expo.modules.pluclairlistener

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * What JavaScript asks of the listener (`modules/notification-listener/index.ts`):
 * whether the permission is granted, the system page to grant it on, the
 * bank apps picked and which of the known ones are installed, and the
 * notifications waiting — taken once, so each is read once.
 */
class NotificationListenerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun isInstalled(packageName: String): Boolean =
    try {
      context.packageManager.getPackageInfo(packageName, 0)
      true
    } catch (_: PackageManager.NameNotFoundException) {
      false
    }

  override fun definition() = ModuleDefinition {
    Name("PluclairNotificationListener")

    Function("isEnabled") {
      val enabled =
        Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: ""
      enabled.split(":").any { it.startsWith("${context.packageName}/") }
    }

    Function("openSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("getPackages") { Store.getPackages(context).toList() }

    Function("setPackages") { packages: List<String> -> Store.setPackages(context, packages) }

    Function("installed") { candidates: List<String> -> candidates.filter { isInstalled(it) } }

    Function("count") { Store.count(context) }

    Function("take") { Store.take(context) }
  }
}
