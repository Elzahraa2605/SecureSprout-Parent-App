package com.securesprout.app

import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.content.pm.PackageManager
import android.app.ActivityManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream
import java.util.*

class AppListModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "AppListModule"
    }

    // دالة نيتف مساعدة لتحويل أيقونة التطبيق لملف حقيقي وحفظها في الكاش لتفادي البطء وتلف الـ Base64
    private fun saveIconToCache(context: Context, packageName: String, drawable: Drawable): String? {
        return try {
            val bitmap = if (drawable is BitmapDrawable) {
                drawable.bitmap
            } else {
                val bmp = Bitmap.createBitmap(drawable.intrinsicWidth, drawable.intrinsicHeight, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bmp)
                drawable.setBounds(0, 0, canvas.width, canvas.height)
                drawable.draw(canvas)
                bmp
            }

            val cacheDir = context.cacheDir
            val iconFile = File(cacheDir, "app_icon_${packageName.replace(".", "_")}.png")
            val out = FileOutputStream(iconFile)
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            out.flush()
            out.close()

            "file://" + iconFile.absolutePath
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    @ReactMethod
    fun getTodayUsage(promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val pm = reactApplicationContext.packageManager
            
            val calendar = Calendar.getInstance()
            val endTime = calendar.timeInMillis
            calendar.set(Calendar.HOUR_OF_DAY, 0)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            val startTime = calendar.timeInMillis

            val stats = usageStatsManager.queryAndAggregateUsageStats(startTime, endTime)
            val appList: WritableArray = Arguments.createArray()

            val mainIntent = Intent(Intent.ACTION_MAIN, null)
            mainIntent.addCategory(Intent.CATEGORY_LAUNCHER)
            val launchableApps = pm.queryIntentActivities(mainIntent, 0)

            for (resolveInfo in launchableApps) {
                val packageName = resolveInfo.activityInfo.packageName
                val appMap: WritableMap = Arguments.createMap()
                val appLabel = resolveInfo.loadLabel(pm).toString()
                
                val usageStat = stats[packageName]
                val durationInMinutes = if (usageStat != null) {
                    (usageStat.totalTimeInForeground / 60000).toInt()
                } else {
                    0
                }

                // استخراج مسار الصورة وحفظها
                val iconDrawable = resolveInfo.loadIcon(pm)
                val iconUri = saveIconToCache(reactApplicationContext, packageName, iconDrawable)

                appMap.putString("appName", appLabel)
                appMap.putString("packageName", packageName)
                appMap.putInt("duration", durationInMinutes)
                appMap.putString("iconUri", iconUri ?: "") // 👈 إرسال المسار المحلي للصورة
                
                appList.pushMap(appMap)
            }

            promise.resolve(appList)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getCurrentApp(promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val time = System.currentTimeMillis()
            val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, time - 1000 * 10, time)
            
            if (stats != null && stats.isNotEmpty()) {
                val sortedStats = stats.sortedByDescending { it.lastTimeUsed }
                for (stat in sortedStats) {
                    promise.resolve(stat.packageName)
                    return
                }
            }
            promise.resolve("none")
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun goToHomeScreen() {
        try {
            val intent = Intent(Intent.ACTION_MAIN)
            intent.addCategory(Intent.CATEGORY_HOME)
            intent.setClassName("com.google.android.apps.nexuslauncher", "com.google.android.apps.nexuslauncher.NexusLauncherActivity")
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            try {
                val intent = reactApplicationContext.packageManager.getLaunchIntentForPackage("com.google.android.apps.nexuslauncher")
                if (intent != null) {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    reactApplicationContext.startActivity(intent)
                } else {
                    val normalIntent = Intent(Intent.ACTION_MAIN).apply {
                        addCategory(Intent.CATEGORY_HOME)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    reactApplicationContext.startActivity(normalIntent)
                }
            } catch (ex: Exception) {
                ex.printStackTrace()
            }
        }
    }

    @ReactMethod
    fun forceLockScreen() {
        try {
            val context = reactApplicationContext
            val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (intent != null) {
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or 
                               Intent.FLAG_ACTIVITY_SINGLE_TOP or 
                               Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                context.startActivity(intent)
            }
        } catch (e: Exception) { }
    }

    @ReactMethod
    fun bringAppToFront() {
        forceLockScreen()
    }

    @ReactMethod
    fun openUsageSettings() {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        reactApplicationContext.startActivity(intent)
    }

    @ReactMethod
    fun openOverlaySettings() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            reactApplicationContext.startActivity(intent)
        }
    }

    @ReactMethod
    fun startMonitorService() {
        val intent = Intent(reactApplicationContext, AppMonitorService::class.java)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            reactApplicationContext.startForegroundService(intent)
        } else {
            reactApplicationContext.startService(intent)
        }
    }

    @ReactMethod
    fun getTodayUsageForApp(packageName: String, promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val calendar = Calendar.getInstance()
            calendar.set(Calendar.HOUR_OF_DAY, 0)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            calendar.set(Calendar.MILLISECOND, 0)
            
            val startTime = calendar.timeInMillis
            val endTime = System.currentTimeMillis()

            val stats = usageStatsManager.queryAndAggregateUsageStats(startTime, endTime)
            val usageStat = stats[packageName]
            if (usageStat != null) {
                val durationInMinutes = (usageStat.totalTimeInForeground / 60000).toInt()
                promise.resolve(durationInMinutes)
            } else {
                promise.resolve(0)
            }
        } catch (e: Exception) {
            promise.reject("TIMER_ERROR", e.message)
        }
    }
}