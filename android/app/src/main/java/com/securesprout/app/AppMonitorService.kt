package com.securesprout.app

import android.app.*
import android.content.*
import android.os.*
import android.content.Intent
import android.app.usage.UsageStatsManager
import android.util.Log
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.text.SimpleDateFormat
import kotlin.concurrent.thread
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

class AppMonitorService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val connectivityManager by lazy { getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager }
    
    private var allowedApps = mutableListOf<String>() 
    private var blockedApps = mutableListOf<String>() 
    private val reportedAppsInSession = mutableSetOf<String>()

    // 🚀 متغيرات الـ Live Counter للطرد الفوري واللحظي
    private var lastTrackedApp: String? = null
    private var appSessionStartTime: Long = 0

    // 🚀 متغيرات الـ Downtime الأصلية بتاعتك بدون المساس بها
    private var downtimeStartTime: String? = null
    private var downtimeEndTime: String? = null
    private var isDowntimeEnabled = false
    private val downtimeDays = mutableListOf<Int>()

    // 1. برودكاست ريسيفر يلقط حذف التطبيقات فوراً
    private val packageRemovedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_PACKAGE_REMOVED) {
                val packageName = intent.data?.schemeSpecificPart
                Log.d("AppMonitor", "🗑️ تم مسح تطبيق: $packageName - جاري تحديث السيرفر...")
                syncInitialApps() // نادى المزامنة فوراً عشان يتمسح من الداتابيز
            }
        }
    }

    private val checkRunnable = object : Runnable {
        override fun run() {
            checkCurrentApp()
            handler.postDelayed(this, 1000)
        }
    }

    // 📊 دالة جديدة: مزامنة مدة استخدام التطبيقات (duration) الحقيقية من جهاز الطفل نفسه.
    // هذه الدالة هي المصدر الوحيد الصحيح لبيانات app_usage، لأنها تعمل فقط داخل
    // الـ Service الذي يشتغل حصرياً على جهاز الطفل (مينفعش تتنفذ من جهاز الأب).
    private fun syncUsageStatsToServer() {
        thread {
            if (!isNetworkAvailable()) return@thread

            val childId = getChildIdFromStorage()
            try {
                val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
                val pm = packageManager

                val calendar = Calendar.getInstance()
                val endTime = calendar.timeInMillis
                calendar.set(Calendar.HOUR_OF_DAY, 0)
                calendar.set(Calendar.MINUTE, 0)
                calendar.set(Calendar.SECOND, 0)
                calendar.set(Calendar.MILLISECOND, 0)
                val startTime = calendar.timeInMillis

                val stats = usageStatsManager.queryAndAggregateUsageStats(startTime, endTime)

                val mainIntent = Intent(Intent.ACTION_MAIN, null)
                mainIntent.addCategory(Intent.CATEGORY_LAUNCHER)
                val launchableApps = pm.queryIntentActivities(mainIntent, 0)

                val appList = JSONArray()
                val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

                for (resolveInfo in launchableApps) {
                    val packageName = resolveInfo.activityInfo.packageName
                    if (packageName == this.packageName) continue // استثناء تطبيقنا نفسه

                    val usageStat = stats[packageName]
                    val durationInMinutes = if (usageStat != null) {
                        (usageStat.totalTimeInForeground / 60000).toInt()
                    } else {
                        0
                    }

                    // نتجاهل التطبيقات اللي مالهاش استخدام النهاردة لتقليل حجم الطلب
                    if (durationInMinutes <= 0) continue

                    val obj = JSONObject()
                    obj.put("package_name", packageName)
                    obj.put("app_name", resolveInfo.loadLabel(pm).toString())
                    obj.put("duration", durationInMinutes)
                    obj.put("usage_date", todayStr)
                    obj.put("category", "General")
                    appList.put(obj)
                }

                val json = JSONObject()
                json.put("child_id", childId)
                json.put("apps", appList)

                val url = URL("http://16.171.208.58/api/parent/usage/sync-bulk")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; utf-8")
                conn.setRequestProperty("Accept", "application/json")

                // 🔑 جديد: إرفاق توكن الطفل عشان الراوت بقى محمي بـ auth:child في اللارافيل.
                // لو التوكن مش موجود (مثلاً جهاز قديم لسه ملوجنش بعد التحديث)، نوقف
                // المحاولة بدل ما نبعت طلب هيترفض بـ 401 على الفاضي.
                val token = getAuthTokenFromStorage()
                if (token.isNullOrEmpty()) {
                    Log.e("AppMonitor", "⚠️ لا يوجد توكن مصادقة محفوظ - تخطي مزامنة الاستخدام. يلزم تسجيل الدخول مرة أخرى.")
                    return@thread
                }
                conn.setRequestProperty("Authorization", "Bearer $token")

                conn.doOutput = true
                conn.outputStream.use { it.write(json.toString().toByteArray()) }

                if (conn.responseCode in 200..201) {
                    Log.d("AppMonitor", "✅ تمت مزامنة مدة استخدام التطبيقات بنجاح")
                } else {
                    Log.e("AppMonitor", "❌ فشل مزامنة الاستخدام، كود: ${conn.responseCode}")
                }
                conn.disconnect()
            } catch (e: Exception) {
                Log.e("AppMonitor", "❌ خطأ في مزامنة مدة الاستخدام: ${e.message}")
            }
        }
    }

    private val updateAppsRunnable = object : Runnable {
        override fun run() {
            // تحديث البيانات المعتاد من السيرفر
            fetchAllDataFromServer()
            // فحص إضافي سريع ومباشر للـ Downtime من السيرفر لضمان المزامنة الفورية
            fetchDowntimeFastFromServer()
            // ⏳ جلب لستة محدد الوقت (Timers) للتطبيقات من السيرفر
            fetchAppTimersFromServer()
            // 📊 مزامنة مدة استخدام التطبيقات الحقيقية لهذا الجهاز (جهاز الطفل) مع السيرفر
            syncUsageStatsToServer()
            handler.postDelayed(this, 60000) 
        }
    }

    private fun getChildIdFromStorage(): String {
        val sharedPref = getSharedPreferences("UserPrefs", Context.MODE_PRIVATE)
        return sharedPref.getString("child_id", "100") ?: "100"
    }

    // 🔑 جديد: قراءة توكن مصادقة الطفل المحفوظ وقت الـ Login (childLogin.tsx)
    // عشان نقدر نبعت طلبات محمية (auth:child) للسيرفر بدل ما تكون مفتوحة للكل.
    private fun getAuthTokenFromStorage(): String? {
        val sharedPref = getSharedPreferences("UserPrefs", Context.MODE_PRIVATE)
        return sharedPref.getString("auth_token", null)
    }

    override fun onCreate() {
        super.onCreate()
        // تسجيل الريسيفر لمراقبة الحذف
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_PACKAGE_REMOVED)
            addDataScheme("package")
        }
        registerReceiver(packageRemovedReceiver, filter)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()
        val notification = NotificationCompat.Builder(this, "monitor_channel")
            .setContentTitle("SecureSprout Protection Active")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        
        startForeground(1, notification)
        
        syncInitialApps()
        
        handler.post(checkRunnable)
        handler.post(updateAppsRunnable)
        return START_STICKY
    }

    private fun syncInitialApps() {
        thread {
            if (!isNetworkAvailable()) return@thread // أضف هذا السطر

            val childId = getChildIdFromStorage()
            try {
                val pm = packageManager
                val mainIntent = Intent(Intent.ACTION_MAIN, null)
                mainIntent.addCategory(Intent.CATEGORY_LAUNCHER)
                
                val resolvedInfos: List<ResolveInfo> = pm.queryIntentActivities(mainIntent, 0)
                val appList = JSONArray()

                for (resolveInfo in resolvedInfos) {
                    val packageName = resolveInfo.activityInfo.packageName
                    if (packageName != this.packageName) {
                        val obj = JSONObject()
                        obj.put("package_name", packageName)
                        obj.put("app_name", resolveInfo.loadLabel(pm).toString())
                        appList.put(obj)
                    }
                }

                val json = JSONObject()
                json.put("child_id", childId)
                json.put("apps", appList)

                val url = URL("http://16.171.208.58/api/child/sync-all-apps")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; utf-8")
                conn.doOutput = true
                conn.outputStream.use { it.write(json.toString().toByteArray()) }

                if (conn.responseCode in 200..201) {
                    Log.d("AppMonitor", "✅ مزامنة ناجحة (تم تنظيف المحذوفات)")
                    fetchAllDataFromServer()
                    fetchAppTimersFromServer()
                }
            } catch (e: Exception) {
                Log.e("AppMonitor", "❌ فشل المزامنة: ${e.message}")
            }
        }
    }

    private fun fetchAllDataFromServer() {
        thread {
            if (!isNetworkAvailable()) return@thread // أضف هذا السطر

            val childId = getChildIdFromStorage()
            try {
                val blockedUrl = URL("http://16.171.208.58/api/child/$childId/blocked-apps")
                blockedApps = parseJsonArray(blockedUrl)

                val allowedUrl = URL("http://16.171.208.58/api/child/$childId/allowed-apps")
                val newAllowed = parseJsonArray(allowedUrl)
                if (newAllowed.isNotEmpty()) {
                    allowedApps = newAllowed
                }
                
                // تنظيف الذاكرة المؤقتة من التطبيقات اللي اتعرفت خلاص
                reportedAppsInSession.removeAll(blockedApps.toSet())
                reportedAppsInSession.removeAll(allowedApps.toSet())

                Log.d("AppMonitor", "✅ تحديث القوائم بنجاح")
            } catch (e: Exception) {
                Log.e("AppMonitor", "❌ خطأ اتصال: ${e.message}")
            }
        }
    }

    private fun fetchDowntimeFastFromServer() {
        thread {
            if (!isNetworkAvailable()) return@thread // أضف هذا السطر

            val childId = getChildIdFromStorage()
            try {
                val url = URL("http://16.171.208.58/api/child/downtime/check/$childId")
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 3000
                if (conn.responseCode == 200) {
                    val responseText = conn.inputStream.bufferedReader().readText()
                    val jsonResponse = JSONObject(responseText)
                    
                    val localDowntimeJson = JSONObject()
                    val isLocked = jsonResponse.optBoolean("is_locked", false) || jsonResponse.optInt("is_locked", 0) == 1
                    val isEnabled = jsonResponse.optBoolean("is_enabled", false) || isLocked
                    
                    localDowntimeJson.put("is_enabled", isEnabled)
                    localDowntimeJson.put("start_time", jsonResponse.optString("start_time", "00:00"))
                    localDowntimeJson.put("end_time", jsonResponse.optString("end_time", "23:59"))
                    
                    val daysArray = jsonResponse.optJSONArray("days") ?: JSONArray(listOf(0,1,2,3,4,5,6))
                    localDowntimeJson.put("days", daysArray)

                    val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
                    sharedPrefs.edit().putString("downtime_list", localDowntimeJson.toString()).apply()
                    Log.d("AppMonitor", "⚡ تم تحديث كاش الـ Downtime من السيرفر فوراً")
                }
            } catch (e: Exception) {
                Log.e("AppMonitor", "❌ فشل جلب الـ Downtime الفوري: ${e.message}")
            }
        }
    }

    // ⏳ دالة جديدة لجلب الـ App Timers (الميقاتي) لكل الحزم المخزنة للأب
    private fun fetchAppTimersFromServer() {
        thread {
            if (!isNetworkAvailable()) return@thread // أضف هذا السطر

            val childId = getChildIdFromStorage()
            try {
                // نادي على الـ API المخصص للكونفيج أو جلب لستة التطبيقات مع التايمر الخاص بها
                val url = URL("http://16.171.208.58/api/child/$childId/allowed-apps-with-timers") // تأكدي من مسار الـ API ده بالـ Laravel عندك ليرجع ماب أو جيسون بالتايمرز
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 4000
                if (conn.responseCode == 200) {
                    val responseText = conn.inputStream.bufferedReader().readText()
                    // بنية الـ JSON المتوقعة: {"com.android.camera2": 120, "com.android.chrome": 30}
                    val timersJson = JSONObject(responseText)
                    
                    val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
                    sharedPrefs.edit().putString("app_timers_list", timersJson.toString()).apply()
                    Log.d("AppMonitor", "⏳ تم تحديث عدادات التطبيقات المسموحة بنجاح")
                }
            } catch (e: java.lang.Exception) {
                Log.e("AppMonitor", "❌ فشل جلب مؤقتات التطبيقات: ${e.message}")
            }
        }
    }

    private fun parseJsonArray(url: URL): MutableList<String> {
        return try {
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 5000
            if (conn.responseCode == 200) {
                val response = conn.inputStream.bufferedReader().readText()
                val jsonArray = JSONArray(response)
                val list = mutableListOf<String>()
                for (i in 0 until jsonArray.length()) { list.add(jsonArray.getString(i)) }
                list
            } else mutableListOf()
        } catch (e: Exception) { mutableListOf() }
    }

    // ⚙️ دالة حساب دقائق استهلاك التطبيق الحالي محلياً للأندرويد منذ بداية اليوم (12:00 AM)
    private fun getAppTodayUsageMinutes(packageName: String): Int {
        val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val calendar = Calendar.getInstance()
        val endTime = calendar.timeInMillis
        
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        val startTime = calendar.timeInMillis

        val stats = usageStatsManager.queryAndAggregateUsageStats(startTime, endTime)
        val usageStat = stats[packageName]

        return if (usageStat != null) {
            (usageStat.totalTimeInForeground / 60000).toInt()
        } else {
            0
        }
    }

    private fun checkCurrentApp() {
        // 🚀 أ) قراءة إعدادات الـ Downtime المخزنة على الجهاز من الـ SharedPreferences كما هي
        val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        val downtimeJsonStr = sharedPrefs.getString("downtime_list", null)

        if (downtimeJsonStr != null) {
            try {
                val json = JSONObject(downtimeJsonStr)
                isDowntimeEnabled = json.optBoolean("is_enabled", false)
                downtimeStartTime = json.optString("start_time", null)
                downtimeEndTime = json.optString("end_time", null)
                
                downtimeDays.clear()
                val daysArray = json.optJSONArray("days")
                if (daysArray != null) {
                    for (i in 0 until daysArray.length()) {
                        downtimeDays.add(daysArray.getInt(i))
                    }
                }
            } catch (e: Exception) {
                Log.e("AppMonitor", "خطأ في قراءة JSON الـ Downtime: ${e.message}")
            }
        }

        // 🚀 ب) فحص الـ Downtime بالدقائق 
        if (isDowntimeEnabled && downtimeStartTime != null && downtimeEndTime != null) {
            val calendar = Calendar.getInstance()
            val currentDayIndex = calendar.get(Calendar.DAY_OF_WEEK) - 1

            if (downtimeDays.contains(currentDayIndex)) {
                try {
                    val currentHour = calendar.get(Calendar.HOUR_OF_DAY)
                    val currentMinute = calendar.get(Calendar.MINUTE)
                    val currentTimeInMinutes = (currentHour * 60) + currentMinute

                    val startParts = downtimeStartTime!!.split(":")
                    val startMinutes = (startParts[0].toInt() * 60) + startParts[1].toInt()

                    val endParts = downtimeEndTime!!.split(":")
                    val endMinutes = (endParts[0].toInt() * 60) + endParts[1].toInt()

                    val isCurrentTimeInDowntime = if (startMinutes <= endMinutes) {
                        currentTimeInMinutes in startMinutes..endMinutes
                    } else {
                        currentTimeInMinutes >= startMinutes || currentTimeInMinutes <= endMinutes
                    }

                    if (isCurrentTimeInDowntime) {
                        val uStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
                        val t = System.currentTimeMillis()
                        val activeStats = uStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, t - 10000, t)
                        
                        if (activeStats != null && activeStats.isNotEmpty()) {
                            val currentTopApp = activeStats.sortedByDescending { it.lastTimeUsed }.firstOrNull()?.packageName
                            
                            if (currentTopApp != null && currentTopApp != packageName && currentTopApp != "com.android.systemui") {
                                Log.d("AppMonitor", "🔒 فترة الـ Downtime نشطة قسرياً. تم حظر التطبيق الحالي: $currentTopApp")
                                blockApp()
                            }
                        }
                        return 
                    }
                } catch (e: Exception) {
                    Log.e("AppMonitor", "خطأ في حسابات وقت الـ Downtime: ${e.message}")
                }
            }
        }

        // 🟢 كود الفحص القديم والأصلي مع دمج الـ App Timer ليعمل على كل الحزم
        val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val time = System.currentTimeMillis()
        val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, time - 10000, time)
        
        if (stats != null && stats.isNotEmpty()) {
            val lastApp = stats.sortedByDescending { it.lastTimeUsed }.firstOrNull()?.packageName
            
            if (lastApp != null && lastApp != packageName) {
                // 🚀 استثناء ذكي لحماية اللانشر الشاشة الرئيسية لتفادي الـ Loop والتعليق القاتل للجهاز
                val isLauncherOrSystem = lastApp.contains("launcher") || 
                                         lastApp.contains("systemui") || 
                                         lastApp == "android" ||
                                         lastApp.contains("packageinstaller") ||
                                         lastApp.contains("permissioncontroller")

                if (!isLauncherOrSystem) {
                    
                    // 🔄 تتبع بداية دخول التطبيق الحالي وإدارته حياً (Live) لتفادي تأخير الأندرويد
                    if (lastApp != lastTrackedApp) {
                        lastTrackedApp = lastApp
                        appSessionStartTime = System.currentTimeMillis()
                    }
                    
                    // 1️⃣ الفحص الأول: التايمر المحدد من لوحة الأب (App Timer) ⏳
                    val timersJsonStr = sharedPrefs.getString("app_timers_list", null)
                    if (timersJsonStr != null) {
                        try {
                            val timersJson = JSONObject(timersJsonStr)
                            if (timersJson.has(lastApp)) {
                                val limitInMinutes = timersJson.optInt(lastApp, 0)
                                if (limitInMinutes > 0) {
                                    
                                    // حساب دقائق الاستهلاك الفعلي المخزن + دقائق الجلسة الحالية النشطة فورياً
                                    val todayUsageMinutes = getAppTodayUsageMinutes(lastApp)
                                    val currentSessionMinutes = ((System.currentTimeMillis() - appSessionStartTime) / 60000).toInt()
                                    val totalLiveUsageMinutes = todayUsageMinutes + currentSessionMinutes

                                    if (totalLiveUsageMinutes >= limitInMinutes) {
                                        Log.d("AppMonitor", "⏳ طرد فوري! انتهى الوقت المسموح ($limitInMinutes دقيقة) لـ $lastApp. جاري الحظر...")
                                        blockApp()
                                        return // اخرج فوراً لحجبه
                                    }
                                }
                            }
                        } catch (e: Exception) {
                            Log.e("AppMonitor", "خطأ فحص محدد وقت التطبيقات: ${e.message}")
                        }
                    }

                    // 2️⃣ الفحص الثاني: البلوك الكلي العادي (كودك القديم)
                    if (blockedApps.contains(lastApp)) {
                        blockApp()
                    } 
                    else if (!allowedApps.contains(lastApp)) {
                        blockApp()
                        if (!reportedAppsInSession.contains(lastApp)) {
                            reportedAppsInSession.add(lastApp)
                            sendAppRequestToLaravel(lastApp)
                        }
                    }
                } else {
                    // لو رجع للشاشة الرئيسية أو اللانشر، صفر الجلسة النشطة
                    lastTrackedApp = null
                }
            }
        }
    }

    private fun blockApp() {
        // تصفير مؤشرات التتبع اللحظي بمجرد الحظر
        lastTrackedApp = null
        appSessionStartTime = 0

        try {
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            if (launchIntent != null) {
                launchIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or 
                                     Intent.FLAG_ACTIVITY_SINGLE_TOP or 
                                     Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                
                // 🚨 السطر السحري: نمرر مع الـ Intent كلمة سر أو إشارة "هو جاي ليه" للرياكت نيتف
                launchIntent.putExtra("status", "locked")
                
                startActivity(launchIntent)
            } else {
                val homeIntent = Intent(Intent.ACTION_MAIN).apply {
                    addCategory(Intent.CATEGORY_HOME)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                startActivity(homeIntent)
            }
        } catch (e: Exception) {
            Log.e("AppMonitor", "خطأ أثناء سحب التطبيق للواجهة: ${e.message}")
        }
    }

    private fun sendAppRequestToLaravel(packageName: String) {
        thread {
            if (!isNetworkAvailable()) return@thread // أضف هذا السطر

            val childId = getChildIdFromStorage()
            try {
                val url = URL("http://16.171.208.58/api/child/app-requests/store")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; utf-8")
                conn.setRequestProperty("Accept", "application/json") 
                conn.doOutput = true
                
                val json = JSONObject()
                json.put("child_id", childId) 
                json.put("package_name", packageName)
                json.put("app_name", packageName) 
                
                conn.outputStream.use { it.write(json.toString().toByteArray()) }

                if (conn.responseCode in 200..201) {
                    Log.d("AppMonitor", "📡 تم إرسال طلب الموافقة لـ $packageName")
                }
                conn.disconnect()
            } catch (e: Exception) {
                Log.e("AppMonitor", "❌ فشل إرسال الطلب")
            }
        }
    }


    private fun isNetworkAvailable(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(packageRemovedReceiver)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel("monitor_channel", "SecureSprout Guard", NotificationManager.IMPORTANCE_LOW)
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}