package expo.modules.pluclairlistener

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * What the listener keeps between the moment a notification shows and the
 * moment the app reads it: the bank apps the person picked, and the queue
 * of their notifications, on the phone only. Shared preferences, which the
 * service and the module both reach; two hundred at most, the oldest let
 * go — a week away from the app is not a reason to hold a thousand.
 */
object Store {
  private const val FILE = "pluclair_listener"
  private const val PACKAGES = "packages"
  private const val QUEUE = "queue"
  private const val MOST = 200

  private fun prefs(context: Context) =
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  fun getPackages(context: Context): Set<String> =
    prefs(context).getStringSet(PACKAGES, emptySet()) ?: emptySet()

  fun setPackages(context: Context, packages: List<String>) {
    prefs(context).edit().putStringSet(PACKAGES, packages.toSet()).apply()
  }

  private fun queue(context: Context): JSONArray =
    try {
      JSONArray(prefs(context).getString(QUEUE, "[]") ?: "[]")
    } catch (_: Exception) {
      JSONArray()
    }

  @Synchronized
  fun append(context: Context, packageName: String, title: String, text: String, postedAt: Long) {
    val current = queue(context)
    val kept = JSONArray()
    val from = maxOf(0, current.length() - (MOST - 1))
    for (index in from until current.length()) {
      kept.put(current.get(index))
    }
    kept.put(
      JSONObject()
        .put("packageName", packageName)
        .put("title", title)
        .put("text", text)
        .put("postedAt", postedAt)
    )
    prefs(context).edit().putString(QUEUE, kept.toString()).apply()
  }

  fun count(context: Context): Int = queue(context).length()

  /** Everything waiting, and the queue emptied. */
  @Synchronized
  fun take(context: Context): List<Map<String, Any>> {
    val current = queue(context)
    val taken = ArrayList<Map<String, Any>>(current.length())
    for (index in 0 until current.length()) {
      val item = current.optJSONObject(index) ?: continue
      taken.add(
        mapOf(
          "packageName" to item.optString("packageName", ""),
          "title" to item.optString("title", ""),
          "text" to item.optString("text", ""),
          "postedAt" to item.optLong("postedAt", 0L).toDouble(),
        )
      )
    }
    prefs(context).edit().putString(QUEUE, "[]").apply()
    return taken
  }
}
