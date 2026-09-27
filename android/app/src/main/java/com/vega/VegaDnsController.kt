package com.vega

import android.content.Context
import android.util.Log
import com.facebook.react.modules.network.OkHttpClientProvider
import java.net.InetAddress
import java.net.UnknownHostException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import okhttp3.Dns
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.dnsoverhttps.DnsOverHttps

data class VegaDnsProvider(
  val id: String,
  val name: String,
  val url: String? = null,
  val bootstrapAddresses: List<String> = emptyList(),
)

/**
 * App-scoped DNS controller for React Native networking and react-native-video.
 *
 * The controller is installed before React Native starts. The OkHttp client keeps this
 * controller as its DNS implementation, so changing provider affects new connections without
 * rebuilding the React bridge. Existing in-flight calls are deliberately left untouched.
 */
object VegaDnsController : Dns {
  private const val TAG = "VegaDnsController"
  private const val PREFS_NAME = "vega_dns_preferences"
  private const val PROVIDER_KEY = "selected_provider"
  private const val CUSTOM_URL_KEY = "custom_url"
  private const val SYSTEM_PROVIDER_ID = "system"
  private const val CUSTOM_PROVIDER_ID = "custom"
  private const val DEFAULT_PROVIDER_ID = "cloudflare"
  private const val MAX_CUSTOM_URL_LENGTH = 2048
  private const val DNS_TIMEOUT_SECONDS = 10L

  val providers: List<VegaDnsProvider> = listOf(
    VegaDnsProvider(id = "system", name = "System"),
    VegaDnsProvider(
      id = "cloudflare",
      name = "Cloudflare",
      url = "https://cloudflare-dns.com/dns-query",
      bootstrapAddresses = listOf(
        "1.1.1.1",
        "1.0.0.1",
        "2606:4700:4700::1111",
        "2606:4700:4700::1001",
      ),
    ),
    VegaDnsProvider(
      id = "google",
      name = "Google",
      url = "https://dns.google/dns-query",
      bootstrapAddresses = listOf(
        "8.8.8.8",
        "8.8.4.4",
        "2001:4860:4860::8888",
        "2001:4860:4860::8844",
      ),
    ),
    VegaDnsProvider(
      id = "quad9",
      name = "Quad9 (unfiltered)",
      url = "https://dns10.quad9.net/dns-query",
      bootstrapAddresses = listOf(
        "9.9.9.10",
        "149.112.112.10",
        "2620:fe::10",
        "2620:fe::fe:10",
      ),
    ),
    VegaDnsProvider(
      id = "adguard",
      name = "AdGuard",
      url = "https://dns.adguard-dns.com/dns-query",
      bootstrapAddresses = listOf(
        "94.140.14.14",
        "94.140.15.15",
        "2a10:50c0::ad1:ff",
        "2a10:50c0::ad2:ff",
      ),
    ),
    VegaDnsProvider(id = CUSTOM_PROVIDER_ID, name = "Custom"),
  )

  private lateinit var appContext: Context

  @Volatile
  private var selectedProviderId: String = DEFAULT_PROVIDER_ID

  @Volatile
  private var customUrl: String? = null

  private val dohResolvers = ConcurrentHashMap<String, Dns>()

  fun install(context: Context) {
    appContext = context.applicationContext
    customUrl = readStoredCustomUrl()
    selectedProviderId = readStoredProviderId()

    OkHttpClientProvider.setOkHttpClientFactory {
      OkHttpClientProvider.createClientBuilder(appContext)
        .dns(this)
        .build()
    }

    Log.i(TAG, "Installed app-scoped DNS provider=$selectedProviderId")
  }

  fun getSelectedProviderId(): String = selectedProviderId

  fun getCustomUrl(): String? = customUrl

  fun setSelectedProvider(providerId: String) {
    require(findProvider(providerId) != null) { "Unsupported DNS provider: $providerId" }
    require(providerId != CUSTOM_PROVIDER_ID || customUrl != null) {
      "A valid custom DNS-over-HTTPS URL is required"
    }

    selectedProviderId = providerId
    appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(PROVIDER_KEY, providerId)
      .apply()

    evictIdleConnections()

    Log.i(TAG, "Selected app-scoped DNS provider=$providerId")
  }

  fun setCustomProvider(rawUrl: String): String {
    val endpoint = validateCustomUrl(rawUrl)
    val normalizedUrl = endpoint.toString()

    customUrl = normalizedUrl
    selectedProviderId = CUSTOM_PROVIDER_ID
    appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(CUSTOM_URL_KEY, normalizedUrl)
      .putString(PROVIDER_KEY, CUSTOM_PROVIDER_ID)
      .apply()

    dohResolvers.keys.removeAll { key -> key.startsWith("$CUSTOM_PROVIDER_ID:") }
    evictIdleConnections()

    Log.i(TAG, "Selected custom app-scoped DNS provider host=${endpoint.host}")
    return normalizedUrl
  }

  @Throws(UnknownHostException::class)
  override fun lookup(hostname: String): List<InetAddress> {
    if (hostname.isBlank()) {
      throw UnknownHostException("hostname is empty")
    }

    val provider = findProvider(selectedProviderId) ?: requireNotNull(findProvider(DEFAULT_PROVIDER_ID))
    if (provider.id == SYSTEM_PROVIDER_ID) {
      return Dns.SYSTEM.lookup(hostname)
    }

    val endpoint = if (provider.id == CUSTOM_PROVIDER_ID) {
      customUrl ?: throw UnknownHostException("Custom DNS-over-HTTPS URL is not configured")
    } else {
      requireNotNull(provider.url) { "Missing DoH endpoint for ${provider.id}" }
    }

    return resolverFor(provider, endpoint).lookup(hostname)
  }

  private fun readStoredProviderId(): String {
    val stored = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(PROVIDER_KEY, DEFAULT_PROVIDER_ID)
      .orEmpty()
    val provider = findProvider(stored) ?: return DEFAULT_PROVIDER_ID
    return if (provider.id == CUSTOM_PROVIDER_ID && customUrl == null) {
      DEFAULT_PROVIDER_ID
    } else {
      provider.id
    }
  }

  private fun readStoredCustomUrl(): String? {
    val stored = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(CUSTOM_URL_KEY, null)
      ?: return null
    return runCatching { validateCustomUrl(stored).toString() }
      .onFailure { error -> Log.w(TAG, "Ignoring invalid stored custom DoH URL", error) }
      .getOrNull()
  }

  private fun findProvider(providerId: String): VegaDnsProvider? =
    providers.firstOrNull { provider -> provider.id == providerId }

  private fun resolverFor(provider: VegaDnsProvider, endpoint: String): Dns =
    dohResolvers.getOrPut("${provider.id}:$endpoint") {
      val bootstrapHosts = provider.bootstrapAddresses.map(InetAddress::getByName)
      val bootstrapClient = OkHttpClient.Builder()
        .dns(Dns.SYSTEM)
        .connectTimeout(DNS_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(DNS_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .writeTimeout(DNS_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .build()

      val builder = DnsOverHttps.Builder()
        .client(bootstrapClient)
        .url(requireNotNull(endpoint.toHttpUrlOrNull()))

      if (bootstrapHosts.isNotEmpty()) {
        builder.bootstrapDnsHosts(bootstrapHosts)
      }

      builder.build()
    }

  private fun validateCustomUrl(rawUrl: String): HttpUrl {
    val candidate = rawUrl.trim()
    require(candidate.isNotEmpty()) { "Custom DNS-over-HTTPS URL is required" }
    require(candidate.length <= MAX_CUSTOM_URL_LENGTH) { "Custom DNS-over-HTTPS URL is too long" }

    val endpoint = candidate.toHttpUrlOrNull()
      ?: throw IllegalArgumentException("Custom DNS-over-HTTPS URL is invalid")
    require(endpoint.isHttps) { "Custom DNS-over-HTTPS URL must use HTTPS" }
    require(endpoint.username.isEmpty() && endpoint.password.isEmpty()) {
      "Custom DNS-over-HTTPS URL must not contain credentials"
    }
    require(endpoint.query == null && endpoint.fragment == null) {
      "Custom DNS-over-HTTPS URL must not contain a query or fragment"
    }

    return endpoint
  }

  private fun evictIdleConnections() {
    // Idle connections may still point at addresses resolved by the previous provider.
    // Active requests are not cancelled; subsequent connections use the new resolver.
    runCatching { OkHttpClientProvider.getOkHttpClient().connectionPool.evictAll() }
      .onFailure { error -> Log.w(TAG, "Unable to evict idle HTTP connections", error) }
  }
}
